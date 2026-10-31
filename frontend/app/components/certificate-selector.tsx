"use client";

import { useEffect, useRef, useState } from "react";
import type { ProfileCertificate } from "../types/profile-certificate";
import type { Certification, Language } from "../types/cv";
import { deleteProfileCertificate, downloadProfileCertificate, listProfileCertificates, reviewProfileCertificate, uploadProfileCertificate } from "../lib/profile-certificate-client";
import { ConfirmDialog } from "./confirm-dialog";

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function CertificateSelector({ selectedIds, onChange }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ProfileCertificate[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(false);
  const [listAttempt, setListAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [certificateToDelete, setCertificateToDelete] = useState<ProfileCertificate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => {
    let active = true;
    void listProfileCertificates().then((rows) => {
      if (active) { setItems(rows); setListError(false); setLoadingList(false); }
    }).catch((cause) => {
      if (active) { setError(cause instanceof Error ? cause.message : "No se pudo cargar la lista de certificados."); setListError(true); setLoadingList(false); }
    });
    return () => { active = false; };
  }, [listAttempt]);

  const ready = items.filter((item) => item.status === "ready");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (files.length > 10) { setError("Subí hasta 10 certificados por vez."); return; }
    setBusy(true); setError(null); setMessage(null);
    const nextIds = new Set(selectedIds);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadProfileCertificate(file);
        setItems((current) => [result, ...current.filter((item) => item.id !== result.id)]);
        if (result.status === "ready") nextIds.add(result.id);
        setMessage(result.duplicate ? "El certificado ya estaba en tu perfil." : "Certificado agregado a tu perfil.");
      }
      onChange([...nextIds]);
    } catch (cause) {
      onChange([...nextIds]);
      setError(cause instanceof Error ? cause.message : "No se pudo subir el certificado.");
    } finally { setBusy(false); }
  }

  async function review(item: ProfileCertificate, certification: Certification, language: Language | null) {
    setBusy(true); setError(null);
    try {
      const updated = await reviewProfileCertificate(item.id, certification, language);
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row));
      onChange([...new Set([...selectedIds, updated.id])]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo revisar el certificado."); }
    finally { setBusy(false); }
  }

  async function viewFile(item: ProfileCertificate) {
    setViewingId(item.id); setError(null);
    try {
      const blob = await downloadProfileCertificate(item.id);
      setPreview({ url: URL.createObjectURL(blob), name: item.originalFilename, mimeType: item.mimeType });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el archivo del certificado.");
    } finally { setViewingId(null); }
  }

  async function deleteCertificate() {
    if (!certificateToDelete) return;
    setDeleting(true); setError(null); setMessage(null);
    try {
      await deleteProfileCertificate(certificateToDelete.id);
      setItems((current) => current.filter((item) => item.id !== certificateToDelete.id));
      onChange(selectedIds.filter((id) => id !== certificateToDelete.id));
      setMessage("Certificado eliminado de tu perfil.");
      setCertificateToDelete(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el certificado.");
      setCertificateToDelete(null);
    } finally { setDeleting(false); }
  }

  return <section aria-label="Certificados del perfil" data-testid="certificate-selector" className="rounded-xl border border-border bg-surface p-4">
    <h3 className="text-body-sm font-semibold text-text">Certificados</h3>
    <p className="mt-1 text-caption-xs text-text-muted">Elegí los certificados que querés adjuntar a esta versión del CV.</p>
    <input ref={fileInput} aria-label="Archivos de certificados" className="sr-only" data-testid="certificate-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={busy} onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
    <button type="button" data-testid="certificate-upload" disabled={busy} onClick={() => fileInput.current?.click()} className="focus-ring mt-3 rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70">Subir Archivo</button>
    <h4 className="mt-5 text-body-sm font-semibold text-text">Lista de Certificados</h4>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" data-testid="certificate-select-all" disabled={busy || !ready.length} onClick={() => onChange(ready.map((item) => item.id))} className="focus-ring rounded border border-border px-3 py-1 text-body-sm">Seleccionar todos</button>
      <button type="button" data-testid="certificate-clear" disabled={busy || !selectedIds.length} onClick={() => onChange([])} className="focus-ring rounded border border-border px-3 py-1 text-body-sm">Quitar selección</button>
    </div>
    {loadingList && <p role="status" className="mt-3 text-body-sm text-text-muted">Cargando certificados...</p>}
    {!loadingList && !listError && items.length === 0 && <p className="mt-3 text-body-sm text-text-muted">Todavía no tenés certificados guardados.</p>}
    <ul className="mt-3 space-y-2">
      {items.map((item) => <li key={item.id} className="rounded border border-border p-2">
        {item.status === "ready" ? <label className="flex items-center gap-2 text-body-sm"><input data-testid={`certificate-checkbox-${item.id}`} type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...new Set([...selectedIds, item.id])] : selectedIds.filter((id) => id !== item.id))} />{item.certification.name || item.originalFilename}</label> : <ReviewForm item={item} busy={busy} onReview={(certification, language) => void review(item, certification, language)} />}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" data-testid={`certificate-view-${item.id}`} disabled={viewingId === item.id || deleting} onClick={() => void viewFile(item)} className="focus-ring rounded border border-border px-3 py-1 text-body-sm text-text hover:bg-subtle disabled:opacity-60">{viewingId === item.id ? "Abriendo..." : "Ver archivo"}</button>
          <button type="button" data-testid={`certificate-delete-${item.id}`} disabled={deleting} onClick={() => setCertificateToDelete(item)} className="focus-ring rounded border border-danger px-3 py-1 text-body-sm text-danger hover:bg-danger-surface disabled:opacity-60">Eliminar certificado</button>
        </div>
      </li>)}
    </ul>
    {busy && <p role="status">Procesando certificados...</p>}
    {message && <p role="status" data-testid="certificate-message">{message}</p>}
    {error && <p role="alert" data-testid="certificate-error">{error}</p>}
    {listError && <button type="button" data-testid="certificate-retry" onClick={() => { setError(null); setLoadingList(true); setListAttempt((count) => count + 1); }} className="focus-ring mt-2 rounded border border-border px-3 py-1 text-body-sm">Reintentar carga</button>}
    {preview && <div role="dialog" aria-modal="true" aria-label="Archivo de certificado" data-testid="certificate-preview" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-surface p-4 text-text shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="truncate text-body-sm font-semibold">{preview.name}</h4>
          <button type="button" onClick={() => setPreview(null)} data-testid="certificate-preview-close" className="focus-ring rounded border border-border px-3 py-1 text-body-sm">Cerrar</button>
        </div>
        {preview.mimeType === "application/pdf" ? <iframe src={preview.url} title={preview.name} className="h-full w-full rounded border border-border bg-white" /> : <img src={preview.url} alt={preview.name} className="h-full w-full object-contain" />}
      </div>
    </div>}
    <ConfirmDialog open={certificateToDelete !== null} title="Eliminar certificado" description={`¿Querés eliminar ${certificateToDelete?.originalFilename ?? "este certificado"} de tu perfil? Los CV ya guardados conservarán sus datos.`} confirmLabel="Eliminar certificado" isBusy={deleting} onConfirm={() => void deleteCertificate()} onCancel={() => setCertificateToDelete(null)} />
  </section>;
}

