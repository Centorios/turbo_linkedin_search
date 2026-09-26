import { expect, test } from "@playwright/test";

const savedProfile = {
  fullName: "Ana García",
  email: "ana.cv@example.com",
  phone: "+34 600 000 000",
  location: "Madrid",
  linkedin: "https://www.linkedin.com/in/ana-garcia",
  website: "https://ana.example.com",
};

const structuredCv = {
  personalInfo: savedProfile,
  summary: "Product designer con experiencia en productos digitales.",
  experience: [],
  education: [],
  skills: { hard: ["Figma"], soft: ["Comunicación"] },
  languages: [],
  certifications: [],
};

test.describe("Perfil reutilizado en el CV", () => {
  test("muestra los datos personales guardados y conserva las secciones profesionales", async ({ page }) => {
    await page.route("**/auth/v1/token**", async (route) => {
      const now = Math.floor(Date.now() / 1000);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "synthetic-profile-cv-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: "synthetic-profile-cv-refresh",
          user: {
            id: "user-profile-cv",
            email: "ana@example.test",
            app_metadata: { provider: "email", providers: ["email"] },
            user_metadata: {},
            aud: "authenticated",
            created_at: new Date().toISOString(),
          },
        }),
      });
    });
    await page.route("**/api/profile", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(savedProfile) }),
    );
    await page.route("**/api/generate-cv", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(structuredCv) }),
    );

    await page.goto("/auth");
    await page.getByLabel("Correo electrónico").fill("ana@example.test");
    await page.getByLabel("Contraseña").fill("synthetic-password");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/generate$/);
    await page.getByLabel("Biografía o experiencia profesional").fill("Ana trabaja en diseño de productos digitales.");
    await page.getByRole("button", { name: "Generar CV" }).click();

    const preview = page.getByRole("region", { name: "Vista previa del CV" });
    await expect(preview.getByRole("heading", { name: "Ana García" })).toBeVisible();
    await expect(preview).toContainText("ana.cv@example.com");
    await expect(preview).toContainText("Product designer con experiencia en productos digitales.");
    await expect(preview).toContainText("Sin experiencia registrada.");
    await expect(preview).toContainText("Sin educación registrada.");
    await expect(preview).toContainText("Figma, Comunicación");
  });
});
