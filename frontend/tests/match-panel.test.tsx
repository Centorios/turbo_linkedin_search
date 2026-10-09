import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MatchPanel,
  MatchResults,
  useMatchController,
} from "../app/jobs/MatchPanel";
import type { MatchResult } from "../app/types/match";

const mocks = vi.hoisted(() => ({ request: vi.fn(), saved: vi.fn() }));

vi.mock("../app/lib/match-client", () => ({
  getSavedMatch: mocks.saved,
  requestMatch: mocks.request,
}));

const result: MatchResult = {
  resumeChanged: false,
  completedAt: "2026-10-08T12:00:00Z",
  recommendations: [
    {
      rank: 1,
      offerId: "offer-a",
      title: "Desarrolladora Python",
      company: "Acme",
      location: "Buenos Aires",
      url: "https://ar.jooble.org/jdp/1",
      affinity: "Alta",
      summary: "Tu experiencia coincide con el puesto.",
      matches: ["Python"],
      unmetRequirements: ["Experiencia con Kubernetes"],
      missingInfo: ["No se especifica la modalidad de trabajo"],
    },
  ],
};

function MatchTestScreen({ searchId = "search-a" }: { searchId?: string | null }) {
  const match = useMatchController({
    userId: "user-a",
    resumeId: "resume-a",
    searchId,
  });
  return (
    <>
      <MatchPanel searchId={searchId} match={match} />
      <MatchResults match={match} />
    </>
  );
}

function renderMatch(searchId: string | null = "search-a") {
  return render(<MatchTestScreen searchId={searchId} />);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.saved.mockResolvedValue(null);
});

describe("Panel de Match", () => {
  it("muestra recomendaciones y permite recalcular", async () => {
    mocks.request.mockResolvedValue(result);
    renderMatch();

    expect(screen.getByTestId("match-description").textContent).toBe(
      "Recibí hasta tres recomendaciones de las ofertas encontradas que mejor se adapten a tu perfil profesional",
    );
    await waitFor(() =>
      expect((screen.getByTestId("match-button") as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByTestId("match-button"));
    expect(screen.getByTestId("match-status").textContent).toBe("Analizando…");
    expect((screen.getByTestId("match-button") as HTMLButtonElement).disabled).toBe(true);

    expect(await screen.findByTestId("match-recommendation-1")).toBeTruthy();
    expect(screen.getByTestId("match-affinity-1").textContent).toBe("Afinidad Alta");
    expect(screen.getByTestId("match-highest-affinity").textContent).toContain(
      "Mayor afinidad",
    );
    expect(
      screen.getByTestId("match-highest-affinity").querySelector("svg"),
    ).not.toBeNull();
    expect(
      screen.getByRole("region", { name: "Mejores coincidencias de Match" }).className,
    ).toContain("border-2");
    expect(screen.getByTestId("match-matches-1").textContent).toContain("Python");
    expect(screen.getByTestId("match-unmet-requirements-1").textContent).toContain(
      "Experiencia con Kubernetes",
    );
    expect(screen.getByTestId("match-missing-info-1").textContent).toContain(
      "No se especifica la modalidad de trabajo",
    );
    const link = screen.getByTestId("match-link-1") as HTMLAnchorElement;
    expect(link.href).toBe("https://ar.jooble.org/jdp/1");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(mocks.request).toHaveBeenCalledWith(
      "user-a",
      { searchId: "search-a", resumeId: "resume-a", recalculate: false },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByTestId("match-recalculate"));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
    expect(mocks.request).toHaveBeenLastCalledWith(
      "user-a",
      { searchId: "search-a", resumeId: "resume-a", recalculate: true },
      expect.any(AbortSignal),
    );
  });

  it("conserva recomendaciones y permite reintentar si falla el recálculo", async () => {
    mocks.request.mockResolvedValueOnce(result).mockRejectedValueOnce(new Error("Servicio temporalmente no disponible"));
    renderMatch();
    await waitFor(() =>
      expect((screen.getByTestId("match-button") as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByTestId("match-button"));
    expect(await screen.findByTestId("match-recommendation-1")).toBeTruthy();

    fireEvent.click(screen.getByTestId("match-recalculate"));

    expect(await screen.findByTestId("match-retry")).toBeTruthy();
    expect(screen.getByTestId("match-recommendation-1")).toBeTruthy();
    expect(screen.getByTestId("match-status").textContent).toContain("Servicio temporalmente");
    fireEvent.click(screen.getByTestId("match-retry"));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(3));
  });

  it("deshabilita Match cuando la búsqueda no se pudo guardar", () => {
    renderMatch(null);
    expect((screen.getByTestId("match-button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("match-status").textContent).toContain("realiza otra búsqueda");
  });

  it("avisa sobre el arranque en frío y reintenta al cumplirse el timeout", async () => {
    mocks.request
      .mockResolvedValueOnce(result)
      .mockImplementationOnce(
        (_userId: string, _request: unknown, signal: AbortSignal) =>
          new Promise((_, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      );
    renderMatch();

    expect(screen.getByTestId("match-cold-start-warning").textContent).toContain(
      "Render",
    );
    await waitFor(() =>
      expect((screen.getByTestId("match-button") as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByTestId("match-button"));
    expect(await screen.findByTestId("match-recommendation-1")).toBeTruthy();

    vi.useFakeTimers();
    fireEvent.click(screen.getByTestId("match-recalculate"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(85_000);
    });

    expect(screen.getByTestId("match-status").textContent).toContain(
      "tiempo de espera",
    );
    expect(screen.getByTestId("match-retry")).toBeTruthy();
    expect(screen.getByTestId("match-recommendation-1")).toBeTruthy();
  });

  it("recupera recomendaciones guardadas y avisa si el CV cambió", async () => {
    mocks.saved.mockResolvedValue({ ...result, resumeChanged: true });
    renderMatch();

    expect(await screen.findByTestId("match-recommendation-1")).toBeTruthy();
    expect(screen.getByTestId("match-resume-changed").textContent).toContain(
      "El CV cambió desde este análisis",
    );
    expect(screen.getByTestId("match-recalculate")).toBeTruthy();
    expect(mocks.saved).toHaveBeenCalledWith(
      "user-a",
      "search-a",
      "resume-a",
      expect.any(AbortSignal),
    );
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("muestra el estado vacío cuando no hay ofertas adecuadas", async () => {
    mocks.request.mockResolvedValue({
      ...result,
      recommendations: [],
    });
    renderMatch();
    await waitFor(() =>
      expect((screen.getByTestId("match-button") as HTMLButtonElement).disabled).toBe(false),
    );

    fireEvent.click(screen.getByTestId("match-button"));

    expect(await screen.findByTestId("match-empty")).toBeTruthy();
    expect(screen.queryByTestId("match-recommendation-1")).toBeNull();
  });
});
