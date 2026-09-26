import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const validEmail = process.env.E2E_EMAIL;
const validPassword = process.env.E2E_PASSWORD;

const fullCv = {
  personalInfo: { fullName: "Ana García", email: "ana@example.com", phone: "", location: "Madrid", linkedin: "", website: "" },
  summary: "Product designer con experiencia en productos digitales.",
  experience: [{ title: "Senior Designer", company: "Acme", location: "Remoto", startDate: "03-2021", endDate: "", achievements: ["Lideró el rediseño del checkout"] }],
  education: [{ institution: "UBA", program: "Diseño Gráfico", startDate: "2015", endDate: "2019", description: "" }],
  skills: { hard: ["Figma"], soft: ["Comunicación"] },
  languages: [],
  certifications: [],
};

const minimalCv = {
  personalInfo: { fullName: "", email: "", phone: "", location: "", linkedin: "", website: "" },
  summary: "",
  experience: [],
  education: [],
  skills: { hard: ["Figma"], soft: [] },
  languages: [],
  certifications: [],
};

async function signIn(page: Page) {
  if (!validEmail || !validPassword) {
    throw new Error("Configura E2E_EMAIL y E2E_PASSWORD antes de ejecutar las pruebas");
  }
  await page.goto("/auth");
  await page.getByLabel("Correo electrónico").fill(validEmail);
  await page.getByLabel("Contraseña").fill(validPassword);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/generate$/);
}

async function generateCv(page: Page, cv: unknown) {
  await page.route("**/api/generate-cv", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cv) }));
  await page.getByTestId("professional-text").fill("Perfil profesional de prueba");
  await page.getByTestId("generate-submit").click();
  await expect(page.getByTestId("pdf-download")).toBeVisible();
}

test.describe("Descarga de CV en PDF", () => {
  test("descarga un PDF legible con el contenido de la previsualización", async ({ page }) => {
    await signIn(page);
    await generateCv(page, fullCv);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("pdf-download").click()]);

    expect(download.suggestedFilename()).toBe("ana-garcia-ats.pdf");
    const path = await download.path();
    expect(path).not.toBeNull();
    const bytes = readFileSync(path!);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("un CV con una sola sección se mantiene legible en el PDF descargado", async ({ page }) => {
    await signIn(page);
    await generateCv(page, minimalCv);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("pdf-download").click()]);

    const path = await download.path();
    const bytes = readFileSync(path!);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(200);
  });

  test("descarga correctamente en ambas plantillas", async ({ page }) => {
    await signIn(page);
    await generateCv(page, fullCv);

    const [atsDownload] = await Promise.all([page.waitForEvent("download"), page.getByTestId("pdf-download").click()]);
    expect(atsDownload.suggestedFilename()).toBe("ana-garcia-ats.pdf");

    await page.getByTestId("template-creative").click();
    await expect(page.getByTestId("template-creativo-pdf")).toBeVisible();

    const [creativeDownload] = await Promise.all([page.waitForEvent("download"), page.getByTestId("pdf-download").click()]);
    expect(creativeDownload.suggestedFilename()).toBe("ana-garcia-creativo.pdf");
  });

  test("protege contra descargas duplicadas mientras la primera sigue en curso", async ({ page }) => {
    await signIn(page);
    await generateCv(page, fullCv);

    const downloads: string[] = [];
    page.on("download", (download) => downloads.push(download.suggestedFilename()));

    // Dispatch two clicks back to back, bypassing Playwright's actionability wait
    // (which would refuse to click a disabled button): this exercises the
    // component's own synchronous guard against a duplicate in-flight download,
    // not just the browser's "disabled buttons ignore clicks" behavior.
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="pdf-download"]') as HTMLButtonElement;
      button.click();
      button.click();
    });

    await expect(page.getByTestId("pdf-download")).toBeDisabled();
    await expect(page.getByTestId("pdf-download")).toContainText("Descargando");
    await expect(page.getByTestId("pdf-download")).toBeEnabled();

    expect(downloads).toHaveLength(1);
  });
});
