import { expect, test, type Page } from "@playwright/test";

const owner = "00000000-0000-0000-0000-000000000001";
const firstId = "00000000-0000-0000-0000-000000000101";
const secondId = "00000000-0000-0000-0000-000000000102";
const user = { id: owner, email: "ana@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, aud: "authenticated", created_at: new Date().toISOString() };
const profile = { fullName: "Ana García", email: "ana@example.test", phone: "", location: "", linkedin: "", website: "", photoPath: null };
const credential = (id: string, name: string) => ({ id, originalFilename: `${name}.pdf`, mimeType: "application/pdf", fileSizeBytes: 32, status: "ready", certification: { name, issuer: "Academia", issueDate: "2025", expirationDate: "", credential: id }, language: null, createdAt: "2026-10-31T12:00:00Z", duplicate: false });

async function prepare(page: Page) {
  const certificates = [credential(firstId, "Curso inicial")];
  const requests: string[][] = [];
  await page.route("**/auth/v1/token**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "synthetic-certificate-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "synthetic-certificate-refresh", user }) }));
  await page.route("**/auth/v1/user**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));
  await page.route("**/api/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) }));
  await page.route("**/api/profile/certificates?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: certificates, offset: 0, limit: 50, hasMore: false }) }));
  await page.route("**/api/profile/certificates", (route) => {
    const added = credential(secondId, "Curso nuevo");
    certificates.push(added);
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(added) });
  });
  await page.route("**/api/generate-cv", (route) => {
    const ids = (route.request().postDataJSON() as { selectedCertificateIds: string[] }).selectedCertificateIds;
    requests.push(ids);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      personalInfo: profile, summary: "Diseñadora", experience: [], education: [], skills: { hard: [], soft: [] }, languages: [],
      certifications: ids.map((id) => certificates.find((item) => item.id === id)!.certification),
      certificateMergeReport: { addedIds: ids, duplicateIds: [], pendingIds: [] },
    }) });
  });
  await page.goto("/auth");
  await page.getByTestId("auth-email").fill(user.email);
  await page.getByTestId("auth-password").fill("synthetic-password");
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/generate$/);
  return requests;
}

test("selecciona certificados existentes y marca una carga nueva antes de generar", async ({ page }) => {
  const requests = await prepare(page);
  const first = page.getByTestId(`certificate-checkbox-${firstId}`);
  await expect(first).toBeVisible();
  await expect(first).not.toBeChecked();
  await page.getByTestId("certificate-files").setInputFiles({ name: "nuevo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-test") });
  await expect(page.getByTestId(`certificate-checkbox-${secondId}`)).toBeChecked();
  await page.getByTestId("certificate-select-all").click();
  await expect(first).toBeChecked();
  await first.uncheck();
  await page.getByTestId("professional-text").fill("Diseñadora con experiencia.");
  await page.getByTestId("generate-submit").click();
  await expect(page.getByTestId("certificate-merge-report")).toContainText("1 certificados agregados");
  expect(requests).toEqual([[secondId]]);
  await expect(page.getByTestId(`certificate-checkbox-${secondId}`)).not.toBeChecked();
});
