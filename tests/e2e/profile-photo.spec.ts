import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Chromium's fake camera produces a test pattern, so no real device is needed.
// launchOptions cannot be set inside a describe, so this applies to the whole file;
// it only matters to the tests that open the camera. The configured executable is kept.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
test.use({
  permissions: ["camera"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
  },
});
import { pdfHasImage, readPreviewPdf } from "./pdf-preview";

const userId = "00000000-0000-0000-0000-000000000001";
const storedPhotoPath = `${userId}/00000000-0000-0000-0000-000000000002.png`;
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

type BasicProfile = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  photoPath?: string | null;
};

const emptyProfile: BasicProfile = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  website: "",
  photoPath: null,
};

const generatedCv = {
  personalInfo: { ...emptyProfile, fullName: "Ana García", email: "ana@example.com", photoPath: storedPhotoPath },
  summary: "Product designer con experiencia en productos digitales.",
  experience: [],
  education: [],
  skills: { hard: ["Figma"], soft: [] },
  languages: [],
  certifications: [],
};

async function installMocks(page: Page, initialProfile: BasicProfile | null = null) {
  let profile = initialProfile;
  const uploads: string[] = [];
  const deletions: string[] = [];

  await page.route("**/auth/v1/token**", async (route) => {
    const now = Math.floor(Date.now() / 1000);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: `synthetic-photo-${userId}`,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: "synthetic-photo-refresh",
        user: {
          id: userId,
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

  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PUT") {
      profile = route.request().postDataJSON() as BasicProfile;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) });
  });
  await page.route("**/api/generate-cv", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(generatedCv) }),
  );

  await page.route("**/storage/v1/object/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("/object/sign/")) {
      if (request.method() === "POST") {
        const path = pathname.split("/object/sign/profile-photos/")[1];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ signedURL: `/object/sign/profile-photos/${path}?token=synthetic` }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: "image/png", body: tinyPng });
      }
      return;
    }

    const path = pathname.split("/object/profile-photos/")[1];
    if (request.method() === "POST") {
      uploads.push(path);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ Id: "synthetic-object-id", Key: `profile-photos/${path}` }),
      });
      return;
    }
    if (request.method() === "DELETE") {
      const payload = request.postDataJSON() as { prefixes: string[] };
      deletions.push(...payload.prefixes);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  return {
    get profile() { return profile; },
    uploads,
    deletions,
  };
}

async function signIn(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Correo electrónico").fill("ana@example.test");
  await page.getByLabel("Contraseña").fill("synthetic-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/generate$/);
}

test.describe("Foto de perfil opcional", () => {
  test("sube, conserva, vuelve a mostrar y permite quitar la foto", async ({ page }) => {
    const mocks = await installMocks(page);
    await signIn(page);

    await expect(page.getByRole("dialog", { name: "Completá tu perfil básico" })).toBeVisible();
    await page.getByLabel("Nombre completo").fill("Ana García");
    await page.getByLabel("Foto de perfil (opcional)").setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: tinyPng,
    });
    await expect(page.getByTestId("profile-photo-preview")).toBeVisible();
    await page.getByRole("button", { name: "Guardar perfil" }).click();

    await expect(page.getByRole("dialog", { name: "Completá tu perfil básico" })).toHaveCount(0);
    expect(mocks.uploads).toHaveLength(1);
    expect(mocks.profile?.photoPath).toMatch(new RegExp(`^${userId}/[0-9a-f-]+\\.png$`));

    await page.getByRole("button", { name: "Editar perfil" }).click();
    await expect(page.getByTestId("profile-photo-preview")).toBeVisible();
    await page.getByRole("button", { name: "Quitar foto" }).click();
    await expect(page.getByTestId("profile-photo-preview")).toHaveCount(0);
    await page.getByRole("button", { name: "Guardar perfil" }).click();

    await expect(page.getByRole("dialog", { name: "Editar perfil" })).toHaveCount(0);
    expect(mocks.profile?.photoPath).toBeNull();
    expect(mocks.deletions).toEqual([mocks.uploads[0]]);
  });

  test("rechaza formatos no permitidos y archivos mayores a 5 MB", async ({ page }) => {
    const mocks = await installMocks(page);
    await signIn(page);

    const input = page.getByLabel("Foto de perfil (opcional)");
    await input.setInputFiles({ name: "foto.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg />") });
    await expect(page.getByTestId("profile-photo-error")).toContainText("JPEG, PNG o WebP");

    await input.setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    await expect(page.getByTestId("profile-photo-error")).toContainText("5 MB o menos");
    expect(mocks.uploads).toHaveLength(0);
  });

  test("muestra la foto solo en la plantilla creativa y la incluye en el PDF", async ({ page }) => {
    const profile = { ...emptyProfile, fullName: "Ana García", email: "ana@example.com", photoPath: storedPhotoPath };
    await installMocks(page, profile);
    await signIn(page);

    await page.getByLabel("Biografía o experiencia profesional").fill("Ana trabaja en diseño de productos digitales.");
    await page.getByRole("button", { name: "Generar CV" }).click();
    expect(pdfHasImage(await readPreviewPdf(page))).toBe(false);

    await page.getByTestId("template-creative").click();
    await expect.poll(async () => pdfHasImage(await readPreviewPdf(page))).toBe(true);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("pdf-download").click(),
    ]);
    const pdfPath = await download.path();
    expect(pdfPath).not.toBeNull();
    const pdfBytes = readFileSync(pdfPath!);
    expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfBytes.toString("latin1")).toContain("/Subtype /Image");
  });
});

