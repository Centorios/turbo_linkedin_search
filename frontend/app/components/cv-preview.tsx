"use client";

import { useEffect, useState } from "react";
import type { StructuredCv } from "../types/cv";
import { renderCvPdf } from "../lib/cv-pdf";
import type { CvTemplate } from "../templates/registry";
import { AlertIcon, SpinnerIcon } from "./icons";

export type { CvTemplate } from "../templates/registry";

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error" };

// Brief pause so quick consecutive changes render a single PDF.
const RENDER_DELAY_MS = 150;

// Browsers without a built-in PDF viewer (e.g. Android Chrome) would download
// an embedded PDF instead of showing it, so they get a link instead.
function canEmbedPdf(): boolean {
  return typeof navigator === "undefined" || navigator.pdfViewerEnabled !== false;
}

// Shows the same PDF the user downloads (see renderCvPdf), not an HTML copy.
export function CvPreview({ cv, template }: { cv: StructuredCv; template: CvTemplate }) {
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [embeddable, setEmbeddable] = useState(true);

  useEffect(() => setEmbeddable(canEmbedPdf()), []);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setState({ status: "loading" });

    const timer = setTimeout(() => {
      renderCvPdf(cv, template)
        .then((blob) => {
          if (cancelled) return;
          url = URL.createObjectURL(blob);
          setState({ status: "ready", url });
        })
        .catch(() => {
          if (!cancelled) setState({ status: "error" });
        });
    }, RENDER_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [cv, template]);

  return (
    <div className="mx-auto flex w-full max-w-[620px] flex-col gap-2">
      <section
        aria-label="Vista previa del CV"
        aria-busy={state.status === "loading"}
        data-testid="cv-preview"
        className="relative aspect-[1/1.4142] w-full overflow-hidden rounded border border-border bg-surface shadow-sm"
      >
        {state.status === "ready" && embeddable && (
          <iframe
            data-testid="cv-preview-frame"
            title="Vista previa del CV en PDF"
            src={`${state.url}#toolbar=0&navpanes=0&view=FitH`}
            className="h-full w-full border-0"
          />
        )}
        {state.status === "ready" && !embeddable && (
          <p
            data-testid="cv-preview-unsupported"
            className="absolute inset-0 flex items-center justify-center p-6 text-center text-body-sm text-text-muted"
          >
            Este navegador no puede mostrar el PDF dentro de la página. Ábrelo con el enlace de abajo.
          </p>
        )}
        {state.status === "loading" && (
          <p
            data-testid="cv-preview-loading"
            className="absolute inset-0 flex items-center justify-center gap-2 text-body-sm text-text-muted"
          >
            <SpinnerIcon className="h-4 w-4" />
            Generando vista previa...
          </p>
        )}
        {state.status === "error" && (
          <p
            role="alert"
            data-testid="cv-preview-error"
            className="absolute inset-0 flex items-center justify-center gap-2 p-6 text-center text-body-sm text-danger"
          >
            <AlertIcon className="h-4 w-4 shrink-0" />
            No se pudo generar la vista previa. Cambia de plantilla o vuelve a intentarlo.
          </p>
        )}
      </section>
      {state.status === "ready" && (
        <a
          href={state.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="cv-preview-open"
          className="focus-ring self-end rounded text-caption-xs text-text-muted underline hover:text-text"
        >
          Abrir vista previa en otra pestaña
        </a>
      )}
    </div>
  );
}
