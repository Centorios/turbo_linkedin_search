import { expect, test } from "@playwright/test";

// The Next.js default pages are in English; the app replaces them.
test("una página que no existe se muestra en español", async ({ page }) => {
  const response = await page.goto("/esta-pagina-no-existe");

  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  await expect(page.getByText("This page could not be found")).toHaveCount(0);
  await page.getByTestId("not-found-home").click();
  await expect(page).toHaveURL(/\/(generate|auth)/);
});

test("el documento declara español rioplatense", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
});
