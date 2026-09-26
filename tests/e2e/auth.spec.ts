import { expect, test } from "@playwright/test";

const signupEmail = process.env.E2E_SIGNUP_EMAIL;
const signupPassword = process.env.E2E_SIGNUP_PASSWORD;
const validEmail = process.env.E2E_EMAIL;
const validPassword = process.env.E2E_PASSWORD;

function getSignupCredentials() {
  if (!signupEmail || !signupPassword) {
    throw new Error("Configura E2E_SIGNUP_EMAIL y E2E_SIGNUP_PASSWORD con un correo válido para registro");
  }

  return { email: signupEmail, password: signupPassword };
}

function getValidCredentials() {
  if (!validEmail || !validPassword) {
    throw new Error("Configura E2E_EMAIL y E2E_PASSWORD con una cuenta Supabase confirmada");
  }

  return { email: validEmail, password: validPassword };
}

test.describe("Autenticación", () => {
  test("permite crear una cuenta con correo y contraseña", async ({ page }) => {
    const credentials = getSignupCredentials();
    await page.goto("/auth");
    await page.getByRole("tab", { name: "Crear cuenta" }).click();
    await page.getByLabel("Correo electrónico").fill(credentials.email);
    await page.getByLabel("Contraseña").fill(credentials.password);
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-message")).toContainText("Cuenta creada");
  });

  test("permite iniciar sesión con credenciales válidas", async ({ page }) => {
    const credentials = getValidCredentials();
    await page.goto("/auth");
    await page.getByLabel("Correo electrónico").fill(credentials.email);
    await page.getByLabel("Contraseña").fill(credentials.password);
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL(/\/generate$/);
    await expect(page.getByTestId("protected-content")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toBeVisible();
  });

  test("muestra un error para credenciales inválidas", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("Correo electrónico").fill("invalid@example.com");
    await page.getByLabel("Contraseña").fill("wrong-password");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("restaura la sesión al recargar el flujo privado", async ({ page }) => {
    const credentials = getValidCredentials();
    await page.goto("/auth");
    await page.getByLabel("Correo electrónico").fill(credentials.email);
    await page.getByLabel("Contraseña").fill(credentials.password);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("protected-content")).toBeVisible();

    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toBeVisible();

    await page.reload();

    await expect(page.getByTestId("protected-content")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Completa tu perfil básico" })).toBeVisible();
  });

  test("cierra la sesión y vuelve a bloquear el flujo privado", async ({ page }) => {
    const credentials = getValidCredentials();
    await page.goto("/auth");
    await page.getByLabel("Correo electrónico").fill(credentials.email);
    await page.getByLabel("Contraseña").fill(credentials.password);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("protected-content")).toBeVisible();

    const deferProfile = page.getByRole("button", { name: "Completar más tarde" });
    if (await deferProfile.isVisible()) {
      await deferProfile.click();
    }

    await page.getByTestId("auth-sign-out").click();

    await expect(page).toHaveURL(/\/auth\?reason=session-expired$/);
  });
});
