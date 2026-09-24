"use client";

import { useRef, useState } from "react";
import type { StructuredCv } from "../types/cv";
import type { CvTemplate } from "./cv-preview";
import { AlertIcon, DownloadIcon, SpinnerIcon } from "./icons";

type DownloadStatus = "idle" | "downloading" | "error";

export function PdfDownload({ cv, template }: { cv: StructuredCv; template: CvTemplate }) {
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const isDownloadingRef = useRef(false);

  async function handleDownload() {
    if (isDownloadingRef.current) {
      return;
    }
    isDownloadingRef.current = true;
    setStatus("downloading");

    try {
      const [{ pdf }, { CvPdfDocument, buildCvFileName }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../templates/cv-pdf-document"),
      ]);
      const blob = await pdf(<CvPdfDocument cv={cv} template={template} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildCvFileName(cv, template);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      isDownloadingRef.current = false;
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === "downloading"}
        data-testid="pdf-download"
        className="focus-ring flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "downloading" ? <SpinnerIcon className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
        {status === "downloading" ? "Descargando PDF..." : "Descargar PDF"}
      </button>
      {status === "error" && (
        <p role="alert" data-testid="pdf-download-error" className="flex items-center gap-1.5 text-caption-xs text-danger">
          <AlertIcon className="h-3.5 w-3.5 shrink-0" />
          No se pudo generar el PDF. Inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}
