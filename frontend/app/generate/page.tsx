"use client";

import { FormEvent, useState } from "react";
import { AppHeader } from "../components/app-header";
import { TrajectoryAssistant } from "../components/trajectory-assistant";
import { useSession } from "../auth/session-provider";
import { generateCv } from "../lib/generate-cv-client";
import { CvPreview, type CvTemplate } from "../components/cv-preview";
import { TemplateSelector } from "../components/template-selector";
import { PdfDownload } from "../components/pdf-download";
import { AlertIcon, BoltIcon, DocumentIcon, SparkleIcon, SpinnerIcon } from "../components/icons";

export default function GeneratePage() {
  const { session, isLoading } = useSession();
  const [text, setText] = useState("");
  const [cv, setCv] = useState<Awaited<ReturnType<typeof generateCv>> | null>(null);
  const [template, setTemplate] = useState<CvTemplate>("ats");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [hasReviewedAssistance, setHasReviewedAssistance] = useState(false);
  const [approvedAssistantText, setApprovedAssistantText] = useState<string[]>([]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p role="status" data-testid="session-loading" className="flex items-center gap-2 text-body-sm text-text-muted">
          <SpinnerIcon className="h-4 w-4" />
          Comprobando sesión...
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p role="status" className="text-body-sm text-text-muted">
          Redirigiendo al acceso...
        </p>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) {
      setError("Escribe tu biografía o experiencia profesional antes de continuar.");
      return;
    }

    setError(null);
    setIsGenerating(true);
    try {
      const confirmedSuggestions = hasReviewedAssistance && approvedAssistantText.length > 0
        ? `\n\nInformación factual revisada y confirmada por el usuario:\n${approvedAssistantText.map((item) => `- ${item}`).join("\n")}`
        : "";
      setCv(await generateCv(`${text}${confirmedSuggestions}`));
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "No se pudo generar el CV. Inténtalo de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  }

  function openAssistant() {
    if (!text.trim()) {
      setError("Escribe tu trayectoria antes de solicitar ayuda.");
      return;
    }
    setError(null);
    setIsAssistantOpen(true);
  }

  function updateSourceText(value: string) {
    setText(value);
    setHasReviewedAssistance(false);
    setApprovedAssistantText([]);
  }

  return (
    <div data-testid="protected-content" className="min-h-screen bg-canvas">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* LEFT COLUMN: free-text input and generation trigger */}
          <section className="flex flex-col gap-4 lg:col-span-5">
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h1 className="text-headline-lg tracking-tight text-text">Tu experiencia profesional</h1>
              <p className="mt-1 text-caption-xs text-text-muted">
                Pega tu biografía o historia laboral en texto libre; la convertimos en un CV estructurado.
              </p>

              <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-subtle p-3">
                <SparkleIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-caption-xs leading-relaxed text-text-muted">
                  Cuanta más información incluyas (años, empresas, logros con números, formación e idiomas), mejor será el
                  resultado.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-1.5">
                <label htmlFor="professional-text" className="text-body-sm font-semibold text-text">
                  Biografía o experiencia profesional
                </label>
                <textarea
                  id="professional-text"
                  value={text}
                  onChange={(event) => updateSourceText(event.target.value)}
                  rows={12}
                  data-testid="professional-text"
                  placeholder="Ej.: Ana García, ana@example.com, Madrid. Senior Designer en Acme (03-2021 a la actualidad). Lideré el rediseño del checkout, reduciendo el abandono un 18%. Educación: Diseño Gráfico en UBA (2015-2019)."
                  className="focus-ring w-full resize-y rounded-xl border border-border bg-surface p-4 text-body-sm leading-relaxed text-text placeholder:text-text-faint"
                />
                <p className="text-right text-caption-xs text-text-faint">{text.length} caracteres</p>

                {error && (
                  <p
                    role="alert"
                    data-testid="generation-error"
                    className="flex items-start gap-2 rounded-lg bg-danger-surface p-3 text-body-sm text-danger"
                  >
                    <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={openAssistant}
                    disabled={isGenerating}
                    data-testid="trajectory-assistance-open"
                    className="focus-ring flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-body-sm font-semibold text-text transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <SparkleIcon className="h-4 w-4" />
                    Mejorar trayectoria y competencias
                  </button>
                  <button
                    type="submit"
                    disabled={isGenerating}
                    data-testid="generate-submit"
                    className="focus-ring flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isGenerating ? <SpinnerIcon className="h-4 w-4" /> : <BoltIcon className="h-4 w-4" />}
                    {isGenerating ? "Generando CV..." : "Generar CV"}
                  </button>
                  <span className="text-caption-xs text-text-faint">Suele tardar menos de un minuto</span>
                </div>
              </form>
            </div>
          </section>

          {/* RIGHT COLUMN: result panel — empty, generating, or ready */}
          <section className="flex flex-col gap-4 lg:col-span-7">
            {cv ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm">
                  <TemplateSelector value={template} onChange={setTemplate} />
                  <PdfDownload cv={cv} template={template} />
                </div>
                <div className="rounded-xl bg-subtle p-4 sm:p-6">
                  <CvPreview cv={cv} template={template} />
                </div>
              </>
            ) : isGenerating ? (
              <div role="status" className="rounded-xl bg-subtle p-4 sm:p-6">
                <p className="sr-only">Generando tu CV...</p>
                <div
                  aria-hidden="true"
                  className="mx-auto aspect-[1/1.4142] w-full max-w-[620px] animate-pulse rounded border border-border bg-surface p-10"
                >
                  <div className="h-6 w-2/3 rounded bg-subtle" />
                  <div className="mt-3 h-3 w-2/5 rounded bg-subtle" />
                  <div className="mt-8 h-3 w-1/4 rounded bg-subtle" />
                  <div className="mt-3 h-3 w-full rounded bg-subtle" />
                  <div className="mt-2 h-3 w-5/6 rounded bg-subtle" />
                  <div className="mt-8 h-3 w-1/3 rounded bg-subtle" />
                  <div className="mt-3 h-3 w-full rounded bg-subtle" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-subtle" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-8 py-16 text-center">
                <DocumentIcon className="h-8 w-8 text-text-faint" />
                <p className="text-body-sm font-semibold text-text">Tu CV aparecerá aquí</p>
                <p className="max-w-xs text-caption-xs text-text-muted">
                  Escribe tu experiencia a la izquierda y pulsa &ldquo;Generar CV&rdquo; para ver la vista previa.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
      {isAssistantOpen && (
        <TrajectoryAssistant
          sourceText={text}
          onUseAccepted={(approvedText) => {
            setApprovedAssistantText(approvedText);
            setHasReviewedAssistance(true);
            setIsAssistantOpen(false);
          }}
          onContinueWithoutSuggestions={() => {
            setApprovedAssistantText([]);
            setHasReviewedAssistance(true);
            setIsAssistantOpen(false);
          }}
          onClose={() => setIsAssistantOpen(false)}
        />
      )}
    </div>
  );
}
