import { expect, test } from "@playwright/test";

test.describe("Acceso con Google y Microsoft", () => {
  for (const { label, provider } of [
    { label: "Google", provider: "google" },
    { label: "Microsoft", provider: "azure" },
  ]) {
    test(`inicia ${label} con PKCE y retorno a la aplicación`, async ({ page }) => {
      await page.route("**/auth/v1/authorize**", (route) => route.fulfill({
        status: 200, contentType: "text/html; charset=utf-8", body: "<h1>Proveedor simulado</h1>",
      }));
      await page.goto("/auth");
      await expect(page.getByRole("button", { name: `Continuar con ${label}` })).toBeVisible();
      const origin = new URL(page.url()).origin;
      const authorization = page.waitForRequest("**/auth/v1/authorize**");

      await page.getByRole("button", { name: `Continuar con ${label}` }).click();

      const url = new URL((await authorization).url());
      expect(url.searchParams.get("provider")).toBe(provider);
      expect(url.searchParams.get("redirect_to")).toBe(`${origin}/auth/callback`);
      expect(url.searchParams.get("code_challenge_method")).toBe("s256");
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      expect(url.searchParams.get("scopes")).toBe(provider === "azure" ? "email" : null);
    });
  }

  test("conserva ambos proveedores al cambiar a registro", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("tab", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar con Microsoft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear cuenta", exact: true })).toBeVisible();
  });

  test("una cancelación muestra error seguro y permite reintentar", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied&error_description=untrusted-test-text");
    await expect(page).toHaveURL(/\/auth\?reason=oauth-error$/);
    await expect(page.getByTestId("auth-error")).toContainText("No se pudo completar");
    await expect(page.getByTestId("auth-error")).not.toContainText("untrusted-test-text");
    await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Continuar con Microsoft" })).toBeEnabled();
  });

  test("un retorno sin código no abre el generador ni acepta destinos externos", async ({ page }) => {
    await page.goto("/auth/callback?next=https://external.example");
    await expect(page).toHaveURL(/\/auth\?reason=oauth-error$/);
    await expect(page.getByTestId("auth-error")).toBeVisible();
  });

  test("una falla local al iniciar informa el problema y habilita los botones", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(crypto.subtle, "digest", {
        configurable: true,
        value: () => Promise.reject(new Error("simulated crypto failure")),
      });
    });
    await page.goto("/auth");
    await page.getByRole("button", { name: "Continuar con Google" }).click();
    await expect(page.getByTestId("auth-error")).toContainText("No se pudo iniciar sesión con Google");
    await expect(page.getByRole("button", { name: "Continuar con Microsoft" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeEnabled();
  });

  test("bloquea acciones concurrentes mientras se prepara la autorización", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(crypto.subtle, "digest", {
        configurable: true, value: () => new Promise(() => {}),
      });
    });
    await page.goto("/auth");
    await page.getByRole("button", { name: "Continuar con Google" }).click();
    await expect(page.getByRole("button", { name: "Continuar con Microsoft" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Iniciar sesión", exact: true })).toBeDisabled();
    await expect(page.getByRole("tab", { name: "Crear cuenta" })).toBeDisabled();
  });
});
