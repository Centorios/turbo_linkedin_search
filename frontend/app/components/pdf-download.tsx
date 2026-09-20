"use client";

import { useRef, useState } from "react";
import type { StructuredCv } from "../types/cv";
import type { CvTemplate } from "./cv-preview";

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
    <div>
      <button type="button" onClick={handleDownload} disabled={status === "downloading"} data-testid="pdf-download">
        {status === "downloading" ? "Descargando PDF..." : "Descargar PDF"}
      </button>
      {status === "error" && <p role="alert" data-testid="pdf-download-error">No se pudo generar el PDF. Inténtalo de nuevo.</p>}
    </div>
  );
}