function ReviewForm({ item, busy, onReview }: { item: ProfileCertificate; busy: boolean; onReview: (certification: Certification, language: Language | null) => void }) {
  const [certification, setCertification] = useState(item.certification);
  const [language, setLanguage] = useState<Language | null>(item.language);
  const fields: { key: keyof Certification; label: string }[] = [
    { key: "name", label: "Nombre" }, { key: "issuer", label: "Emisor" },
    { key: "issueDate", label: "Fecha de emisión (AAAA o MM-AAAA)" },
    { key: "expirationDate", label: "Vencimiento (AAAA o MM-AAAA)" },
    { key: "credential", label: "Referencia" },
  ];
  return <div className="space-y-2 text-body-sm" data-testid={`certificate-review-form-${item.id}`}>
    <p>Revisá {item.originalFilename} antes de seleccionarlo.</p>
    {fields.map(({ key, label }) => <label key={key} className="block">{label}
      <input data-testid={`certificate-review-${key}-${item.id}`} value={certification[key]} onChange={(event) => setCertification((current) => ({ ...current, [key]: event.target.value }))} className="block w-full rounded border border-border p-1" />
    </label>)}
    <label className="block">Idioma acreditado
      <input data-testid={`certificate-review-language-${item.id}`} value={language?.name ?? ""} onChange={(event) => setLanguage({ name: event.target.value, proficiency: language?.proficiency ?? "" })} className="block w-full rounded border border-border p-1" />
    </label>
    <label className="block">Nivel acreditado
      <input data-testid={`certificate-review-proficiency-${item.id}`} value={language?.proficiency ?? ""} onChange={(event) => setLanguage({ name: language?.name ?? "", proficiency: event.target.value })} className="block w-full rounded border border-border p-1" />
    </label>
    <button type="button" data-testid={`certificate-review-${item.id}`} disabled={busy || !certification.name.trim()} onClick={() => onReview(certification, language?.name.trim() ? language : null)} className="rounded border border-border p-1">Confirmar</button>
  </div>;
}
