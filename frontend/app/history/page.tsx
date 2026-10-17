"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/session-provider";
import { AppHeader } from "../components/app-header";
import { ConfirmDialog } from "../components/confirm-dialog";
import { CvPreview, type CvTemplate } from "../components/cv-preview";
import { TemplateSelector } from "../components/template-selector";
import { PdfDownload } from "../components/pdf-download";
import { DocumentIcon, SpinnerIcon } from "../components/icons";
import { deleteResume, getResume, listResumes } from "../lib/resume-history-client";
import { getProfilePhotoUrl } from "../lib/profile-photo-client";
import type { ResumeDetail, ResumeHistoryPage, ResumeSummary } from "../types/resume-history";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function HistoryPage() {
  const { session, isLoading } = useSession();
  if (isLoading || !session) {
    return <main className="flex min-h-screen items-center justify-center bg-canvas"><p role="status" data-testid="history-session-loading">{isLoading ? "Comprobando sesión..." : "Redirigiendo al acceso..."}</p></main>;
  }
  // Remount before rendering whenever the authenticated owner changes.
  return <AccountHistory key={session.user.id} userId={session.user.id} />;
}

function AccountHistory({ userId }: { userId: string }) {
  const [page, setPage] = useState<ResumeHistoryPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResumeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [template, setTemplate] = useState<CvTemplate>("ats");
  const [photoMissing, setPhotoMissing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ResumeSummary | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const deleteRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPage(null);
    void listResumes(userId, offset, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setPage(result); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo cargar el historial."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId, offset, reload]);

  useEffect(() => setPendingDelete(null), [userId]);

  useEffect(() => () => {
    detailRequest.current?.abort();
    deleteRequest.current?.abort();
  }, []);

  async function removeResume(item: ResumeSummary) {
    if (deletingId) return;

    const controller = new AbortController();
    deleteRequest.current = controller;
    setDeletingId(item.id);
    setDeleteError(null);
    try {
      await deleteResume(userId, item.id, controller.signal);
      if (controller.signal.aborted) return;
      if (selectedId === item.id) {
        detailRequest.current?.abort();
        detailRequest.current = null;
        setSelectedId(null);
        setDetail(null);
        setDetailError(null);
        setDetailLoading(false);
      }
      const remaining = page?.items.filter((resume) => resume.id !== item.id) ?? [];
      if (page && remaining.length === 0 && offset > 0) {
        setOffset(Math.max(0, offset - 20));
      } else {
        setPage((current) => current ? { ...current, items: current.items.filter((resume) => resume.id !== item.id) } : current);
        if (page?.hasMore) setReload((value) => value + 1);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setDeleteError(failure instanceof Error ? failure.message : "No se pudo eliminar el CV. Intentá de nuevo.");
      }
    } finally {
      if (deleteRequest.current === controller) deleteRequest.current = null;
      if (!controller.signal.aborted) setDeletingId(null);
    }
  }

  async function openResume(id: string) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setPhotoMissing(false);
    setTemplate("ats");
    try {
      const result = await getResume(userId, id, controller.signal);
      const historicalCv = { ...result.data, personalInfo: { ...result.data.personalInfo } };
      if (historicalCv.personalInfo.photoPath) {
        try {
          historicalCv.personalInfo.photoUrl = await getProfilePhotoUrl(historicalCv.personalInfo.photoPath);
        } catch {
          historicalCv.personalInfo.photoUrl = null;
          if (!controller.signal.aborted) setPhotoMissing(true);
        }
      }
      if (!controller.signal.aborted) setDetail({ ...result, data: historicalCv });
    } catch (failure) {
      if (!controller.signal.aborted) setDetailError(failure instanceof Error ? failure.message : "No se pudo abrir el CV.");
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }

  return (
    <div className="app-canvas min-h-screen bg-canvas" data-testid="history-content">
      <AppHeader />
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-label-xs uppercase tracking-widest text-primary">Tu cuenta</p><h1 className="mt-1 text-headline-2xl">Historial de CVs</h1><p className="mt-2 text-body-sm text-text-muted">Cada CV generado se guarda automáticamente. Recuperá tus versiones anteriores cuando las necesites.</p></div>
          <Link href="/generate" data-testid="history-create" className="focus-ring rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary">Crear un nuevo CV</Link>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <section aria-label="Versiones guardadas" className="rounded-xl border border-border bg-surface p-5 shadow-sm lg:col-span-4">
            <h2 className="text-headline-lg">Versiones guardadas</h2>
            <p className="mt-1 text-caption-xs text-text-muted">De la más reciente a la más antigua</p>
            {deleteError && <p role="alert" data-testid="history-delete-error" className="mt-4 rounded-lg bg-danger-surface p-3 text-body-sm text-danger">{deleteError} Podés volver a intentarlo.</p>}
            {loading ? <p role="status" data-testid="history-loading" className="mt-6 flex items-center gap-2 text-body-sm text-text-muted"><SpinnerIcon className="h-4 w-4" />Cargando tu historial...</p> : error ? <div className="mt-4"><p role="alert" data-testid="history-error" className="rounded-lg bg-danger-surface p-3 text-body-sm text-danger">{error}</p><button type="button" data-testid="history-retry" onClick={() => setReload((value) => value + 1)} className="focus-ring mt-3 rounded-lg border border-border px-3 py-2 text-body-sm font-semibold">Reintentar</button></div> : page?.items.length ? (
              <ul className="mt-4 flex flex-col gap-3">
                {page.items.map((item) => <li key={item.id} className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" aria-pressed={selectedId === item.id} data-testid={`history-item-${item.id}`} onClick={() => void openResume(item.id)} className={`focus-ring min-w-0 flex-1 rounded-xl border p-4 text-left transition-colors ${selectedId === item.id ? "border-primary bg-subtle" : "border-border hover:bg-subtle"}`}><span className="block break-words text-body-sm font-semibold">{item.fullName || "CV sin nombre"}</span><time dateTime={item.createdAt} className="mt-1 block text-caption-xs text-text-muted">{formatDate(item.createdAt)}</time><span className="mt-2 line-clamp-2 break-words text-caption-xs text-text-muted">{item.summary || "Versión guardada de tu currículum"}</span></button>
                  <button type="button" aria-label={`Eliminar CV de ${item.fullName || "CV sin nombre"}`} data-testid={`history-delete-${item.id}`} disabled={deletingId !== null} onClick={() => setPendingDelete(item)} className="focus-ring rounded-lg border border-danger px-3 py-2 text-body-sm font-semibold text-danger disabled:opacity-50">{deletingId === item.id ? "Eliminando..." : "Eliminar"}</button>
                </li>)}
              </ul>
            ) : <p data-testid="history-empty" className="mt-6 text-body-sm text-text-muted">{offset ? "No hay más versiones en esta página." : "Aún no tenés CVs guardados. Generá tu primer CV para verlo aquí."}</p>}
            <nav aria-label="Páginas del historial" className="mt-5 flex items-center justify-between gap-2">
              <button type="button" data-testid="history-previous" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))} className="focus-ring rounded-lg border border-border px-3 py-2 text-body-sm disabled:opacity-40">Anterior</button>
              <span className="text-caption-xs text-text-muted">Página {Math.floor(offset / 20) + 1}</span>
              <button type="button" data-testid="history-next" disabled={loading || !page?.hasMore} onClick={() => setOffset(offset + 20)} className="focus-ring rounded-lg border border-border px-3 py-2 text-body-sm disabled:opacity-40">Siguiente</button>
            </nav>
          </section>
          <section aria-label="CV seleccionado" className="flex flex-col gap-4 lg:col-span-8">
            {detailLoading ? <p role="status" data-testid="history-detail-loading" className="flex items-center gap-2 rounded-xl bg-subtle p-8"><SpinnerIcon className="h-4 w-4" />Abriendo tu CV...</p> : detailError ? <div className="rounded-xl border border-border bg-surface p-5"><p role="alert" data-testid="history-detail-error" className="text-body-sm text-danger">{detailError}</p><button type="button" data-testid="history-detail-retry" onClick={() => selectedId && void openResume(selectedId)} className="focus-ring mt-3 rounded-lg border border-border px-3 py-2 text-body-sm">Reintentar</button></div> : detail ? <>
              <p className="text-body-sm text-text-muted">Versión del <time dateTime={detail.createdAt}>{formatDate(detail.createdAt)}</time>. Conserva los datos originales de ese CV.</p>
              {photoMissing && <p role="status" className="rounded-lg bg-warning-surface p-3 text-body-sm text-warning">La foto de esta versión ya no está disponible. Podés descargar el CV con su contenido de texto.</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm"><TemplateSelector value={template} onChange={setTemplate} /><PdfDownload cv={detail.data} template={template} /></div>
              <div className="preview-stage rounded-xl bg-subtle p-4 sm:p-6"><CvPreview cv={detail.data} template={template} /></div>
            </> : <div className="flex min-h-[350px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface p-8 text-center"><DocumentIcon className="h-10 w-10 text-primary" /><p className="text-body-sm font-semibold">Elegí una versión para revisarla</p><p className="max-w-sm text-caption-xs text-text-muted">Podrás cambiar su plantilla y volver a descargarla sin generar un CV nuevo.</p></div>}
          </section>
        </div>
      </main>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="¿Eliminar este CV?"
        description={`Vas a eliminar de forma permanente el CV de ${pendingDelete?.fullName || "CV sin nombre"}. También se borran las búsquedas de empleo y los resultados de Match asociados. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar CV"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const item = pendingDelete;
          setPendingDelete(null);
          if (item) void removeResume(item);
        }}
      />
    </div>
  );
}
