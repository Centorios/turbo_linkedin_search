"use client";

import { FormEvent, useState } from "react";
import { AuthControls } from "../components/auth-controls";
import { useSession } from "../auth/session-provider";
import { generateCv } from "../lib/generate-cv-client";
import { CvPreview, type CvTemplate } from "../components/cv-preview";
import { TemplateSelector } from "../components/template-selector";
import { PdfDownload } from "../components/pdf-download";

export default function GeneratePage() {
  const { session, isLoading } = useSession();
  const [text, setText] = useState("");
  const [cv, setCv] = useState<Awaited<ReturnType<typeof generateCv>> | null>(null);
  const [template, setTemplate] = useState<CvTemplate>("ats");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (isLoading) {
    return <p role="status" data-testid="session-loading">Comprobando sesión...</p>;
  }

  if (!session) {
    return <p role="status">Redirigiendo al acceso...</p>;
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
      setCv(await generateCv(text));
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "No se pudo generar el CV. Inténtalo de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main>
      <header>
        <h1>Generar CV</h1>
        <AuthControls />
      </header>
      <form onSubmit={handleSubmit}>
        <label htmlFor="professional-text">Biografía o experiencia profesional</label>
        <textarea id="professional-text" value={text} onChange={(event) => setText(event.target.value)} rows={12} data-testid="professional-text" />
        {error && <p role="alert" data-testid="generation-error">{error}</p>}
        <button type="submit" disabled={isGenerating} data-testid="generate-submit">
          {isGenerating ? "Generando CV..." : "Generar CV"}
        </button>
      </form>
      {cv && <><TemplateSelector value={template} onChange={setTemplate} /><CvPreview cv={cv} template={template} /><PdfDownload cv={cv} template={template} /></>}
      <p data-testid="protected-content">Esta área está disponible para tu sesión activa.</p>
    </main>
  );
}
