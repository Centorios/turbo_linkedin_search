"use client";

import { FormEvent, useState } from "react";
import type { StructuredCv } from "../types/cv";
import type { ChangedSection, CvSource, EditResponse, ResumeVersion } from "../types/cv-import";
import { deleteCvSource, downloadCvSource, importCv, proposeCvEdit, saveCvVersion } from "../lib/cv-import-client";
import { CvPreview, type CvTemplate } from "./cv-preview";
import { PdfDownload } from "./pdf-download";
import { TemplateSelector } from "./template-selector";

type BusyAction = "import" | "edit" | "save" | "download" | "delete" | null;

const sectionLabels: Record<ChangedSection, string> = {
  personalInfo: "información personal",
  summary: "resumen",
  experience: "experiencia",
  education: "educación",
  skills: "habilidades",
  languages: "idiomas",
  certifications: "certificaciones",
};

export function CvImportEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<CvSource | null>(null);
  const [baseVersion, setBaseVersion] = useState<ResumeVersion | null>(null);
  const [proposal, setProposal] = useState<StructuredCv | null>(null);
  const [changedSections, setChangedSections] = useState<ChangedSection[]>([]);
  const [changeSummary, setChangeSummary] = useState("");
  const [instruction, setInstruction] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [template, setTemplate] = useState<CvTemplate>("ats");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Selecciona el archivo PDF que quieres importar.");
      return;
    }

    setBusy("import");
    setError(null);
    setStatus("Importando el PDF...");
    try {
      const result = await importCv(file);
      setSource(result.source);
      setBaseVersion(result.resume);
      setProposal(null);
      setQuestions([]);
      setAnswers([]);
      setInstruction("");
      setStatus(`CV importado: ${result.source.originalFilename}`);
    } catch (importError) {
      setStatus(null);
      setError(importError instanceof Error ? importError.message : "No se pudo importar el CV.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePropose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!source || !baseVersion) return;
    if (!instruction.trim()) {
      setError("Describe el cambio que quieres proponer.");
      return;
    }
    if (questions.length && answers.some((answer) => !answer.trim())) {
      setError("Responde todas las preguntas antes de continuar.");
      return;
    }

    setBusy("edit");
    setError(null);
    setStatus(questions.length ? "Revisando tus respuestas..." : "Preparando una propuesta...");
    try {
      const result: EditResponse = await proposeCvEdit(
        source.id,
        baseVersion.id,
        instruction.trim(),
        answers,
        proposal ?? baseVersion.data,
      );
      if (result.status === "needs_input") {
        setQuestions(result.questions);
        setAnswers(result.questions.map(() => ""));
        setStatus("La IA necesita algunos datos para preparar una propuesta.");
      } else {
        setProposal(result.proposedCv);
        setChangedSections(result.changedSections);
        setChangeSummary(result.changeSummary);
        setQuestions([]);
        setAnswers([]);
        setInstruction("");
        setStatus("Propuesta lista para revisar. No se guardará hasta que la confirmes.");
      }
    } catch (editError) {
      setStatus(null);
      setError(editError instanceof Error ? editError.message : "No se pudo preparar la propuesta.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!source || !baseVersion || !proposal) return;
    setBusy("save");
    setError(null);
    setStatus("Guardando nueva versión...");
    try {
      const saved = await saveCvVersion(source.id, baseVersion.id, proposal);
      setBaseVersion(saved);
      setProposal(null);
      setChangedSections([]);
      setChangeSummary("");
      setStatus("Nueva versión guardada.");
    } catch (saveError) {
      setStatus(null);
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la versión.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    if (!source) return;
    setBusy("download");
    setError(null);
    try {
      const blob = await downloadCvSource(source.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = source.originalFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setStatus("PDF original descargado.");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "No se pudo descargar el PDF original.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!source || !window.confirm("¿Eliminar el PDF importado y todas sus versiones?")) return;
    setBusy("delete");
    setError(null);
    try {
      await deleteCvSource(source.id);
      setSource(null);
      setBaseVersion(null);
      setProposal(null);
      setQuestions([]);
      setAnswers([]);
      setInstruction("");
      setStatus("Fuente eliminada.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el CV importado.");
    } finally {
      setBusy(null);
    }
  }

  const displayedCv = proposal ?? baseVersion?.data ?? null;

  return (
    <section
      aria-labelledby="cv-import-heading"
      data-testid="cv-import-editor"
      className="workspace-card mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <div className="max-w-3xl">
        <h2 id="cv-import-heading" className="text-headline-lg tracking-tight text-text">
          Edita un CV existente
        </h2>
        <p className="mt-1 text-body-sm text-text-muted">
          Importa un PDF con texto seleccionable y pide a la IA cambios concretos en tus secciones o experiencias.
          Revisarás cada propuesta antes de guardarla.
        </p>

        {!source && (
          <form onSubmit={handleImport} className="mt-5 flex flex-col items-start gap-3">
            <label htmlFor="cv-import-file" className="text-body-sm font-semibold text-text">
              Selecciona el CV en PDF
            </label>
            <input
              id="cv-import-file"
              type="file"
              accept="application/pdf,.pdf"
              data-testid="cv-import-file"
              disabled={busy !== null}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="focus-ring block w-full max-w-xl rounded-lg border border-border bg-surface px-3 py-2 text-body-sm text-text file:mr-3 file:rounded-md file:border-0 file:bg-subtle file:px-3 file:py-1.5 file:font-semibold"
            />
            <p className="text-caption-xs text-text-muted">
              Máximo 10 MiB y 20 páginas. No se admiten PDF escaneados sin texto extraíble.
            </p>
            <button
              type="submit"
              disabled={busy !== null}
              data-testid="cv-import-submit"
              className="focus-ring rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy === "import" ? "Importando..." : "Importar CV"}
            </button>
          </form>
        )}

        {source && baseVersion && (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-subtle p-3">
              <p className="min-w-0 flex-1 text-body-sm font-semibold text-text">
                CV importado: {source.originalFilename}
              </p>
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={busy !== null}
                data-testid="cv-import-download"
                className="focus-ring rounded-md border border-border bg-surface px-3 py-1.5 text-body-sm font-semibold text-text hover:bg-subtle disabled:opacity-70"
              >
                {busy === "download" ? "Descargando..." : "Descargar PDF original"}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy !== null}
                data-testid="cv-import-delete"
                className="focus-ring rounded-md border border-danger px-3 py-1.5 text-body-sm font-semibold text-danger hover:bg-danger-surface disabled:opacity-70"
              >
                {busy === "delete" ? "Eliminando..." : "Eliminar CV importado"}
              </button>
            </div>

            <form onSubmit={handlePropose} className="mt-5 flex flex-col gap-2">
              <label htmlFor="cv-edit-instruction" className="text-body-sm font-semibold text-text">
                {proposal ? "¿Qué quieres ajustar de esta propuesta?" : "¿Qué quieres cambiar?"}
              </label>
              <textarea
                id="cv-edit-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                maxLength={4000}
                rows={3}
                data-testid="cv-edit-instruction"
                placeholder="Ej.: Agrega mi experiencia en Acme, elimina la sección de certificaciones o mejora el resumen."
                className="focus-ring w-full resize-y rounded-lg border border-border bg-surface p-3 text-body-sm text-text placeholder:text-text-faint"
              />
              {questions.map((question, index) => (
                <div key={`${question}-${index}`} className="flex flex-col gap-1">
                  <label htmlFor={`cv-edit-answer-${index}`} className="text-body-sm font-semibold text-text">
                    {question}
                  </label>
                  <textarea
                    id={`cv-edit-answer-${index}`}
                    value={answers[index] ?? ""}
                    onChange={(event) =>
                      setAnswers((current) =>
                        current.map((answer, answerIndex) => (answerIndex === index ? event.target.value : answer)),
                      )
                    }
                    maxLength={2000}
                    rows={2}
                    data-testid={`cv-edit-answer-${index}`}
                    className="focus-ring w-full resize-y rounded-lg border border-border bg-surface p-3 text-body-sm text-text"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={busy !== null}
                data-testid="cv-edit-submit"
                className="focus-ring mt-1 w-fit rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy === "edit"
                  ? "Preparando propuesta..."
                  : questions.length
                    ? "Enviar respuestas"
                    : proposal
                      ? "Proponer ajuste"
                      : "Proponer cambios"}
              </button>
            </form>
          </>
        )}

        {error && (
          <p role="alert" data-testid="cv-import-error" className="mt-4 rounded-lg bg-danger-surface p-3 text-body-sm text-danger">
            {error}
          </p>
        )}
        {status && (
          <p role="status" data-testid="cv-import-status" aria-live="polite" className="mt-4 text-body-sm text-text-muted">
            {status}
          </p>
        )}
      </div>

      {displayedCv && (
        <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-4">
            {proposal ? (
              <section
                aria-label="Revisión de la propuesta"
                data-testid="cv-import-proposal"
                className="rounded-xl border border-border bg-surface p-4"
              >
                <h3 className="text-body-sm font-semibold text-text">Revisa la propuesta antes de guardar</h3>
                <p className="mt-2 text-caption-xs text-text-muted">{changeSummary}</p>
                <p data-testid="cv-import-changed-sections" className="mt-2 text-caption-xs text-text-muted">
                  Secciones modificadas: {changedSections.length ? changedSections.map((section) => sectionLabels[section]).join(", ") : "ninguna"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={busy !== null}
                    data-testid="cv-import-save"
                    className="focus-ring rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-70"
                  >
                    {busy === "save" ? "Guardando..." : "Guardar nueva versión"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProposal(null);
                      setChangedSections([]);
                      setChangeSummary("");
                      setQuestions([]);
                      setAnswers([]);
                      setStatus("Propuesta descartada; el CV guardado no cambió.");
                    }}
                    disabled={busy !== null}
                    data-testid="cv-import-discard"
                    className="focus-ring rounded-lg border border-border px-4 py-2 text-body-sm font-semibold text-text hover:bg-subtle disabled:opacity-70"
                  >
                    Descartar propuesta
                  </button>
                </div>
              </section>
            ) : (
              <p className="rounded-xl border border-border bg-subtle p-4 text-body-sm text-text-muted">
                Esta es la versión guardada. Las propuestas de la IA no modificarán el CV hasta que las guardes.
              </p>
            )}
            <TemplateSelector value={template} onChange={setTemplate} />
            <PdfDownload cv={displayedCv} template={template} />
          </div>
          <div className="preview-stage rounded-2xl p-4 sm:p-6 lg:col-span-8">
            <CvPreview cv={displayedCv} template={template} />
          </div>
        </div>
      )}
    </section>
  );
}
