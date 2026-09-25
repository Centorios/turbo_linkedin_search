import { expect, test, type Page } from "@playwright/test";

const validEmail = process.env.E2E_EMAIL;
const validPassword = process.env.E2E_PASSWORD;

const validCv = {
  personalInfo: { fullName: "Ana García", email: "ana@example.com", phone: "", location: "Madrid", linkedin: "", website: "" },
  summary: "Product designer con experiencia en productos digitales.",
  experience: [],
  education: [],
  skills: { hard: ["Figma"], soft: ["Comunicación"] },
  languages: [],
  certifications: [],
};

async function signIn(page: Page) {
  if (!validEmail || !validPassword) {
    throw new Error("Configura E2E_EMAIL y E2E_PASSWORD antes de ejecutar las pruebas");
  }
  await page.goto("/auth");
  await page.getByTestId("auth-email").fill(validEmail);
  await page.getByTestId("auth-password").fill(validPassword);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/generate$/);
}

test.describe("Generación de CV", () => {
  test("impide enviar texto vacío", async ({ page }) => {
    await signIn(page);
    await page.getByTestId("generate-submit").click();
    await expect(page.getByTestId("generation-error")).toContainText("Escribe tu biografía");
  });

  test("muestra carga y preview estructurado", async ({ page }) => {
    await signIn(page);
    await page.route("**/api/generate-cv", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(validCv) });
    });
    await page.getByTestId("professional-text").fill("Ana es product designer y usa Figma.");
    await page.getByTestId("generate-submit").click();
    await expect(page.getByTestId("generate-submit")).toContainText("Generando CV");
    await expect(page.getByTestId("cv-preview")).toBeVisible();
    await expect(page.getByTestId("template-minimalista-ats")).toContainText("Ana García");
  });

  test("conserva secciones vacías sin inventar datos", async ({ page }) => {
    await signIn(page);
    await page.route("**/api/generate-cv", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(validCv) }));
    await page.getByTestId("professional-text").fill("Solo se conoce que trabaja con Figma.");
    await page.getByTestId("generate-submit").click();
    await expect(page.getByTestId("cv-preview")).toContainText("Sin experiencia registrada.");
  });

  test("muestra un error recuperable del backend", async ({ page }) => {
    await signIn(page);
    await page.route("**/api/generate-cv", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ detail: { message: "El servicio de generación no está disponible" } }) }));
    await page.getByTestId("professional-text").fill("Perfil profesional");
    await page.getByTestId("generate-submit").click();
    await expect(page.getByTestId("generation-error")).toContainText("no está disponible");
    await expect(page.getByTestId("generate-submit")).toBeEnabled();
  });
});
