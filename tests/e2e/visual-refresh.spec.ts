import { expect, test } from "@playwright/test";

for (const width of [375, 768, 1440]) {
  test(`acceso legible y operable a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/auth");
    await expect(page.getByTestId("auth-introduction")).toBeVisible();
    await expect(page.getByTestId("auth-email")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByTestId("auth-sign-up-tab").click();
    await expect(page.getByTestId("auth-submit")).toHaveText("Crear cuenta");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-error")).toHaveText("Introduce tu correo y contraseña.");
    await page.getByTestId("auth-sign-in-tab").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("auth-email")).toBeFocused();
    expect(await page.getByTestId("auth-email").evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  });
}

test.describe("Formulario sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("mantiene credenciales fuera de la URL", async ({ page }) => {
    let posted = false;
    await page.route("**/auth", (route) => {
      if (route.request().method() === "POST") {
        posted = true;
        return route.fulfill({ status: 200, contentType: "text/html", body: "<p>JavaScript requerido</p>" });
      }
      return route.continue();
    });
    await page.goto("/auth");
    await page.getByTestId("auth-email").fill("ana@example.test");
    await page.getByTestId("auth-password").fill("synthetic-password");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("JavaScript requerido")).toBeVisible();
    expect(posted).toBe(true);
    expect(page.url()).not.toContain("password=");
    expect(page.url()).not.toContain("email=");
  });
});
