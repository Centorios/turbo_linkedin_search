import { expect, test, type Page } from "@playwright/test";

const testUser = {
  id: "job-match-user",
  email: "ana@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const jobListing = {
  id: "jooble:python",
  title: "Desarrolladora Python",
  company: "Acme",
  location: "Argentina",
  snippet: "Python y FastAPI",
  url: "https://example.test/oferta-python",
  source: "Jooble",
  updatedAt: null,
};

const matchResult = {
  resumeChanged: false,
  completedAt: "2026-10-08T12:00:00Z",
  recommendations: [
    {
      rank: 1,
      offerId: jobListing.id,
      title: jobListing.title,
      company: jobListing.company,
      location: jobListing.location,
      url: jobListing.url,
      affinity: "Alta",
      summary: "Tu experiencia coincide con el puesto.",
      matches: ["Python"],
      unmetRequirements: ["Experiencia con Kubernetes"],
      missingInfo: [],
    },
  ],
};

type MatchMode = "delayed" | "success" | "fail-once";

async function configureMocks(page: Page, matchMode: MatchMode) {
  const state = { matchAttempts: 0, savedMatchReads: 0, searchRequests: 0 };
  const fulfillJson = (route: Parameters<Parameters<Page["route"]>[1]>[0], status: number, body: unknown) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/auth/v1/token**", async (route) => {
    const now = Math.floor(Date.now() / 1000);
    await fulfillJson(route, 200, {
      access_token: "synthetic-job-match-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: "synthetic-job-match-refresh",
      user: testUser,
    });
  });
  await page.route("**/auth/v1/user**", (route) => fulfillJson(route, 200, testUser));
  await page.route("**/health", (route) => fulfillJson(route, 200, { status: "ok" }));
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();

    if (pathname === "/api/profile" && method === "GET") {
      await fulfillJson(route, 200, null);
      return;
    }
    if (pathname === "/api/resumes" && method === "GET") {
      await fulfillJson(route, 200, {
        items: [
          {
            id: "resume-python",
            createdAt: "2026-10-07T12:00:00Z",
            fullName: "Ana García",
            summary: "Desarrolladora Python",
          },
        ],
        offset: 0,
        limit: 20,
        hasMore: false,
      });
      return;
    }
    if (pathname === "/api/jobs/search-profile/resume-python" && method === "GET") {
      await fulfillJson(route, 200, {
        resumeId: "resume-python",
        suggestedKeywords: "Desarrolladora Python",
        suggestedLocation: "Argentina",
        skills: ["Python"],
      });
      return;
    }
    if (pathname === "/api/jobs/search" && method === "POST") {
      state.searchRequests += 1;
      await fulfillJson(route, 200, { searchId: "search-python", items: [jobListing] });
      return;
    }
    if (pathname === "/api/jobs/match/search-python" && method === "GET") {
      state.savedMatchReads += 1;
      if (state.matchAttempts > 0) {
        await fulfillJson(route, 200, matchResult);
      } else {
        await fulfillJson(route, 404, { detail: { message: "No hay recomendaciones guardadas." } });
      }
      return;
    }
    if (pathname === "/api/jobs/match" && method === "POST") {
      state.matchAttempts += 1;
      if (matchMode === "fail-once" && state.matchAttempts === 1) {
        await fulfillJson(route, 503, {
          detail: { message: "El servicio de Match está temporalmente no disponible." },
        });
        return;
      }
      if (matchMode === "delayed") {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      await fulfillJson(route, 200, matchResult);
      return;
    }

    await fulfillJson(route, 404, { detail: { message: "Ruta de prueba no configurada." } });
  });

  return state;
}

