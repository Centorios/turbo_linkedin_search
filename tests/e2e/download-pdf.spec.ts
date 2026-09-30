import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PDFParse } from "pdf-parse";

const testEmail = "ana@example.test";
const testUserId = "00000000-0000-0000-0000-000000000001";
const savedProfile = {
  fullName: "Ana García",
  email: "ana@example.com",
  phone: "",
  location: "Madrid",
  linkedin: "",
  website: "",
  photoPath: null,
};

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
  await page.route("**/auth/v1/token**", async (route) => {
    const now = Math.floor(Date.now() / 1000);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "synthetic-download-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: "synthetic-download-refresh",
        user: {
          id: testUserId,
          email: testEmail,
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      }),
    });
  });
  await page.route("**/auth/v1/logout**", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(savedProfile) }),
  );
  await page.goto("/auth");
  await page.getByLabel("Correo electrónico").fill(testEmail);
  await page.getByLabel("Contraseña").fill("synthetic-password");
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/generate$/);
  const deferProfile = page.getByRole("button", { name: "Completar más tarde" });
  if (await deferProfile.isVisible()) {
    await deferProfile.click();
  }
}

async function generateCv(page: Page, cv: unknown) {
  await page.route("**/api/generate-cv", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cv) }));
  await page.getByTestId("professional-text").fill("Perfil profesional de prueba");
  await page.getByTestId("generate-submit").click();
  await expect(page.getByTestId("pdf-download")).toBeVisible();
}

async function readPdfText(path: string): Promise<string> {
  const parser = new PDFParse({ data: readFileSync(path) });
  try {
    return (await parser.getText()).text.replace(/\s+/g, " ").toLocaleLowerCase();
  } finally {
    await parser.destroy();
  }
}

function expectOrderedContent(text: string, entries: string[]) {
  let previousIndex = -1;
  for (const entry of entries) {
    const index = text.indexOf(entry.toLocaleLowerCase(), previousIndex + 1);
    expect(index, `Se esperaba '${entry}' después del índice ${previousIndex}`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

async function expectPdfMatchesPreview(page: Page, path: string, template: "ats" | "creative") {
  const previewText = (await page.getByRole("region", { name: "Vista previa del CV" }).innerText())
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
  const pdfText = await readPdfText(path);
  const entries = template === "ats"
    ? ["Ana García", "ana@example.com", "Senior Designer", "Acme", "Lideró el rediseño", "Diseño Gráfico", "Figma", "Comunicación"]
    : ["Perfil profesional", "Ana García", "ana@example.com", "Product designer", "Trayectoria", "Senior Designer", "Acme", "Lideró el rediseño", "Competencias", "Figma", "Comunicación", "Formación", "Diseño Gráfico"];

  expectOrderedContent(previewText, entries);
  expectOrderedContent(pdfText, entries);
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
    await expectPdfMatchesPreview(page, path!, "ats");
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
    const atsPath = await atsDownload.path();
    expect(atsPath).not.toBeNull();
    await expectPdfMatchesPreview(page, atsPath!, "ats");

    await page.getByTestId("template-creative").click();
    await expect(page.getByTestId("template-creativo-pdf")).toBeVisible();

    const [creativeDownload] = await Promise.all([page.waitForEvent("download"), page.getByTestId("pdf-download").click()]);
    expect(creativeDownload.suggestedFilename()).toBe("ana-garcia-creativo.pdf");
    const creativePath = await creativeDownload.path();
    expect(creativePath).not.toBeNull();
    await expectPdfMatchesPreview(page, creativePath!, "creative");
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
