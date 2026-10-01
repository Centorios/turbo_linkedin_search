import { expect, test, type Page } from "@playwright/test";

const owner = "00000000-0000-0000-0000-000000000001";
const cv = {
  personalInfo: { fullName: "Ana Histórica", email: "ana@example.com", phone: "", location: "Buenos Aires", linkedin: "", website: "", photoPath: null },
  summary: "Desarrolladora con experiencia en productos digitales.",
  experience: [], education: [], skills: { hard: ["Python", "React"], soft: ["Comunicación"] }, languages: [], certifications: [],
};
const id = (number: number) => `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`;
const version = (number: number) => ({ id: id(number), createdAt: `2026-09-${String(number).padStart(2, "0")}T12:00:00Z`, fullName: cv.personalInfo.fullName, summary: cv.summary });

async function prepare(page: Page, options: { empty?: boolean; failList?: boolean; missingPhoto?: boolean } = {}) {
  let records = options.empty ? [] : Array.from({ length: 21 }, (_, i) => version(21 - i));
  let failedOnce = false;
  let generationCalls = 0;
  await page.route("**/auth/v1/token**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    access_token: "synthetic-history-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "synthetic-history-refresh", user: { id: owner, email: "ana@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, aud: "authenticated", created_at: new Date().toISOString() },
  }) }));
  await page.route("**/auth/v1/logout**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...cv.personalInfo, fullName: "Nombre actual" }) }));
  await page.route("**/api/resumes?**", (route) => {
    if (options.failList && !failedOnce) {
      failedOnce = true;
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: { message: "No se pudo cargar el historial." } }) });
    }
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: records.slice(offset, offset + 20), offset, limit: 20, hasMore: records.length > offset + 20 }) });
  });
  await page.route("**/api/resumes/*", (route) => {
    const recordId = new URL(route.request().url()).pathname.split("/").pop();
    const item = records.find((row) => row.id === recordId);
    return route.fulfill({ status: item ? 200 : 404, contentType: "application/json", body: JSON.stringify(item ? { id: item.id, createdAt: item.createdAt, data: { ...cv, personalInfo: { ...cv.personalInfo, photoPath: options.missingPhoto ? `${owner}/old.webp` : null } } } : { detail: { message: "El CV no está disponible" } }) });
  });
  await page.route("**/storage/v1/object/sign/**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not_found", message: "Foto eliminada" }) }));
  await page.route("**/api/generate-cv", (route) => {
    generationCalls++;
    records = [version(22), ...records];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cv) });
  });
  await page.goto("/auth");
  await page.getByTestId("auth-email").fill("ana@example.test");
  await page.getByTestId("auth-password").fill("synthetic-password");
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/generate$/);
  return () => generationCalls;
}

test("recupera snapshot original, pagina y descarga ambas plantillas sin IA", async ({ page }) => {
  const generationCalls = await prepare(page);
  await page.getByTestId("history-navigation").click();
  await expect(page.getByTestId(`history-item-${id(21)}`)).toBeVisible();
  await page.getByTestId("history-next").click();
  await expect(page.getByTestId(`history-item-${id(1)}`)).toBeVisible();
  await expect(page.getByTestId("history-next")).toBeDisabled();
  await page.getByTestId("history-previous").click();
  await page.getByTestId(`history-item-${id(21)}`).click();
  await expect(page.getByTestId("cv-preview")).toContainText("Ana Histórica");
  await expect(page.getByTestId("cv-preview")).not.toContainText("Nombre actual");
  for (const template of ["ats", "creative"]) {
    await page.getByTestId(`template-${template}`).click();
    const download = page.waitForEvent("download");
    await page.getByTestId("pdf-download").click();
    expect((await download).suggestedFilename()).toMatch(/ana-historica-.*\.pdf$/);
  }
  expect(generationCalls()).toBe(0);
  await page.reload();
  await expect(page.getByTestId(`history-item-${id(21)}`)).toBeVisible();
});

test("vacío y guardado automático tras generación", async ({ page }) => {
  await prepare(page, { empty: true });
  await page.getByTestId("history-navigation").click();
  await expect(page.getByTestId("history-empty")).toContainText("Aún no tienes CVs");
  await page.getByTestId("history-create").click();
  await page.getByTestId("professional-text").fill("Mi trayectoria profesional en desarrollo.");
  await page.getByTestId("generate-submit").click();
  await expect(page.getByTestId("cv-preview")).toBeVisible();
  await page.getByTestId("history-navigation").click();
  await expect(page.getByTestId(`history-item-${id(22)}`)).toBeVisible();
});

test("error de lista permite reintentar", async ({ page }) => {
  await prepare(page, { failList: true });
  await page.getByTestId("history-navigation").click();
  await expect(page.getByTestId("history-error")).toBeVisible();
  await page.getByTestId("history-retry").click();
  await expect(page.getByTestId(`history-item-${id(21)}`)).toBeVisible();
});

test("foto antigua eliminada no impide descargar el PDF visual", async ({ page }) => {
  await prepare(page, { missingPhoto: true });
  await page.getByTestId("history-navigation").click();
  await page.getByTestId(`history-item-${id(21)}`).click();
  await expect(page.getByText("La foto de esta versión ya no está disponible.", { exact: false })).toBeVisible();
  await page.getByTestId("template-creative").click();
  const download = page.waitForEvent("download");
  await page.getByTestId("pdf-download").click();
  expect((await download).suggestedFilename()).toBe("ana-historica-creativo.pdf");
});

test("historial protegido y cierre de sesión retira datos", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/auth\?reason=session-expired/);
  await prepare(page);
  await page.getByTestId("history-navigation").click();
  await page.getByTestId(`history-item-${id(21)}`).click();
  await expect(page.getByTestId("cv-preview")).toBeVisible();
  await page.getByTestId("auth-sign-out").click();
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByTestId("history-content")).toHaveCount(0);
});

test("historial en móvil sin overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await prepare(page);
  await page.getByTestId("history-navigation").click();
  await expect(page.getByTestId(`history-item-${id(21)}`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