async function openJobs(page: Page, matchMode: MatchMode = "success") {
  const state = await configureMocks(page, matchMode);
  await page.goto("/auth");
  await page.getByLabel("Correo electrónico").fill(testUser.email);
  await page.getByLabel("Contraseña").fill("synthetic-password");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/generate$/);
  const profileDialog = page.getByRole("dialog", { name: "Completa tu perfil básico" });
  await expect(profileDialog).toBeVisible();
  await profileDialog.getByRole("button", { name: "Completar más tarde" }).click();
  await page.getByRole("link", { name: "Empleos" }).click();
  await expect(
    page.getByRole("region", { name: "Preparar búsqueda" }).getByRole("button", { name: "Buscar empleos" }),
  ).toBeVisible();
  return state;
}

async function searchOffers(page: Page) {
  await page.getByRole("region", { name: "Preparar búsqueda" }).getByRole("button", { name: "Buscar empleos" }).click();
  await expect(
    page.getByRole("region", { name: "Ofertas laborales" }).getByRole("heading", { name: jobListing.title }),
  ).toBeVisible();
}

async function runMatch(page: Page) {
  const matchPanel = page.getByRole("region", { name: "Recomendaciones Match" });
  await matchPanel.getByRole("button", { name: "Match", exact: true }).click();
  return matchPanel;
}

test.describe("Recomendaciones Match en empleos", () => {
  test("muestra la carga y las recomendaciones del análisis", async ({ page }) => {
    await openJobs(page, "delayed");
    await searchOffers(page);

    const matchPanel = await runMatch(page);

    await expect(matchPanel.getByRole("status")).toHaveText("Analizando…");
    await expect(matchPanel.getByRole("status")).toHaveText("Análisis completado.");
    await expect(matchPanel.getByRole("heading", { name: jobListing.title })).toBeVisible();
    await expect(matchPanel).toContainText("Afinidad Alta");
    await expect(matchPanel).toContainText("Experiencia con Kubernetes");
  });

  test("permite reintentar Match después de un error recuperable", async ({ page }) => {
    await openJobs(page, "fail-once");
    await searchOffers(page);
    const matchPanel = await runMatch(page);

    await expect(matchPanel.getByRole("alert")).toHaveText(
      "El servicio de Match está temporalmente no disponible.",
    );
    await matchPanel.getByRole("button", { name: "Reintentar" }).click();

    await expect(matchPanel.getByRole("status")).toHaveText("Análisis completado.");
    await expect(matchPanel.getByRole("heading", { name: jobListing.title })).toBeVisible();
  });

  test("restaura las ofertas y las recomendaciones guardadas al recargar", async ({ page }) => {
    const state = await openJobs(page);
    await searchOffers(page);
    const matchPanel = await runMatch(page);
    await expect(matchPanel.getByRole("status")).toHaveText("Análisis completado.");
    await expect(matchPanel.getByRole("heading", { name: jobListing.title })).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole("region", { name: "Ofertas laborales" }).getByRole("heading", { name: jobListing.title }),
    ).toBeVisible();
    const restoredPanel = page.getByRole("region", { name: "Recomendaciones Match" });
    await expect(restoredPanel.getByRole("status")).toHaveText("Análisis completado.");
    await expect(restoredPanel.getByRole("heading", { name: jobListing.title })).toBeVisible();
    await expect.poll(() => state.savedMatchReads).toBeGreaterThan(1);
    expect(state.searchRequests).toBe(1);
  });

  test("abre la oferta recomendada en una pestaña nueva", async ({ page }) => {
    await openJobs(page);
    await page.context().route("https://example.test/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<title>Oferta</title>" }),
    );
    await searchOffers(page);
    const matchPanel = await runMatch(page);
    await expect(matchPanel.getByRole("status")).toHaveText("Análisis completado.");

    const offerLink = matchPanel.getByRole("link", { name: "Ver oferta" });
    await expect(offerLink).toHaveAttribute("target", "_blank");
    await expect(offerLink).toHaveAttribute("rel", "noopener noreferrer");
    const popupPromise = page.waitForEvent("popup");
    await offerLink.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(jobListing.url);
  });
});
