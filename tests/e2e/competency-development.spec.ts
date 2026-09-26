import { expect, test } from "@playwright/test";

const sourceText = "Coordiné la migración del sistema de facturación.";
const competencyText = "Coordinación de migraciones de sistemas";
const developmentAction = "Definir una métrica previa y posterior a futuras migraciones.";

const finalCv = {
  personalInfo: { fullName: "Ana García", email: "ana@example.com", phone: "", location: "Madrid", linkedin: "", website: "" },
  summary: "Profesional de operaciones.",
  experience: [],
  education: [],
  skills: { hard: [competencyText], soft: [] },
  languages: [],
  certifications: [],
};

test.describe("Competencias demostradas y por desarrollar", () => {
  test("separa una competencia con evidencia de las acciones de desarrollo", async ({ page }) => {
    await page.route("**/auth/v1/token**", async (route) => {
      const now = Math.floor(Date.now() / 1000);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "synthetic-competency-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: "synthetic-competency-refresh",
          user: {
            id: "competency-user",
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
    await page.route("**/api/trajectory-assistance/turn", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: "ready",
          proposals: [
            {
              proposalId: "competency-1",
              kind: "competency",
              text: competencyText,
              competencyType: "hard",
              evidence: [sourceText],
            },
          ],
          developmentRecommendations: [
            {
              competency: "Medición de resultados",
              reason: "La fuente no contiene una métrica de impacto.",
              actions: [developmentAction],
            },
          ],
        }),
      }),
    );

    let generatedText = "";
    await page.route("**/api/generate-cv", async (route) => {
      generatedText = (route.request().postDataJSON() as { text: string }).text;
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
    const proposals = dialog.getByRole("region", { name: "Propuestas con evidencia" });
    const development = dialog.getByRole("region", { name: "Competencias que podrías desarrollar" });
    await expect(proposals).toContainText(sourceText);
    await expect(proposals).toContainText(competencyText);
    await expect(development).toContainText(developmentAction);
    await proposals.getByRole("button", { name: "Aceptar original" }).click();
    await dialog.getByRole("button", { name: "Usar propuestas aceptadas" }).click();
    await page.getByRole("button", { name: "Generar CV" }).click();

    await expect(page.getByRole("region", { name: "Vista previa del CV" })).toBeVisible();
    expect(generatedText).toContain(competencyText);
    expect(generatedText).not.toContain(developmentAction);
  });
});
