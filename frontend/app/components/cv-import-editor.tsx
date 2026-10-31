"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { StructuredCv } from "../types/cv";
import type { ChangedSection, CvSource, EditResponse, ResumeVersion } from "../types/cv-import";
import {
  deleteCvSource,
  downloadCvSource,
  importCv,
  proposeCvEdit,
  proposeResumeEdit,
  saveCvVersion,
  saveResumeVersion,
} from "../lib/cv-import-client";
import { getResume } from "../lib/resume-history-client";
import { ConfirmDialog } from "./confirm-dialog";
import { FilePickerButton } from "./file-picker-button";
import { CvPreview, type CvTemplate } from "./cv-preview";
import { PdfDownload } from "./pdf-download";
import { TemplateSelector } from "./template-selector";
import { CertificateSelector } from "./certificate-selector";
import { getProfilePhotoUrl, uploadProfilePhoto, validateProfilePhoto } from "../lib/profile-photo-client";

type BusyAction = "load" | "import" | "edit" | "save" | "download" | "delete" | null;

function formatVersionDate(value: string): string {
  return new Date(value).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

const sectionLabels: Record<ChangedSection, string> = {
  personalInfo: "información personal",
  summary: "resumen",
  experience: "experiencia",
  education: "educación",
  skills: "habilidades",
  languages: "idiomas",
  certifications: "certificaciones",
};

type CvImportEditorProps = {
  /** Opens this history version for editing (from "Editar CV" in the history). */
  initialResumeId?: string | null;
  userId?: string | null;
};

export function CvImportEditor({ initialResumeId = null, userId = null }: CvImportEditorProps = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<CvSource | null>(null);
  // Set when editing a history version instead of an imported PDF.
  const [historyVersion, setHistoryVersion] = useState<{ createdAt: string } | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const scrollToEditor = useRef(false);
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [selectedCertificateIds, setSelectedCertificateIds] = useState<string[]>([]);
  const versionRequest = useRef<{ payload: string; id: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  function resetEdit() {
    versionRequest.current = null;
    setProposal(null);
    setChangedSections([]);
    setChangeSummary("");
    setQuestions([]);
    setAnswers([]);
    setInstruction("");
    setSavedToHistory(false);
    setSelectedCertificateIds([]);
  }

  useEffect(() => {
    if (!initialResumeId || !userId) return;
    const controller = new AbortController();
    setBusy("load");
    setError(null);
    setStatus("Abriendo la versión del CV...");
    void getResume(userId, initialResumeId, controller.signal)
      .then((resume) => {
        if (controller.signal.aborted) return;
        setSource(null);
        setBaseVersion({ id: resume.id, sourceId: null, parentResumeId: null, createdAt: resume.createdAt, data: resume.data });
        setHistoryVersion({ createdAt: resume.createdAt });
        resetEdit();
        setStatus(null);
        scrollToEditor.current = true;
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus(null);
        setError("No encontramos esa versión del CV. Podés volver al Historial o importar un PDF.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(null);
      });
    return () => controller.abort();
  }, [initialResumeId, userId]);

  // Once the loaded version is on screen, bring the editor into view and move focus to it.
  useEffect(() => {
    if (!historyVersion || !scrollToEditor.current) return;
    scrollToEditor.current = false;
    const frame = requestAnimationFrame(() => {
      headingRef.current?.closest("section")?.scrollIntoView?.({ block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [historyVersion]);

  function closeHistoryVersion() {
    setHistoryVersion(null);
    setBaseVersion(null);
    resetEdit();
    setError(null);
    setStatus(null);
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Seleccioná el archivo PDF que querés importar.");
      return;
    }

    setBusy("import");
    setError(null);
    setStatus("Importando el PDF...");
    try {
      const result = await importCv(file);
      setSource(result.source);
      setHistoryVersion(null);
      setBaseVersion(result.resume);
      resetEdit();
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
    if (!baseVersion || (!source && !historyVersion)) return;
    if (!instruction.trim()) {
      setError("Describí el cambio que querés proponer.");
      return;
    }
    if (questions.length && answers.some((answer) => !answer.trim())) {
      setError("Respondé todas las preguntas antes de continuar.");
      return;
    }

    setBusy("edit");
    setError(null);
    setStatus(questions.length ? "Revisando tus respuestas..." : "Preparando una propuesta...");
    try {
      const currentCv = proposal ?? baseVersion.data;
      const result: EditResponse = source
        ? await proposeCvEdit(source.id, baseVersion.id, instruction.trim(), answers, currentCv)
        : await proposeResumeEdit(baseVersion.id, instruction.trim(), answers, currentCv);
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
    if (!baseVersion || (!source && !historyVersion)) return;
    setBusy("save");
    setError(null);
    setStatus("Guardando nueva versión...");
    try {
      const data = cleanCv(proposal ?? baseVersion.data);
      const requestPayload = JSON.stringify({ baseResumeId: baseVersion.id, data, selectedCertificateIds });
      if (versionRequest.current?.payload !== requestPayload) versionRequest.current = { payload: requestPayload, id: crypto.randomUUID() };
      const requestId = versionRequest.current.id;
      const saved = source
        ? await saveCvVersion(source.id, baseVersion.id, data, requestId, selectedCertificateIds)
        : await saveResumeVersion(baseVersion.id, data, requestId, selectedCertificateIds);
      // The saved version becomes the base, so editing can continue from it.
      setBaseVersion(saved);
      if (historyVersion) setHistoryVersion({ createdAt: saved.createdAt });
      setProposal(null);
      setChangedSections([]);
      setChangeSummary("");
      setSavedToHistory(true);
      setSelectedCertificateIds([]);
      versionRequest.current = null;
      setStatus(saved.certificateMergeReport?.duplicateIds.length
        ? "Nueva versión guardada. Los certificados existentes no se duplicaron. Ya aparece en tu Historial."
        : "Nueva versión guardada. Ya aparece en tu Historial.");
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
    if (!source) return;
    setBusy("delete");
    setError(null);
    try {
      await deleteCvSource(source.id);
      setSource(null);
      setBaseVersion(null);
      resetEdit();
      setStatus("Fuente eliminada.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el CV importado.");
    } finally {
      setBusy(null);
    }
  }

  const displayedCv = proposal ?? baseVersion?.data ?? null;
  const photoPath = displayedCv?.personalInfo.photoPath ?? null;
  useEffect(() => {
    let active = true;
    if (!photoPath) { setPhotoUrl(null); return; }
    setPhotoUrl(null);
    void getProfilePhotoUrl(photoPath).then((url) => { if (active) setPhotoUrl(url); })
      .catch(() => { if (active) setPhotoUrl(null); });
    return () => { active = false; };
  }, [photoPath]);
  const previewCv = displayedCv ? { ...displayedCv, personalInfo: { ...displayedCv.personalInfo, photoUrl } } : null;

  async function changePhoto(file: File | null) {
    if (!baseVersion) return;
    if (file) {
      const validation = validateProfilePhoto(file);
      if (validation) { setError(validation); return; }
      setBusy("save"); setError(null);
      try {
        const path = await uploadProfilePhoto(file);
        setProposal({ ...cleanCv(proposal ?? baseVersion.data), personalInfo: { ...cleanCv(proposal ?? baseVersion.data).personalInfo, photoPath: path } });
        setStatus("Foto agregada a la propuesta. Guardá una nueva versión para conservarla.");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo subir la foto."); }
      finally { setBusy(null); }
    } else {
      setProposal({ ...cleanCv(proposal ?? baseVersion.data), personalInfo: { ...cleanCv(proposal ?? baseVersion.data).personalInfo, photoPath: null } });
      setStatus("Foto quitada de la propuesta. Guardá una nueva versión para conservar el cambio.");
    }
  }

  return (
    <section
      id="editar-cv"
      aria-labelledby="cv-import-heading"
      data-testid="cv-import-editor"
      className="workspace-card mt-8 scroll-mt-20 rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <div className="max-w-3xl">
        <h2 id="cv-import-heading" ref={headingRef} tabIndex={-1} className="text-headline-lg tracking-tight text-text focus:outline-none">
          Editá un CV existente
        </h2>
        <p className="mt-1 text-body-sm text-text-muted">
          {historyVersion
            ? "Pedile a la IA cambios concretos en tus secciones o experiencias. Revisarás cada propuesta y se guardará como una versión nueva, sin modificar la original."
            : "Importá un PDF con texto seleccionable y pedile a la IA cambios concretos en tus secciones o experiencias. Revisarás cada propuesta antes de guardarla."}
        </p>

        {!source && !historyVersion && busy !== "load" && (
          <form onSubmit={handleImport} className="mt-5 flex flex-col items-start gap-3">
            <label htmlFor="cv-import-file" className="text-body-sm font-semibold text-text">
              Seleccioná el CV en PDF
            </label>
            <FilePickerButton
              id="cv-import-file"
              accept="application/pdf,.pdf"
              disabled={busy !== null}
              fileName={file?.name}
              onSelect={(selected) => setFile(selected ?? null)}
              testIds={{ input: "cv-import-file", browse: "cv-import-browse", filename: "cv-import-filename" }}
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

        {historyVersion && baseVersion && (
          <div data-testid="cv-history-edit-banner" className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-subtle p-3">
            <p className="min-w-0 flex-1 text-body-sm font-semibold text-text">
              Editando tu CV del {formatVersionDate(historyVersion.createdAt)}
            </p>
            <button
              type="button"
              onClick={closeHistoryVersion}
              disabled={busy !== null}
              data-testid="cv-history-edit-close"
              className="focus-ring rounded-md border border-border bg-surface px-3 py-1.5 text-body-sm font-semibold text-text hover:bg-subtle disabled:opacity-70"
            >
              Importar otro PDF
            </button>
          </div>
        )}

        {source && baseVersion && (
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
              onClick={() => setConfirmingDelete(true)}
              disabled={busy !== null}
              data-testid="cv-import-delete"
              className="focus-ring rounded-md border border-danger px-3 py-1.5 text-body-sm font-semibold text-danger hover:bg-danger-surface disabled:opacity-70"
            >
              {busy === "delete" ? "Eliminando..." : "Eliminar CV importado"}
            </button>
          </div>
        )}

        {(source || historyVersion) && baseVersion && (
          <>
            <div className="mt-5"><CertificateSelector selectedIds={selectedCertificateIds} onChange={setSelectedCertificateIds} /></div>
            <section className="mt-5 rounded-xl border border-border p-4" aria-label="Foto del CV">
              <h3 className="text-body-sm font-semibold">Foto del CV</h3>
              {photoUrl && photoPath && <img src={photoUrl} alt="Foto actual del CV" data-testid="cv-edit-photo-preview" className="mt-2 h-24 w-24 rounded object-cover" />}
              <input ref={photoInputRef} id="cv-edit-photo" aria-label="Archivo de foto del CV" className="sr-only" data-testid="cv-edit-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void changePhoto(file); event.target.value = ""; }} />
              <button type="button" data-testid="cv-edit-photo-button" disabled={busy !== null} onClick={() => photoInputRef.current?.click()} className="focus-ring mt-3 rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70">{photoPath ? "Reemplazar foto" : "Agregar foto"}</button>
              {photoPath && <button type="button" data-testid="cv-edit-remove-photo" onClick={() => void changePhoto(null)} className="mt-2 block rounded border border-border px-3 py-1 text-body-sm">Quitar foto</button>}
              <p className="mt-2 text-caption-xs text-text-muted">La plantilla ATS omite la foto; las plantillas visuales la muestran.</p>
            </section>
            <form onSubmit={handlePropose} className="mt-5 flex flex-col gap-2">
              <label htmlFor="cv-edit-instruction" className="text-body-sm font-semibold text-text">
                {proposal ? "¿Qué querés ajustar de esta propuesta?" : "¿Qué querés cambiar?"}
              </label>
              <textarea
                id="cv-edit-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                maxLength={4000}
                rows={3}
                data-testid="cv-edit-instruction"
                placeholder="Ej.: Agregá mi experiencia en Acme, eliminá la sección de certificaciones o mejorá el resumen."
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
            {savedToHistory && (
              <>
                {" "}
                <Link href="/history" data-testid="cv-import-history-link" className="focus-ring rounded font-semibold text-primary underline">
                  Ver en Historial
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      {displayedCv && (
        <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-4">
            {(proposal || selectedCertificateIds.length > 0) ? (
              <section
                aria-label="Revisión de la propuesta"
                data-testid="cv-import-proposal"
                className="rounded-xl border border-border bg-surface p-4"
              >
                <h3 className="text-body-sm font-semibold text-text">Revisá la propuesta antes de guardar</h3>
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
            <PdfDownload cv={previewCv ?? displayedCv} template={template} />
          </div>
          <div className="preview-stage rounded-2xl p-4 sm:p-6 lg:col-span-8">
            <CvPreview cv={previewCv ?? displayedCv} template={template} />
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmingDelete}
        title="¿Eliminar el PDF importado?"
        description="Vas a eliminar de forma permanente el PDF importado y todas sus versiones. Esta acción no se puede deshacer."
        confirmLabel="Eliminar PDF y versiones"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          void handleDelete();
        }}
      />
    </section>
  );
}

function cleanCv(cv: StructuredCv): StructuredCv {
  const { photoUrl: _photoUrl, ...personalInfo } = cv.personalInfo;
  return { ...cv, personalInfo };
}
