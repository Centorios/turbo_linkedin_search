import { expect, test, type Page } from "@playwright/test";
import { expectPreviewText } from "./pdf-preview";

// "Editar CV" from the history: login and API are simulated.
const owner = "00000000-0000-0000-0000-000000000001";
const originalId = "00000000-0000-0000-0000-000000000501";
const cv = {
  personalInfo: { fullName: "Juan Pérez", email: "juan@example.com", phone: "", location: "Argentina", linkedin: "", website: "", photoPath: null },
  summary: "Desarrollador junior",
  experience: [],
  education: [],
  skills: { hard: ["C"], soft: [] },
  languages: [],
  certifications: [],
};
const editedCv = { ...cv, skills: { hard: ["C", "Python"], soft: [] } };

type Version = { id: string; createdAt: string; data: typeof cv; parentResumeId: string | null };

async function prepare(page: Page) {
  const versions: Version[] = [{ id: originalId, createdAt: "2026-10-17T03:33:00Z", data: cv, parentResumeId: null }];
  const calls = { edits: [] as { url: string; body: Record<string, unknown> }[], saves: [] as { url: string; body: Record<string, unknown> }[], importEdits: 0 };
  const user = { id: owner, email: "juan@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, aud: "authenticated", created_at: new Date().toISOString() };

  await page.route("**/auth/v1/token**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    access_token: "synthetic-edit-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "synthetic-edit-refresh", user,
  }) }));
  await page.route("**/auth/v1/user**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));
  await page.route("**/api/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cv.personalInfo) }));
  await page.route("**/api/resumes?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    items: [...versions].reverse().map((item) => ({ id: item.id, createdAt: item.createdAt, fullName: item.data.personalInfo.fullName, summary: item.data.summary })),
    offset: 0, limit: 20, hasMore: false,
  }) }));
  await page.route("**/api/resumes/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop();
    const item = versions.find((version) => version.id === id);
    return route.fulfill({ status: item ? 200 : 404, contentType: "application/json", body: JSON.stringify(item ? { id: item.id, createdAt: item.createdAt, data: item.data } : { detail: { message: "El CV no está disponible" } }) });
  });
  await page.route("**/api/resumes/*/edits", (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    calls.edits.push({ url: route.request().url(), body });
    const answered = Array.isArray(body.answers) && body.answers.length > 0;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(answered
      ? { status: "ready", proposedCv: editedCv, changedSections: ["skills"], changeSummary: "Se proponen cambios en habilidades." }
      : { status: "needs_input", questions: ["¿Desde qué año usás Python?"] }) });
  });
  await page.route("**/api/resumes/*/versions", (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    calls.saves.push({ url: route.request().url(), body });
    const parentResumeId = new URL(route.request().url()).pathname.split("/").at(-2)!;
    const saved = { id: "00000000-0000-0000-0000-000000000502", createdAt: "2026-10-23T15:00:00Z", data: body.data as typeof cv, parentResumeId };
    versions.push(saved);
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ...saved, sourceId: null }) });
  });
  await page.route("**/api/cv-imports/**", (route) => {
    calls.importEdits += 1;
    return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });

  await page.goto("/auth");
  await page.getByTestId("auth-email").fill("juan@example.test");
  await page.getByTestId("auth-password").fill("synthetic-password");
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/generate$/);
  const deferProfile = page.getByRole("button", { name: "Completar más tarde" });
  if (await deferProfile.isVisible()) await deferProfile.click();
  return calls;
}

test("edita una versión del historial y la guarda como versión nueva", async ({ page }) => {
  const calls = await prepare(page);

  await page.getByTestId("history-navigation").click();
  await page.getByTestId(`history-item-${originalId}`).click();
  const editLink = page.getByTestId("history-edit");
  await expect(editLink).toHaveText("Editar CV");
  await editLink.click();

  await expect(page).toHaveURL(new RegExp(`/generate\\?editar=${originalId}#editar-cv$`));
  await expect(page.getByTestId("cv-history-edit-banner")).toContainText("Editando tu CV del");
  await expect(page.getByTestId("cv-import-file")).toHaveCount(0);
  await expect(page.getByTestId("cv-import-delete")).toHaveCount(0);
  await expectPreviewText(page, { contains: ["Juan Pérez", "juan@example.com"] });

  await page.getByTestId("cv-edit-instruction").fill("Agregá Python a mis habilidades");
  await page.getByTestId("cv-edit-submit").click();
  await page.getByLabel("¿Desde qué año usás Python?").fill("2023");
  await page.getByRole("button", { name: "Enviar respuestas" }).click();

  await expect(page.getByTestId("cv-import-changed-sections")).toContainText("habilidades");
  await expectPreviewText(page, { contains: ["Python"] });
  await page.getByTestId("cv-import-save").click();
  await expect(page.getByTestId("cv-import-status")).toContainText("Ya aparece en tu Historial");

  expect(calls.importEdits).toBe(0);
  expect(calls.edits.every((call) => call.url.includes(`/api/resumes/${originalId}/edits`))).toBe(true);
  expect(calls.edits.at(-1)?.body.answers).toEqual(["2023"]);
  expect(calls.saves).toHaveLength(1);
  expect(calls.saves[0].url).toContain(`/api/resumes/${originalId}/versions`);

  await page.getByTestId("cv-import-history-link").click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId("history-item-00000000-0000-0000-0000-000000000502")).toBeVisible();
  await expect(page.getByTestId(`history-item-${originalId}`)).toBeVisible();
});

test("una versión inexistente avisa y deja importar un PDF", async ({ page }) => {
  await prepare(page);
  await page.goto("/generate?editar=00000000-0000-0000-0000-000000000999#editar-cv");

  await expect(page.getByTestId("cv-import-error")).toContainText("No encontramos esa versión del CV");
  await expect(page.getByTestId("cv-import-browse")).toBeVisible();
});
