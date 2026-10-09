"use client";

import { useEffect, useRef, useState } from "react";
import { SpinnerIcon } from "../components/icons";
import { getSavedMatch, requestMatch } from "../lib/match-client";
import type { MatchResult } from "../types/match";
import type { JobSourceState } from "../types/jobs";

const REQUEST_TIMEOUT_MS = 85_000;

type MatchStatus = "idle" | "loading" | "success" | "error" | "timeout";

export function useMatchController({
  userId,
  resumeId,
  searchId,
}: {
  userId: string;
  resumeId: string;
  searchId: string | null | undefined;
}) {
  const [result, setResult] = useState<MatchResult | null>(null);
  const [status, setStatus] = useState<MatchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadingSavedResult, setLoadingSavedResult] = useState(Boolean(searchId));
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setResult(null);
    setStatus("idle");
    setError(null);
    setLoadingSavedResult(Boolean(searchId && resumeId));
    if (!searchId || !resumeId) return;

    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    void getSavedMatch(userId, searchId, resumeId, controller.signal)
      .then((savedResult) => {
        if (controller.signal.aborted) return;
        setResult(savedResult);
        if (savedResult) setStatus("success");
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudieron recuperar las recomendaciones. Inténtalo de nuevo.",
        );
        setStatus("error");
      })
      .finally(() => {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setLoadingSavedResult(false);
        }
      });

    return () => {
      controller.abort();
      if (requestRef.current === controller) requestRef.current = null;
    };
  }, [userId, resumeId, searchId]);

  async function runMatch(recalculate: boolean) {
    if (!searchId || !resumeId || status === "loading" || loadingSavedResult) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    setStatus("loading");
    setError(null);
    try {
      const response = await requestMatch(
        userId,
        { searchId, resumeId, recalculate },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setResult(response);
        setStatus("success");
      }
    } catch (cause) {
      if (controller.signal.aborted && !timedOut) return;
      setError(
        timedOut
          ? "El análisis superó el tiempo de espera. Puedes intentarlo de nuevo."
          : cause instanceof Error
            ? cause.message
            : "No se pudo completar el análisis. Inténtalo de nuevo.",
      );
      setStatus(timedOut ? "timeout" : "error");
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  const busy = status === "loading" || loadingSavedResult;

  return { result, status, error, loadingSavedResult, busy, runMatch };
}

type MatchController = ReturnType<typeof useMatchController>;

export function MatchPanel({
  searchId,
  match,
}: {
  searchId: string | null | undefined;
  match: MatchController;
}) {
  return (
    <section
      aria-label="Recomendaciones Match"
      className="mt-5 rounded-xl border border-border bg-surface p-5 shadow-sm"
    >
      <h2 className="text-headline-lg">Match</h2>
      <p data-testid="match-description" className="mt-2 text-body-sm text-text-muted">
        Recibí hasta tres recomendaciones de las ofertas encontradas que mejor se adapten a tu perfil profesional
      </p>
      <p
        data-testid="match-cold-start-warning"
        className="mt-3 rounded-lg bg-subtle p-3 text-body-sm text-text-muted"
      >
        Render puede tardar cerca de un minuto en reactivar el servicio tras un período sin actividad. Si el análisis supera el tiempo de espera, podrás reintentarlo.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="match-button"
          disabled={!searchId || match.busy}
          onClick={() => void match.runMatch(false)}
          className="focus-ring flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-body-sm font-semibold text-on-primary disabled:opacity-60"
        >
          {match.busy && <SpinnerIcon className="h-4 w-4" />}
          Match
        </button>
        {match.result && match.status === "success" && match.result.canRecalculate !== false && (
          <button
            type="button"
            data-testid="match-recalculate"
            disabled={match.busy}
            onClick={() => void match.runMatch(true)}
            className="focus-ring rounded-lg border border-primary px-4 py-2.5 text-body-sm font-semibold text-primary disabled:opacity-60"
          >
            Recalcular
          </button>
        )}
        {(match.status === "error" || match.status === "timeout") && (
          <button
            type="button"
            data-testid="match-retry"
            disabled={match.busy}
            onClick={() => void match.runMatch(Boolean(match.result))}
            className="focus-ring rounded-lg border border-primary px-4 py-2.5 text-body-sm font-semibold text-primary disabled:opacity-60"
          >
            Reintentar
          </button>
        )}
      </div>
      <p
        role={match.status === "error" || match.status === "timeout" ? "alert" : "status"}
        data-testid="match-status"
        className={`mt-3 text-body-sm ${match.status === "error" || match.status === "timeout" ? "text-danger" : "text-text-muted"}`}
      >
        {match.loadingSavedResult
          ? "Cargando recomendaciones guardadas…"
          : match.status === "loading"
            ? "Analizando…"
          : match.status === "success"
            ? "Análisis completado."
            : match.error
              ? match.error
              : !searchId
                ? "No se pudo guardar esta búsqueda; realiza otra búsqueda para habilitar Match."
                : ""}
      </p>
    </section>
  );
}

export function MatchResults({ match, sources = [] }: { match: MatchController; sources?: JobSourceState[] }) {
  const { result } = match;
  if (!result) return null;
  const sourcesPending = sources.some((source) => source.status === "pending" || source.status === "running");
  const sourcesFailed = sources.some((source) => source.status === "failed" || source.status === "timed_out");

  return (
    <section
      aria-label="Mejores coincidencias de Match"
      data-testid="match-results"
      className="mb-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-5 shadow-sm sm:p-6"
    >
      <div className="border-b border-primary/20 pb-4">
        <p className="text-label-xs font-semibold uppercase tracking-widest text-primary">
          Recomendaciones personalizadas
        </p>
        <h2 className="mt-1 text-headline-lg">Mejores coincidencias de Match</h2>
        <p className="mt-2 text-body-sm text-text-muted">
          Ofertas recomendadas entre los resultados de esta búsqueda, ordenadas por afinidad con tu CV.
        </p>
      </div>
      {result.partial && (
        <p
          role="status"
          data-testid="match-partial-warning"
          className="mt-4 rounded-lg bg-subtle p-3 text-body-sm text-text-muted"
        >
          {sourcesPending
            ? "Resultado provisional: todavía se están obteniendo ofertas. Cuando termine la búsqueda, recalcula Match para incluir las nuevas ofertas."
            : sourcesFailed
              ? "Resultado parcial: alguna fuente falló o agotó su tiempo de espera. El análisis utiliza las ofertas disponibles."
              : "Este análisis puede no incluir todas las ofertas de la búsqueda. Recalcula Match para actualizar las recomendaciones."}
        </p>
      )}
      {result.resumeChanged && (
        <p
          data-testid="match-resume-changed"
          className="mt-4 rounded-lg bg-subtle p-3 text-body-sm text-text-muted"
        >
          El CV cambió desde este análisis
        </p>
      )}
      {result.recommendations.length === 0 && (
        <p
          data-testid="match-empty"
          className="mt-4 rounded-lg border border-border bg-surface p-4 text-body-sm text-text-muted"
        >
          No encontramos ofertas adecuadas para este perfil en la búsqueda.
        </p>
      )}
      {result.recommendations.length > 0 && (
        <ul className="mt-4 space-y-3">
          {result.recommendations.map((recommendation) => (
            <li
              key={`${recommendation.rank}-${recommendation.offerId}`}
              data-testid={`match-recommendation-${recommendation.rank}`}
              className={`rounded-lg border bg-surface p-4 shadow-sm ${recommendation.rank === 1 ? "border-amber-400/70" : "border-border"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-body-md font-semibold">{recommendation.title}</h3>
                    {recommendation.rank === 1 && (
                      <span
                        data-testid="match-highest-affinity"
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-caption-xs font-semibold text-amber-900"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M3 4.5a1 1 0 0 1 1.6-.8L8 6.25l1.2-3.1a.86.86 0 0 1 1.6 0L12 6.25l3.4-2.55a1 1 0 0 1 1.6.8l-1.1 7.25H4.1L3 4.5ZM4.5 14h11l-.25 1.6a1 1 0 0 1-1 .85h-8.5a1 1 0 0 1-1-.85L4.5 14Z" />
                        </svg>
                        Mayor afinidad
                      </span>
                    )}
                  </div>
                  {recommendation.source && (
                    <span
                      data-testid={`match-source-${recommendation.rank}`}
                      className="mt-1 inline-block rounded-full bg-subtle px-2 py-0.5 text-caption-xs font-semibold text-text-muted"
                    >
                      {recommendation.source}
                      {recommendation.descriptionIsPartial ? " · descripción parcial" : ""}
                    </span>
                  )}
                  <p className="mt-1 text-body-sm text-text-muted">
                    {recommendation.company || "Empresa no indicada"} · {recommendation.location || "Ubicación no indicada"}
                  </p>
                </div>
                <span
                  data-testid={`match-affinity-${recommendation.rank}`}
                  className="rounded-full bg-subtle px-3 py-1 text-caption-xs font-semibold text-text-muted"
                >
                  Afinidad {recommendation.affinity}
                </span>
              </div>
              <p className="mt-3 text-body-sm leading-relaxed text-text-muted">
                {recommendation.summary}
              </p>
              <div className="mt-4 grid gap-3">
                {[
                  {
                    testId: `match-matches-${recommendation.rank}`,
                    title: "Coincidencias",
                    items: recommendation.matches,
                    emptyMessage: "No se identificaron coincidencias específicas.",
                  },
                  {
                    testId: `match-unmet-requirements-${recommendation.rank}`,
                    title: "Requisitos no acreditados",
                    items: recommendation.unmetRequirements,
                    emptyMessage: "No se identificaron requisitos sin acreditar.",
                  },
                  {
                    testId: `match-missing-info-${recommendation.rank}`,
                    title: "Información faltante",
                    items: recommendation.missingInfo,
                    emptyMessage: "No se identificó información faltante.",
                  },
                ].map((section) => (
                  <section
                    key={section.testId}
                    data-testid={section.testId}
                    className="rounded-lg bg-subtle p-3"
                  >
                    <h4 className="text-body-sm font-semibold">{section.title}</h4>
                    {section.items.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-body-sm text-text-muted">
                        {section.items.map((item, index) => (
                          <li key={`${section.testId}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-body-sm text-text-muted">
                        {section.emptyMessage}
                      </p>
                    )}
                  </section>
                ))}
              </div>
              <a
                href={recommendation.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`match-link-${recommendation.rank}`}
                className="focus-ring mt-3 inline-block rounded-lg border border-primary px-3 py-1.5 text-body-sm font-semibold text-primary hover:bg-subtle"
              >
                Ver oferta
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
