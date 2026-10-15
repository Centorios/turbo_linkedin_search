import { expect, test, type Page } from "@playwright/test";

const sourceId = "00000000-0000-0000-0000-000000000011";
const baseResumeId = "00000000-0000-0000-0000-000000000012";
const savedResumeId = "00000000-0000-0000-0000-000000000013";
const testEmail = "cv-import-e2e@example.com";
const accessToken = "mock-access-owner";

const originalPdf = Buffer.from("%PDF-1.4\nsynthetic CV");
const baseCv = {
  personalInfo: {
    fullName: "Ana García",
    email: "ana@example.com",
    phone: "",
    location: "Buenos Aires",
    linkedin: "",
    website: "",
    photoPath: null,
  },
  summary: "Desarrolladora de software",
  experience: [],
  education: [],
  skills: { hard: ["Python"], soft: [] },
  languages: [],
  certifications: [],
};
const editedCv = {
  ...baseCv,
  experience: [{
    title: "Desarrolladora",
    company: "Acme",
    location: "",
    startDate: "2022",
    endDate: "",
    achievements: ["Desarrolló una API"],
  }],
};
const importedCv = {
  source: {
    id: sourceId,
    originalFilename: "ana.pdf",
    fileSizeBytes: originalPdf.length,
    pageCount: 1,
    createdAt: "2026-10-14T12:00:00Z",
  },
  resume: {
    id: baseResumeId,
    sourceId,
    parentResumeId: null,
    createdAt: "2026-10-14T12:00:00Z",
    data: baseCv,
  },
};

type CapturedRequests = {
  importBytes: Buffer | null;
  importContentType: string | undefined;
  originalFilename: string | undefined;
  edits: Array<Record<string, unknown>>;
  savedVersion: Record<string, unknown> | null;
  downloadedBytes: Buffer | null;
  deletedSourceId: string | null;
};

async function installMocks(page: Page, importError?: string): Promise<CapturedRequests> {
  const captured: CapturedRequests = {
    importBytes: null,
    importContentType: undefined,
    originalFilename: undefined,
    edits: [],
    savedVersion: null,
    downloadedBytes: null,
    deletedSourceId: null,
  };
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: testEmail,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-10-14T12:00:00Z",
  };

  await page.route("**/auth/v1/token**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "mock-refresh-token",
        user,
      }),
    });
  });
  await page.route("**/auth/v1/user**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
  });
  await page.route("**/api/profile", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });
  await page.route("**/api/cv-imports", async (route) => {
    const request = route.request();
    captured.importBytes = request.postDataBuffer() ?? null;
    captured.importContentType = request.headers()["content-type"];
    captured.originalFilename = request.headers()["x-original-filename"];
    if (importError) {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ detail: { code: "invalid_pdf", message: importError } }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(importedCv),
    });
  });
  await page.route("**/api/cv-imports/*/edits", async (route) => {
    captured.edits.push(JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>);
    const result = captured.edits.length === 1
      ? { status: "needs_input", questions: ["¿En qué fecha comenzó?"] }
      : {
          status: "ready",
          proposedCv: editedCv,
          changedSections: ["experience"],
          changeSummary: "Se agregó la experiencia en Acme.",
        };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
  await page.route("**/api/cv-imports/*/versions", async (route) => {
    captured.savedVersion = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: savedResumeId,
        sourceId,
        parentResumeId: baseResumeId,
        createdAt: "2026-10-14T12:01:00Z",
        data: editedCv,
      }),
    });
  });
  await page.route("**/api/cv-imports/*/file", async (route) => {
    if (route.request().headers().authorization !== `Bearer ${accessToken}`) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: { code: "cv_source_not_found", message: "El CV importado no está disponible" } }),
      });
      return;
    }
    captured.downloadedBytes = originalPdf;
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: { "Content-Disposition": "attachment; filename*=UTF-8''ana.pdf" },
      body: originalPdf,
    });
  });
  await page.route(
    (url) => url.pathname === `/api/cv-imports/${sourceId}`,
    async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.fallback();
        return;
      }
      captured.deletedSourceId = sourceId;
      await route.fulfill({ status: 204 });
    },
  );
  return captured;
}

