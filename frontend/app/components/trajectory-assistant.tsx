"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertIcon, CheckCircleIcon, SpinnerIcon } from "./icons";
import { requestTrajectoryAssistance } from "../lib/trajectory-assistance-client";
import type {
  AssistanceResult,
  AssistanceTurnRequest,
  DevelopmentRecommendation,
  FollowUpAnswer,
  TrajectoryProposal,
} from "../types/trajectory-assistance";

type TrajectoryAssistantProps = {
  sourceText: string;
  onUseAccepted: (approvedText: string[]) => void;
  onContinueWithoutSuggestions: () => void;
  onClose: () => void;
};

type ProposalReview = {
  status: "proposed" | "accepted" | "edited" | "rejected";
  approvedText?: string;
};

function evidenceKey(evidence: string[]) {
  return evidence.join("\n");
}

export function TrajectoryAssistant({
  sourceText,
  onUseAccepted,
  onContinueWithoutSuggestions,
  onClose,
}: TrajectoryAssistantProps) {
  const [answers, setAnswers] = useState<FollowUpAnswer[]>([]);
  const [retryAnswers, setRetryAnswers] = useState<FollowUpAnswer[] | null>(null);
  const [result, setResult] = useState<AssistanceResult | null>(null);
  const [answerValues, setAnswerValues] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Record<string, ProposalReview>>({});
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function requestTurn(nextAnswers: FollowUpAnswer[]) {
    setIsLoading(true);
    setError(null);
    setRetryAnswers(nextAnswers);
    try {
      const request: AssistanceTurnRequest = { sourceText, answers: nextAnswers };
      const nextResult = await requestTrajectoryAssistance(request);
      setAnswers(nextAnswers);
      setRetryAnswers(null);
      setResult(nextResult);
      setAnswerValues({});
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : "No se pudo completar la asistencia");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void requestTurn([]);
  }, []);

  function submitAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result || result.state !== "needs_input") return;

    const nextAnswers = result.questions.flatMap((question) => {
      const answer = answerValues[question.id]?.trim();
      return answer ? [{ questionId: question.id, question: question.text, answer }] : [];
    });
    void requestTurn([...answers, ...nextAnswers]);
  }

  function answerUnknowns() {
    if (!result || result.state !== "needs_input") return;
    const unknownAnswers = result.questions.map((question) => ({
      questionId: question.id,
      question: question.text,
      answer: answerValues[question.id]?.trim() || "No conozco ese dato.",
    }));
    void requestTurn([...answers, ...unknownAnswers]);
  }

  function updateReview(proposal: TrajectoryProposal, review: ProposalReview) {
    setReviews((current) => ({ ...current, [proposal.proposalId]: review }));
  }

  function acceptedProposalTexts(proposals: TrajectoryProposal[]) {
    return proposals.flatMap((proposal) => {
      const review = reviews[proposal.proposalId];
      if (review?.status === "accepted") return [proposal.text];
      if (review?.status === "edited" && review.approvedText) return [review.approvedText];
      return [];
    });
  }

  function renderRecommendation(recommendation: DevelopmentRecommendation, index: number) {
    return (
      <li key={`${recommendation.competency}-${index}`} className="border-l-2 border-border pl-4">
        <h3 className="text-body-sm font-semibold text-text">{recommendation.competency}</h3>
        <p className="mt-1 text-caption-xs text-text-muted">{recommendation.reason}</p>
        <ul className="mt-2 list-disc pl-5 text-caption-xs text-text-muted">
          {recommendation.actions.map((action) => <li key={action}>{action}</li>)}
        </ul>
      </li>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="trajectory-assistant-title"
        data-testid="trajectory-assistant"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !isLoading) onClose();
        }}
        className="my-auto max-h-[min(92vh,820px)] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="trajectory-assistant-title" className="text-headline-lg text-text">
              Mejorar trayectoria y competencias
            </h2>
            <p className="mt-2 text-body-sm text-text-muted">
              Aclararemos los hechos y revisaremos cada propuesta antes de usarla en el CV.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Cerrar asistencia"
            className="focus-ring rounded-md border border-border px-3 py-1.5 text-body-sm text-text-muted disabled:opacity-50"
          >
            Cerrar
          </button>
        </header>

        {isLoading && (
          <p role="status" className="mt-6 flex items-center gap-2 text-body-sm text-text-muted">
            <SpinnerIcon className="h-4 w-4" /> Analizando los datos confirmados…
          </p>
        )}

        {error && (
          <div className="mt-6 rounded-lg bg-danger-surface p-4">
            <p role="alert" data-testid="trajectory-assistance-error" className="flex items-center gap-2 text-body-sm text-danger">
              <AlertIcon className="h-4 w-4 shrink-0" /> {error}
            </p>
            <button
              type="button"
              onClick={() => void requestTurn(retryAnswers ?? answers)}
              data-testid="trajectory-assistance-retry"
              className="focus-ring mt-3 rounded-lg border border-danger px-3 py-1.5 text-body-sm font-semibold text-danger"
            >
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !error && result?.state === "needs_input" && (
          <form onSubmit={submitAnswers} className="mt-6 space-y-5">
            <h3 className="text-body-md font-semibold text-text">Necesito aclarar algunos detalles</h3>
            {result.questions.map((question) => (
              <div key={question.id}>
                <label htmlFor={`answer-${question.id}`} className="mb-1.5 block text-body-sm font-semibold text-text">
                  {question.text}
                </label>
                <textarea
                  id={`answer-${question.id}`}
                  value={answerValues[question.id] ?? ""}
                  onChange={(event) => setAnswerValues((current) => ({ ...current, [question.id]: event.target.value }))}
                  rows={3}
                  data-testid={`trajectory-answer-${question.id}`}
                  className="focus-ring w-full resize-y rounded-lg border border-border bg-surface p-3 text-body-sm text-text"
                />
              </div>
            ))}
            <p className="text-caption-xs text-text-muted">
              Comparte solo lo que recuerdes; no añadiremos cifras o hechos que no confirmes.
            </p>
            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
              <button type="button" onClick={onContinueWithoutSuggestions} className="focus-ring rounded-lg border border-border px-4 py-2 text-body-sm font-semibold text-text-muted">
                Seguir solo con lo confirmado
              </button>
              <button type="button" onClick={answerUnknowns} className="focus-ring rounded-lg border border-border px-4 py-2 text-body-sm font-semibold text-text-muted">
                No conozco esos datos
              </button>
              <button type="submit" className="focus-ring rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary">
                Enviar respuestas
              </button>
            </div>
          </form>
        )}

        {!isLoading && !error && result?.state === "ready" && (
          <div className="mt-6 space-y-7">
            <section aria-labelledby="trajectory-proposals-heading">
              <h3 id="trajectory-proposals-heading" className="text-body-md font-semibold text-text">Propuestas con evidencia</h3>
              <ul className="mt-3 space-y-4">
                {result.proposals.map((proposal) => {
                  const review = reviews[proposal.proposalId]?.status ?? "proposed";
                  const text = editedTexts[proposal.proposalId] ?? proposal.text;
                  return (
                    <li key={proposal.proposalId} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-caption-xs font-semibold uppercase text-text-muted">{proposal.kind}</span>
                        {proposal.competencyType && <span className="text-caption-xs text-text-muted">{proposal.competencyType}</span>}
                        {review !== "proposed" && <span role="status" className="flex items-center gap-1 text-caption-xs text-success"><CheckCircleIcon className="h-3.5 w-3.5" />{review === "rejected" ? "Descartada" : "Revisada"}</span>}
                      </div>
                      <label htmlFor={`proposal-${proposal.proposalId}`} className="sr-only">Editar propuesta {proposal.proposalId}</label>
                      <textarea
                        id={`proposal-${proposal.proposalId}`}
                        value={text}
                        onChange={(event) => {
                          setEditedTexts((current) => ({ ...current, [proposal.proposalId]: event.target.value }));
                          setReviews((current) => ({
                            ...current,
                            [proposal.proposalId]: { status: "proposed" },
                          }));
                        }}
                        rows={3}
                        data-testid={`trajectory-proposal-${proposal.proposalId}`}
                        className="focus-ring mt-3 w-full resize-y rounded-lg border border-border bg-surface p-3 text-body-sm text-text"
                      />
                      <p className="mt-3 text-caption-xs font-semibold text-text-muted">Evidencia aportada</p>
                      <ul className="mt-1 list-disc pl-5 text-caption-xs text-text-muted">
                        {proposal.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
                      </ul>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => updateReview(proposal, { status: "accepted" })} className="focus-ring rounded-lg bg-primary px-3 py-1.5 text-caption-xs font-semibold text-on-primary">
                          Aceptar original
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReview(proposal, { status: "edited", approvedText: text })}
                          disabled={!text.trim()}
                          className="focus-ring rounded-lg border border-border px-3 py-1.5 text-caption-xs font-semibold text-text disabled:opacity-50"
                        >
                          Aceptar edición
                        </button>
                        <button type="button" onClick={() => updateReview(proposal, { status: "rejected" })} className="focus-ring rounded-lg border border-border px-3 py-1.5 text-caption-xs font-semibold text-danger">
                          Rechazar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {result.developmentRecommendations.length > 0 && (
              <section aria-labelledby="development-recommendations-heading" className="border-t border-border pt-5">
                <h3 id="development-recommendations-heading" className="text-body-md font-semibold text-text">Competencias que podrías desarrollar</h3>
                <p className="mt-1 text-caption-xs text-text-muted">Estas acciones son recomendaciones y no se añaden al CV como habilidades actuales.</p>
                <ul className="mt-3 space-y-4">{result.developmentRecommendations.map(renderRecommendation)}</ul>
              </section>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
              <button type="button" onClick={onContinueWithoutSuggestions} className="focus-ring rounded-lg border border-border px-4 py-2 text-body-sm font-semibold text-text-muted">
                Continuar sin propuestas
              </button>
              <button
                type="button"
                onClick={() => onUseAccepted(acceptedProposalTexts(result.proposals))}
                disabled={acceptedProposalTexts(result.proposals).length === 0}
                data-testid="trajectory-use-accepted"
                className="focus-ring rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Usar propuestas aceptadas
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
