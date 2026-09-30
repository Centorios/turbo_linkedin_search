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