test.describe("Foto de perfil con la cámara", () => {
  test("toma una foto con la cámara y la guarda como foto de perfil", async ({ page }) => {
    const mocks = await installMocks(page);
    await signIn(page);

    await expect(page.getByRole("dialog", { name: "Completá tu perfil básico" })).toBeVisible();
    await expect(page.getByTestId("profile-photo-browse")).toHaveText("Buscar");
    await page.getByLabel("Nombre completo").fill("Ana García");

    await page.getByTestId("profile-photo-camera-open").click();
    await expect(page.getByTestId("camera-take-photo")).toBeEnabled();
    await page.getByTestId("camera-take-photo").click();

    await expect(page.getByTestId("profile-photo-camera")).toHaveCount(0);
    await expect(page.getByTestId("profile-photo-preview")).toBeVisible();
    await expect(page.getByTestId("profile-photo-filename")).toHaveText("Foto de la cámara");
    await page.getByRole("button", { name: "Guardar perfil" }).click();

    await expect(page.getByRole("dialog", { name: "Completá tu perfil básico" })).toHaveCount(0);
    expect(mocks.uploads).toHaveLength(1);
    expect(mocks.profile?.photoPath).toMatch(new RegExp(`^${userId}/[0-9a-f-]+\\.jpg$`));
  });

  test("cancelar la cámara no agrega foto y Escape no cierra el diálogo", async ({ page }) => {
    const mocks = await installMocks(page);
    await signIn(page);

    await page.getByTestId("profile-photo-camera-open").click();
    await expect(page.getByTestId("camera-take-photo")).toBeEnabled();
    await page.keyboard.press("Escape");

    await expect(page.getByTestId("profile-photo-camera")).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Completá tu perfil básico" })).toBeVisible();
    await expect(page.getByTestId("profile-photo-preview")).toHaveCount(0);
    expect(mocks.uploads).toHaveLength(0);
  });
});

test.describe("Foto de perfil sin permiso de cámara", () => {
  test("explica que falta el permiso y deja elegir un archivo", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await installMocks(page);
    await signIn(page);

    await page.getByTestId("profile-photo-camera-open").click();

    await expect(page.getByTestId("camera-error")).toContainText("No diste permiso para usar la cámara");
    await page.getByLabel("Foto de perfil (opcional)").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: tinyPng });
    await expect(page.getByTestId("profile-photo-preview")).toBeVisible();
  });
});
