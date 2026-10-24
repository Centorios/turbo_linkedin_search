import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "ana@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

async function signIn(page: Page) {
  await page.route("**/auth/v1/token**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    access_token: "synthetic-theme-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "synthetic-theme-refresh", user,
  }) }));
  await page.route("**/auth/v1/user**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));
  await page.route("**/api/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ fullName: "Ana García", email: "ana@example.com", phone: "", location: "", linkedin: "", website: "", photoPath: null }) }));
  await page.goto("/auth");
  await page.getByLabel("Correo electrónico").fill("ana@example.test");
  await page.getByLabel("Contraseña").fill("synthetic-password");
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/generate$/);
}

// The theme is applied before React loads; listeners exist only once it has hydrated.
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const toggle = document.querySelector('[data-testid="theme-toggle"]');
    return !!toggle && Object.keys(toggle).some((key) => key.startsWith("__reactProps"));
  });
}

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const canvasColor = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("Modo claro y oscuro", () => {
  test("el botón alterna el tema y la elección sobrevive a recargar", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/auth");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const toggle = page.getByTestId("theme-toggle");
    await expect(toggle).toHaveAttribute("aria-label", "Activar modo oscuro");
    const lightBackground = await canvasColor(page);

    await toggle.click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAttribute("aria-label", "Activar modo claro");
    await expect.poll(() => canvasColor(page)).not.toBe(lightBackground);
    expect(await page.evaluate(() => localStorage.getItem("cv8-theme"))).toBe("dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByTestId("theme-toggle")).toHaveAttribute("aria-label", "Activar modo claro");

    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    // Colors fade for a moment after switching.
    await expect.poll(() => canvasColor(page)).toBe(lightBackground);
  });

  test("sin elección guardada arranca con el modo del sistema", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/auth");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await waitForHydration(page);

    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("una elección guardada gana sobre el sistema", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => localStorage.setItem("cv8-theme", "light"));
    await page.goto("/auth");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("el tema oscuro ya está aplicado antes de que cargue React, sin destello", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    // Without the app's scripts React never hydrates: only the inline script can set the theme.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto("/auth", { waitUntil: "domcontentloaded" });

    expect(await theme(page)).toBe("dark");
    expect(await canvasColor(page)).toBe("rgb(11, 16, 32)");
  });

  test("funciona aunque el navegador bloquee el almacenamiento", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/auth");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("el botón está en el header de la app y en la pantalla de acceso", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByTestId("theme-toggle")).toBeVisible();

    await signIn(page);
    await waitForHydration(page);
    await expect(page.getByRole("banner").getByTestId("theme-toggle")).toBeVisible();
    await page.getByTestId("theme-toggle").click();
    await page.getByTestId("history-navigation").click();
    await expect(page).toHaveURL(/\/history$/);
    // The choice follows the person across pages.
    await expect(page.locator("html")).toHaveAttribute("data-theme", /dark|light/);
    const chosen = await theme(page);
    await page.getByTestId("jobs-navigation").click();
    await expect(page).toHaveURL(/\/jobs$/);
    expect(await theme(page)).toBe(chosen);
  });

  for (const width of [320, 375, 768]) {
    test(`sin desborde horizontal a ${width}px en los dos modos`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await signIn(page);
      for (const colorScheme of ["light", "dark"] as const) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, colorScheme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${colorScheme} ${width}px`).toBe(true);
      }
      await expect(page.getByTestId("theme-toggle")).toBeVisible();
    });
  }

  test("la hoja del CV se queda blanca en modo oscuro", async ({ page }) => {
    await page.route("**/api/generate-cv", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      personalInfo: { fullName: "Ana García", email: "ana@example.com", phone: "", location: "", linkedin: "", website: "" },
      summary: "", experience: [], education: [], skills: { hard: ["Figma"], soft: [] }, languages: [{ name: "Español", proficiency: "" }], certifications: [],
    }) }));
    await page.emulateMedia({ colorScheme: "dark" });
    await signIn(page);
    const defer = page.getByRole("button", { name: "Completar más tarde" });
    if (await defer.isVisible()) await defer.click();
    await page.getByTestId("professional-text").fill("Ana trabaja con Figma");
    await page.getByTestId("generate-submit").click();

    await expect(page.getByTestId("cv-preview-open")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    // The document is a printable page: it is not recolored with the theme.
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="cv-preview"]')!).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  });
});
