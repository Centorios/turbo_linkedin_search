import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JobsPage from "../app/jobs/page";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "user-a" } } as { user: { id: string } } | null,
  list: vi.fn(), profile: vi.fn(), search: vi.fn(), warm: vi.fn(), status: vi.fn(), retry: vi.fn(),
  match: {
    result: { recommendations: [{ rank: 1 }] },
    status: "success",
    error: null,
    loadingSavedResult: false,
    busy: false,
    runMatch: vi.fn(),
  },
}));

vi.mock("../app/auth/session-provider", () => ({ useSession: () => ({ session: mocks.session, isLoading: false }) }));
vi.mock("../app/lib/resume-history-client", () => ({ listResumes: mocks.list }));
vi.mock("../app/lib/jobs-client", () => ({
  getSearchProfile: mocks.profile,
  searchJobs: mocks.search,
  warmBackend: mocks.warm,
  getSearchStatus: mocks.status,
  retryLinkedIn: mocks.retry,
}));
vi.mock("../app/components/app-header", () => ({ AppHeader: () => <header>CV8</header> }));
vi.mock("../app/jobs/MatchPanel", () => ({
  useMatchController: () => mocks.match,
  MatchPanel: () => <section aria-label="Recomendaciones Match">Match</section>,
  MatchResults: () => (
    <section aria-label="Mejores coincidencias de Match" data-testid="match-results">
      Coincidencias Match
    </section>
  ),
}));

const item = { id: "resume-a", createdAt: "2026-10-07T12:00:00Z", fullName: "Ana", summary: "Python" };
const profile = { resumeId: "resume-a", suggestedKeywords: "Desarrollador backend", suggestedLocation: "Buenos Aires", skills: ["Python"] };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = { user: { id: "user-a" } };
  mocks.list.mockResolvedValue({ items: [item], offset: 0, limit: 20, hasMore: false });
  mocks.profile.mockResolvedValue(profile);
  mocks.warm.mockResolvedValue(undefined);
  window.sessionStorage.clear();
  mocks.search.mockResolvedValue({ searchId: "search-a", items: [{ id: "jooble:1", title: "Backend Python", company: "Acme", location: "CABA", snippet: "Servicios", url: "https://ar.jooble.org/jdp/1", source: "Jooble", updatedAt: null }] });
});

