import { expect, test } from "@playwright/test";

const sourceText = "Lideré una migración de facturación y soporte recibió menos incidencias.";
const acceptedRevision = "Coordiné y lideré una migración de facturación; soporte reportó menos incidencias.";

const finalCv = {
  personalInfo: { fullName: "Ana García", email: "ana@example.com", phone: "", location: "Madrid", linkedin: "", website: "" },
  summary: "Profesional de operaciones.",
  experience: [],
  education: [],
  skills: { hard: [], soft: [] },
  languages: [],
  certifications: [],
};

test.describe("Asistencia de trayectoria profesional", () => {
  test("aclara hechos, permite revisar propuestas y solo envía contenido aceptado al CV", async ({ page }) => {
    await page.route("**/auth/v1/token**", async (route) => {
      const now = Math.floor(Date.now() / 1000);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "synthetic-trajectory-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: "synthetic-trajectory-refresh",
          user: {
            id: "trajectory-user",
            email: "ana@example.test",
            app_metadata: { provider: "email", providers: ["email"] },
            user_metadata: {},
            aud: "authenticated",
            created_at: new Date().toISOString(),
          },
        }),
      });
    });
    await page.route("**/auth/v1/logout**", (route) => route.fulfill({ status: 204, body: "" }));
    await page.route("**/api/trajectory-assistance/turn", async (route) => {
      const payload = route.request().postDataJSON() as {
        sourceText: string;
        answers: { answer: string }[];
        user_id?: string;
      };
      expect(payload.sourceText).toBe(sourceText);
      expect(payload.user_id).toBeUndefined();

      if (payload.answers.length === 0) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            state: "needs_input",
            questions: [{ id: "metric-question", text: "¿Qué cifra puedes confirmar sobre la reducción de incidencias?" }],
          }),
        });
        return;
      }

      expect(payload.answers[0].answer).toBe("No conozco una cifra fiable.");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: "ready",
          proposals: [
            {
              proposalId: "achievement-1",
              kind: "achievement",
              text: "Lideré una migración de facturación y soporte recibió menos incidencias.",
              competencyType: null,
              evidence: ["Lideré una migración de facturación", "soporte recibió menos incidencias"],
            },
            {
              proposalId: "competency-1",
              kind: "competency",
              text: "Coordinación de migraciones de sistemas",
              competencyType: "hard",
              evidence: ["Lideré una migración de facturación"],
            },
          ],
          developmentRecommendations: [
            {
              competency: "Medición de resultados",
              reason: "No se dispone de una métrica confirmada.",
              actions: ["Definir una métrica de incidencias para futuros proyectos."],
            },
          ],
        }),
      });
    });

    let generatedText = "";
    await page.route("**/api/generate-cv", async (route) => {
      const payload = route.request().postDataJSON() as { text: string };
      generatedText = payload.text;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(finalCv) });
    });

    await page.goto("/auth");
    await page.getByLabel("Correo electrónico").fill("ana@example.test");
    await page.getByLabel("Contraseña").fill("synthetic-password");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/generate$/);
    await page.getByLabel("Biografía o experiencia profesional").fill(sourceText);
    await page.getByRole("button", { name: "Mejorar trayectoria y competencias" }).click();

    const dialog = page.getByRole("dialog", { name: "Mejorar trayectoria y competencias" });
    await expect(dialog.getByRole("heading", { name: "Necesito aclarar algunos detalles" })).toBeVisible();
    await expect(dialog.getByLabel("¿Qué cifra puedes confirmar sobre la reducción de incidencias?")).toBeVisible();
    await dialog.getByRole("button", { name: "No conozco esos datos" }).click();

    await expect(dialog.getByRole("heading", { name: "Propuestas con evidencia" })).toBeVisible();
    await expect(dialog.getByText("Lideré una migración de facturación", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Competencias que podrías desarrollar" })).toBeVisible();

    await dialog.getByRole("textbox", { name: "Editar propuesta achievement-1" }).fill(acceptedRevision);
    await dialog.getByRole("button", { name: "Aceptar edición" }).nth(0).click();
    await dialog.getByRole("button", { name: "Rechazar" }).nth(1).click();
    await dialog.getByRole("button", { name: "Usar propuestas aceptadas" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Generar CV" }).click();
    await expect(page.getByRole("region", { name: "Vista previa del CV" })).toBeVisible();
    expect(generatedText).toContain(sourceText);
    expect(generatedText).toContain(acceptedRevision);
    expect(generatedText).not.toContain("Coordinación de migraciones de sistemas");
    expect(generatedText).not.toContain("Definir una métrica de incidencias");
  });
});