async function signIn(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Correo electrónico").fill(testEmail);
  await page.getByLabel("Contraseña").fill("mock-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/generate$/);
  const deferProfile = page.getByRole("button", { name: "Completar más tarde" });
  if (await deferProfile.isVisible()) await deferProfile.click();
  await expect(page.getByRole("region", { name: "Edita un CV existente" })).toBeVisible();
}

test.describe("Edición de CV existente desde PDF", () => {
  test("importa, propone, permite corregir, confirma y conserva el PDF original", async ({ page }) => {
    const captured = await installMocks(page);
    await signIn(page);

    await page.getByLabel("Selecciona el CV en PDF").setInputFiles({
      name: "ana.pdf",
      mimeType: "application/pdf",
      buffer: originalPdf,
    });
    await page.getByRole("button", { name: "Importar CV" }).click();
    await expect(page.getByRole("status")).toContainText("CV importado: ana.pdf");

    await page.getByRole("textbox", { name: "¿Qué quieres cambiar?" }).fill("Agrega mi experiencia en Acme");
    await page.getByRole("button", { name: "Proponer cambios" }).click();
    await page.getByLabel("¿En qué fecha comenzó?").fill("2022");
    await page.getByRole("button", { name: "Enviar respuestas" }).click();

    await expect(page.getByRole("region", { name: "Revisión de la propuesta" })).toBeVisible();
    await expect(page.getByTestId("cv-import-changed-sections")).toContainText("experiencia");
    await expect(page.getByRole("region", { name: "Vista previa del CV" })).toContainText("Acme");

    await page.getByRole("textbox", { name: "¿Qué quieres ajustar de esta propuesta?" })
      .fill("Aclara que desarrollé servicios internos para Acme");
    await page.getByRole("button", { name: "Proponer ajuste" }).click();
    await expect(page.getByRole("region", { name: "Revisión de la propuesta" })).toBeVisible();
    await page.getByRole("button", { name: "Guardar nueva versión" }).click();
    await expect(page.getByRole("status")).toContainText("Nueva versión guardada.");

    expect(captured.importContentType).toBe("application/pdf");
    expect(captured.originalFilename).toBe("ana.pdf");
    expect(captured.importBytes?.equals(originalPdf)).toBe(true);
    expect(captured.edits).toHaveLength(3);
    expect(captured.edits[2].currentCv).toEqual(editedCv);
    expect(captured.savedVersion).toMatchObject({ baseResumeId, data: editedCv });

    await page.getByRole("button", { name: "Descargar PDF original" }).click();
    await expect(page.getByRole("status")).toContainText("PDF original descargado.");
    expect(captured.downloadedBytes?.equals(originalPdf)).toBe(true);

    const otherUserStatus = await page.evaluate(async (id) => {
      const response = await fetch(`/api/cv-imports/${id}/file`, {
        headers: { Authorization: "Bearer mock-access-other" },
      });
      return response.status;
    }, sourceId);
    expect(otherUserStatus).toBe(404);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Eliminar CV importado" }).click();
    await expect(page.getByRole("status")).toContainText("Fuente eliminada.");
    expect(captured.deletedSourceId).toBe(sourceId);
    await expect(page.getByLabel("Selecciona el CV en PDF")).toBeVisible();
  });

  test("muestra un error recuperable cuando el PDF no contiene texto extraíble", async ({ page }) => {
    await installMocks(page, "El PDF no contiene texto extraíble");
    await signIn(page);

    await page.getByLabel("Selecciona el CV en PDF").setInputFiles({
      name: "escaneado.pdf",
      mimeType: "application/pdf",
      buffer: originalPdf,
    });
    await page.getByRole("button", { name: "Importar CV" }).click();

    await expect(page.getByTestId("cv-import-error")).toContainText("El PDF no contiene texto extraíble");
    await expect(page.getByLabel("Selecciona el CV en PDF")).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar CV" })).toBeEnabled();
  });
});
