import { expect, test, type Page } from "@playwright/test";

type BasicProfile = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
};

type UserProfileStore = Map<string, BasicProfile>;

const validProfile: BasicProfile = {
  fullName: "Ana García",
  email: "ana.cv@example.com",
  phone: "+34 600 000 000",
  location: "Madrid",
  linkedin: "https://www.linkedin.com/in/ana-garcia",
  website: "https://ana.example.com",
};

async function installSupabaseMocks(
  page: Page,
  profiles: UserProfileStore = new Map(),
  options: { profileReadFailures?: number } = {},
) {
  let profileReadFailures = options.profileReadFailures ?? 0;
  let profileWriteCount = 0;

  await page.route("**/auth/v1/token**", async (route) => {
    const credentials = route.request().postDataJSON() as { email: string };
    const userId = credentials.email === "beatriz@example.test" ? "user-b" : "user-a";
    const accessToken = `synthetic-access-${userId}`;
    const now = Math.floor(Date.now() / 1000);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: `synthetic-refresh-${userId}`,
        user: {
          id: userId,
          email: credentials.email,
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
    const method = route.request().method();
    const accessToken = route.request().headers().authorization?.replace(/^Bearer /, "") ?? "";

    if (method === "GET" && profileReadFailures > 0) {
      profileReadFailures -= 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: { code: "profile_read_failed", message: "No se pudo cargar el perfil" } }),
      });
      return;
    }

    if (method === "PUT") {
      profileWriteCount += 1;
      const profile = route.request().postDataJSON() as BasicProfile;
      profiles.set(accessToken, profile);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) });
      return;
    }

    const profile = profiles.get(accessToken) ?? null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) });
  });

  return {
    get profileWriteCount() {
      return profileWriteCount;
    },
  };
}

async function signIn(page: Page, email = "ana@example.test") {
  await page.goto("/auth");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill("synthetic-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/generate$/);
}

async function fillProfile(page: Page, profile: BasicProfile = validProfile) {
  await page.getByLabel("Nombre completo").fill(profile.fullName);
  await page.getByLabel("Correo para el CV").fill(profile.email);
  await page.getByLabel("Teléfono").fill(profile.phone);
  await page.getByLabel("Ubicación").fill(profile.location);
  await page.getByLabel("Perfil de LinkedIn").fill(profile.linkedin);
  await page.getByLabel("Sitio web").fill(profile.website);
}

test.describe("Perfil básico después del inicio de sesión", () => {
  test("ofrece el diálogo a una cuenta sin perfil guardado", async ({ page }) => {
    await installSupabaseMocks(page);
    await signIn(page);

    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toBeVisible();
    await expect(page.getByLabel("Correo para el CV")).toHaveValue("ana@example.test");
  });

  test("valida nombre, correo y enlaces antes de enviar", async ({ page }) => {
    const mocks = await installSupabaseMocks(page);
    await signIn(page);
    await page.getByLabel("Nombre completo").fill("   ");
    await page.getByLabel("Correo para el CV").fill("correo-invalido");
    await page.getByLabel("Perfil de LinkedIn").fill("ftp://example.com");
    await page.getByRole("button", { name: "Guardar perfil" }).click();

    await expect(page.getByText("Introduce tu nombre completo.")).toBeVisible();
    await expect(page.getByText("Introduce un correo válido o deja el campo vacío.")).toBeVisible();
    await expect(page.getByText("Usa una dirección que empiece por http:// o https://.")).toBeVisible();
    expect(mocks.profileWriteCount).toBe(0);
  });

  test("guarda los seis campos y no vuelve a mostrar el diálogo al recargar", async ({ page }) => {
    await installSupabaseMocks(page);
    await signIn(page);
    await fillProfile(page);
    await page.getByRole("button", { name: "Guardar perfil" }).click();

    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("protected-content")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toHaveCount(0);
  });

  test("permite posponer sin escribir y vuelve a ofrecer el diálogo al iniciar sesión", async ({ page }) => {
    const mocks = await installSupabaseMocks(page);
    await signIn(page);
    await page.getByRole("button", { name: "Completar más tarde" }).click();

    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toHaveCount(0);
    expect(mocks.profileWriteCount).toBe(0);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/auth/);
    await signIn(page);
    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toBeVisible();
  });

  test("mantiene los perfiles aislados al cambiar de cuenta en el mismo navegador", async ({ page }) => {
    const profiles = new Map<string, BasicProfile>();
    await installSupabaseMocks(page, profiles);
    await signIn(page);
    await fillProfile(page, { ...validProfile, fullName: "Ana de la cuenta A" });
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/auth/);
    await signIn(page, "beatriz@example.test");

    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toBeVisible();
    await expect(page.getByLabel("Nombre completo")).toHaveValue("");
    expect([...profiles.values()].map((profile) => profile.fullName)).toEqual(["Ana de la cuenta A"]);
  });

  test("distingue un fallo de lectura de un perfil ausente y permite reintentar", async ({ page }) => {
    await installSupabaseMocks(page, new Map(), { profileReadFailures: 1 });
    await signIn(page);

    await expect(page.getByRole("alert")).toContainText("No se pudo cargar el perfil");
    await expect(page.getByRole("button", { name: "Generar CV" })).toBeDisabled();
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toBeVisible();
  });
});