describe("Búsqueda de empleos", () => {
  const liJob = { id: "linkedin:9", title: "Dev LinkedIn", company: "Beta", location: "CABA", snippet: "x", url: "https://www.linkedin.com/jobs/view/9", source: "LinkedIn", updatedAt: null };

  it("muestra el aviso de servicio externo y envía LinkedIn como fuente al activarlo", async () => {
    mocks.search.mockResolvedValueOnce({ searchId: "s1", status: "in_progress", items: [], sources: [{ source: "linkedin", status: "running", offersCount: 0 }] });
    mocks.status.mockResolvedValue({ searchId: "s1", status: "complete", items: [liJob], sources: [{ source: "linkedin", status: "succeeded", offersCount: 1 }] });
    render(<JobsPage />);
    await screen.findByTestId("jobs-keywords");
    fireEvent.click(screen.getByTestId("jobs-source-linkedin"));
    expect(screen.getByTestId("jobs-linkedin-notice").textContent).toContain("Apify");
    fireEvent.click(screen.getByTestId("jobs-submit"));
    await screen.findByTestId("jobs-source-status-linkedin");
    expect(mocks.search).toHaveBeenCalledWith("user-a", { resumeId: "resume-a", keywords: "Desarrollador backend", location: "Buenos Aires", sources: ["jooble", "linkedin"] }, expect.any(AbortSignal));
    expect(await screen.findByTestId("job-linkedin:9", undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByTestId("jobs-source-status-linkedin").textContent).toBe("LinkedIn: 1 ofertas");
    expect(screen.queryByTestId("jobs-linkedin-retry")).toBeNull();
  });

  it.each([
    ["pending", "Búsqueda pendiente", false],
    ["running", "Buscando", false],
    ["succeeded", "1 ofertas", false],
    ["timed_out", "Tardó demasiado", true],
  ])("interpreta el estado real de LinkedIn: %s", async (status, message, retryVisible) => {
    mocks.search.mockResolvedValueOnce({
      searchId: "status-search",
      status: status === "succeeded" ? "complete" : status === "timed_out" ? "incomplete" : "in_progress",
      items: [liJob],
      sources: [{ source: "linkedin", status, offersCount: 1 }],
    });
    render(<JobsPage />);
    await screen.findByTestId("jobs-keywords");
    fireEvent.click(screen.getByTestId("jobs-source-linkedin"));
    fireEvent.click(screen.getByTestId("jobs-submit"));
    expect((await screen.findByTestId("jobs-source-status-linkedin")).textContent).toContain(message);
    expect(Boolean(screen.queryByTestId("jobs-linkedin-retry"))).toBe(retryVisible);
    if (status === "pending" || status === "running") {
      expect(screen.getByTestId("jobs-source-status-linkedin").textContent).not.toContain("resultado parcial");
    }
  });

  it("muestra resultado parcial y permite reintentar LinkedIn", async () => {
    mocks.search.mockResolvedValueOnce({ searchId: "s2", status: "incomplete", items: [{ id: "jooble:1", title: "Backend Python", company: "Acme", location: "CABA", snippet: "S", url: "https://ar.jooble.org/jdp/1", source: "Jooble", updatedAt: null }], sources: [{ source: "jooble", status: "succeeded", offersCount: 1 }, { source: "linkedin", status: "failed", offersCount: 0, error: "linkedin_failed" }] });
    mocks.retry.mockResolvedValue({ searchId: "s2", status: "in_progress", items: [], sources: [{ source: "linkedin", status: "running", offersCount: 0 }] });
    mocks.status.mockResolvedValue({ searchId: "s2", status: "in_progress", items: [], sources: [{ source: "linkedin", status: "running", offersCount: 0 }] });
    render(<JobsPage />);
    await screen.findByTestId("jobs-keywords");
    fireEvent.click(screen.getByTestId("jobs-source-linkedin"));
    fireEvent.click(screen.getByTestId("jobs-submit"));
    await screen.findByTestId("job-jooble:1");
    expect(screen.getByTestId("jobs-source-status-linkedin").textContent).toContain("No se pudo");
    fireEvent.click(screen.getByTestId("jobs-linkedin-retry"));
    await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith("user-a", "s2", expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByTestId("jobs-source-status-linkedin").textContent).toContain("Buscando"));
  });

  it("pausa las consultas sin inventar un fallo y permite consultar el estado de nuevo", async () => {
    const running = {
      searchId: "long-search", status: "in_progress", items: [liJob],
      sources: [{ source: "linkedin", status: "running", offersCount: 1 }],
    };
    mocks.search.mockResolvedValueOnce(running);
    mocks.status.mockImplementation(async () => ({ ...running, sources: [...running.sources] }));
    render(<JobsPage />);
    await screen.findByTestId("jobs-keywords");
    vi.useFakeTimers();
    fireEvent.click(screen.getByTestId("jobs-source-linkedin"));
    await act(async () => { fireEvent.click(screen.getByTestId("jobs-submit")); });
    expect(screen.getByTestId("jobs-source-status-linkedin")).toBeTruthy();
    for (let attempt = 0; attempt < 81; attempt += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    }
    expect(screen.getByTestId("jobs-poll-paused").textContent).toContain("no indica que LinkedIn haya fallado");
    expect(screen.getByTestId("jobs-source-status-linkedin").textContent).toContain("Buscando");
    expect(screen.queryByTestId("jobs-linkedin-retry")).toBeNull();
    mocks.status.mockResolvedValue({ ...running, status: "complete", sources: [{ source: "linkedin", status: "succeeded", offersCount: 1 }] });
    fireEvent.click(screen.getByTestId("jobs-refresh-status"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByTestId("jobs-source-status-linkedin").textContent).toBe("LinkedIn: 1 ofertas");
    expect(screen.queryByTestId("jobs-poll-paused")).toBeNull();
  });

  it("propone términos del CV y consulta solo al pulsar Buscar", async () => {
    render(<JobsPage />);
    expect((await screen.findByTestId("jobs-keywords") as HTMLInputElement).value).toBe("Desarrollador backend");
    expect(mocks.search).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("jobs-keywords"), { target: { value: "Python" } });
    fireEvent.click(screen.getByTestId("jobs-submit"));
    await screen.findByTestId("job-jooble:1");
    const searchSection = screen.getByRole("region", { name: "Preparar búsqueda" });
    const matchPanel = screen.getByRole("region", { name: "Recomendaciones Match" });
    const results = screen.getByTestId("jobs-results");
    const matchResults = screen.getByRole("region", { name: "Mejores coincidencias de Match" });
    expect(searchSection.contains(matchPanel)).toBe(true);
    expect(
      Boolean(
        screen.getByTestId("jobs-submit").compareDocumentPosition(matchPanel) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(results.contains(matchResults)).toBe(true);
    expect(
      Boolean(
        matchResults.compareDocumentPosition(screen.getByTestId("job-jooble:1")) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(mocks.search).toHaveBeenCalledWith("user-a", { resumeId: "resume-a", keywords: "Python", location: "Buenos Aires" }, expect.any(AbortSignal));
    expect(screen.getByText("Backend Python")).toBeTruthy();
    const link = screen.getByTestId("job-link-jooble:1") as HTMLAnchorElement;
    expect(link.href).toBe("https://ar.jooble.org/jdp/1");
    expect(link.rel).toContain("noopener");
  });

  it("restaura la última búsqueda al volver a montar la pantalla", async () => {
    const firstView = render(<JobsPage />);
    await waitFor(() => expect((screen.getByTestId("jobs-keywords") as HTMLInputElement).value).toBe("Desarrollador backend"));
    fireEvent.click(screen.getByTestId("jobs-submit"));
    await screen.findByTestId("job-jooble:1");
    firstView.unmount();

    render(<JobsPage />);

    expect(await screen.findByTestId("job-jooble:1")).toBeTruthy();
    expect(mocks.search).toHaveBeenCalledTimes(1);
  });

  it("calienta el backend al abrir la pantalla de empleos", async () => {
    render(<JobsPage />);

    await waitFor(() => expect(mocks.warm).toHaveBeenCalledTimes(1));
    expect(mocks.warm).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("muestra estado vacío o error sin borrar la consulta", async () => {
    mocks.search.mockResolvedValueOnce({ searchId: "search-empty", items: [] });
    mocks.search.mockRejectedValueOnce(new Error("La búsqueda de empleos aún no está configurada."));
    render(<JobsPage />);
    await waitFor(() => expect((screen.getByTestId("jobs-keywords") as HTMLInputElement).value).toBe("Desarrollador backend"));
    fireEvent.click(screen.getByTestId("jobs-submit"));
    await screen.findByTestId("jobs-empty");
    fireEvent.click(screen.getByTestId("jobs-submit"));
    expect((await screen.findByTestId("jobs-error")).textContent).toContain("no está configurada");
    expect((screen.getByTestId("jobs-keywords") as HTMLInputElement).value).toBe("Desarrollador backend");
  });

  it("retira resultados cuando cambia la cuenta", async () => {
    const view = render(<JobsPage />);
    await waitFor(() => expect((screen.getByTestId("jobs-keywords") as HTMLInputElement).value).toBe("Desarrollador backend"));
    fireEvent.click(screen.getByTestId("jobs-submit"));
    await screen.findByTestId("job-jooble:1");
    mocks.session = { user: { id: "user-b" } };
    mocks.list.mockResolvedValue({ items: [], offset: 0, limit: 20, hasMore: false });
    view.rerender(<JobsPage />);
    expect(screen.queryByTestId("job-jooble:1")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("jobs-no-resumes")).toBeTruthy());
  });

  it("descarta una búsqueda pendiente al elegir otro CV", async () => {
    const second = { ...item, id: "resume-b", fullName: "Bea" };
    mocks.list.mockResolvedValue({ items: [item, second], offset: 0, limit: 20, hasMore: false });
    mocks.profile.mockImplementation((_: string, id: string) => Promise.resolve({ ...profile, resumeId: id, suggestedKeywords: id === "resume-b" ? "Diseñadora" : "Desarrollador backend" }));
    let finishSearch: ((value: unknown) => void) | undefined;
    mocks.search.mockImplementation(() => new Promise((resolve) => { finishSearch = resolve; }));
    render(<JobsPage />);
    await waitFor(() => expect((screen.getByTestId("jobs-keywords") as HTMLInputElement).value).toBe("Desarrollador backend"));
    fireEvent.click(screen.getByTestId("jobs-submit"));
    await screen.findByTestId("jobs-searching");
    fireEvent.change(screen.getByTestId("jobs-resume-select"), { target: { value: "resume-b" } });
    await waitFor(() => expect((screen.getByTestId("jobs-keywords") as HTMLInputElement).value).toBe("Diseñadora"));
    finishSearch?.({ searchId: "search-old", items: [{ id: "jooble:old", title: "Oferta anterior", company: "", location: "", snippet: "", url: "https://example.test/old", source: "Jooble", updatedAt: null }] });
    await waitFor(() => expect(screen.queryByTestId("job-jooble:old")).toBeNull());
    expect(screen.queryByTestId("jobs-searching")).toBeNull();
  });

  it("permite reintentar la preparación de sugerencias", async () => {
    mocks.profile.mockRejectedValueOnce(new Error("Sin conexión"));
    render(<JobsPage />);
    expect((await screen.findByTestId("jobs-profile-error")).textContent).toContain("Sin conexión");
    fireEvent.click(screen.getByTestId("jobs-profile-retry"));
    await waitFor(() => expect((screen.getByTestId("jobs-keywords") as HTMLInputElement).value).toBe("Desarrollador backend"));
  });
});
