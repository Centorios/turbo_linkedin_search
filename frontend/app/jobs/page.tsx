"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useSession } from "../auth/session-provider";
import { AppHeader } from "../components/app-header";
import { SpinnerIcon } from "../components/icons";
import { getSearchProfile, searchJobs } from "../lib/jobs-client";
import { listResumes } from "../lib/resume-history-client";
import type { ResumeSummary } from "../types/resume-history";
import type { JobListing, JobSearchResponse } from "../types/jobs";

export default function JobsPage() {
  const { session, isLoading } = useSession();
  if (isLoading || !session) {
    return <main className="flex min-h-screen items-center justify-center bg-canvas"><p role="status" data-testid="jobs-session-loading">{isLoading ? "Comprobando sesión..." : "Redirigiendo al acceso..."}</p></main>;
  }
  return <AccountJobs key={session.user.id} userId={session.user.id} />;
}

function AccountJobs({ userId }: { userId: string }) {
  const [resumes, setResumes] = useState<ResumeSummary[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [resumesError, setResumesError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileReload, setProfileReload] = useState(0);
  const [skills, setSkills] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("Argentina");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<JobSearchResponse | null>(null);
  const searchRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setResumesLoading(true);
    setResumesError(null);
    setResumes([]);
    setSelectedId("");
    void listResumes(userId, 0, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setResumes(page.items);
        if (page.items.length > 0) setProfileLoading(true);
        setSelectedId(page.items[0]?.id ?? "");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResumesError(error instanceof Error ? error.message : "No se pudieron cargar tus CVs.");
      })
      .finally(() => { if (!controller.signal.aborted) setResumesLoading(false); });
    return () => controller.abort();
  }, [userId, reload]);

  useEffect(() => {
    searchRequest.current?.abort();
    setResult(null);
    setSearchError(null);
    setSearching(false);
    setKeywords("");
    setLocation("Argentina");
    setSkills([]);
    setProfileError(null);
    if (!selectedId) {
      setProfileLoading(false);
      return;
    }
    const controller = new AbortController();
    setProfileLoading(true);
    void getSearchProfile(userId, selectedId, controller.signal)
      .then((profile) => {
        if (controller.signal.aborted) return;
        setKeywords(profile.suggestedKeywords);
        setLocation(profile.suggestedLocation);
        setSkills(profile.skills);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setProfileError(error instanceof Error ? error.message : "No se pudieron preparar las sugerencias.");
      })
      .finally(() => { if (!controller.signal.aborted) setProfileLoading(false); });
    return () => controller.abort();
  }, [userId, selectedId, profileReload]);

  useEffect(() => () => searchRequest.current?.abort(), []);

  function updateKeywords(value: string) {
    searchRequest.current?.abort();
    setSearching(false);
    setSearchError(null);
    setResult(null);
    setKeywords(value);
  }

  function updateLocation(value: string) {
    searchRequest.current?.abort();
    setSearching(false);
    setSearchError(null);
    setResult(null);
    setLocation(value);
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reviewedKeywords = keywords.trim();
    const reviewedLocation = location.trim();
    if (!selectedId || reviewedKeywords.length < 2 || reviewedLocation.length < 2) {
      setSearchError("Escribe un puesto o palabras clave y una ubicación antes de buscar.");
      return;
    }
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setSearching(true);
    setSearchError(null);
    setResult(null);
    try {
      const response = await searchJobs(userId, { resumeId: selectedId, keywords: reviewedKeywords, location: reviewedLocation }, controller.signal);
      if (!controller.signal.aborted) setResult(response);
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "No se pudieron consultar empleos.");
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  return (
    <div className="app-canvas min-h-screen" data-testid="jobs-content">
      <AppHeader />
      <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-label-xs uppercase tracking-widest text-primary">Oportunidades</p>
          <h1 className="mt-1 text-headline-2xl">Empleos desde tu CV</h1>
          <p className="mt-2 max-w-2xl text-body-sm text-text-muted">Usa tu experiencia para iniciar una búsqueda de ofertas en Argentina. Revisa los términos antes de consultar.</p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <section aria-label="Preparar búsqueda" className="rounded-xl border border-border bg-surface p-5 shadow-sm lg:col-span-4">
            <h2 className="text-headline-lg">Preparar búsqueda</h2>
            {resumesLoading ? <p role="status" data-testid="jobs-resumes-loading" className="mt-5 flex items-center gap-2 text-body-sm text-text-muted"><SpinnerIcon className="h-4 w-4" />Cargando tus CVs...</p> : resumesError ? <div className="mt-4"><p role="alert" data-testid="jobs-resumes-error" className="text-body-sm text-danger">{resumesError}</p><button type="button" onClick={() => setReload((value) => value + 1)} className="focus-ring mt-3 rounded-lg border border-border px-3 py-2 text-body-sm">Reintentar</button></div> : resumes.length === 0 ? <div className="mt-5"><p data-testid="jobs-no-resumes" className="text-body-sm text-text-muted">Aún no tienes un CV guardado para iniciar la búsqueda.</p><Link href="/generate" className="focus-ring mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary">Crear mi CV</Link></div> : <>
              <label htmlFor="jobs-resume" className="mt-5 block text-body-sm font-semibold">CV de referencia</label>
              <select id="jobs-resume" data-testid="jobs-resume-select" value={selectedId} onChange={(event) => { searchRequest.current?.abort(); setResult(null); setSearchError(null); setSearching(false); setProfileLoading(true); setSelectedId(event.target.value); }} className="focus-ring mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-body-sm">
                {resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.fullName || "CV sin nombre"} · {new Date(resume.createdAt).toLocaleDateString("es-AR")}</option>)}
              </select>
              {profileLoading ? <p role="status" data-testid="jobs-profile-loading" className="mt-4 text-body-sm text-text-muted">Preparando sugerencias...</p> : profileError ? <div className="mt-4"><p role="alert" data-testid="jobs-profile-error" className="text-body-sm text-danger">{profileError}</p><button type="button" data-testid="jobs-profile-retry" onClick={() => { setProfileLoading(true); setProfileReload((value) => value + 1); }} className="focus-ring mt-3 rounded-lg border border-border px-3 py-2 text-body-sm">Reintentar</button></div> : <form className="mt-5 space-y-4" onSubmit={(event) => void submitSearch(event)}>
                <div>
                  <label htmlFor="jobs-keywords" className="block text-body-sm font-semibold">Puesto o palabras clave</label>
                  <input id="jobs-keywords" data-testid="jobs-keywords" type="text" value={keywords} onChange={(event) => updateKeywords(event.target.value)} maxLength={120} placeholder="Ej.: Desarrollador backend" className="focus-ring mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-body-sm" />
                </div>
                {skills.length > 0 && <p className="text-caption-xs text-text-muted">Habilidades de este CV: {skills.join(", ")}</p>}
                <div>
                  <label htmlFor="jobs-location" className="block text-body-sm font-semibold">Ubicación en Argentina</label>
                  <input id="jobs-location" data-testid="jobs-location" type="text" value={location} onChange={(event) => updateLocation(event.target.value)} maxLength={100} placeholder="Ej.: Buenos Aires" className="focus-ring mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-body-sm" />
                </div>
                <button type="submit" data-testid="jobs-submit" disabled={searching} className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-body-sm font-semibold text-on-primary disabled:opacity-60">{searching && <SpinnerIcon className="h-4 w-4" />}{searching ? "Buscando..." : "Buscar empleos"}</button>
              </form>}
            </>}
          </section>
          <section aria-label="Ofertas laborales" className="lg:col-span-8">
            {searching ? <p role="status" data-testid="jobs-searching" className="rounded-xl border border-border bg-surface p-6 text-body-sm text-text-muted">Consultando ofertas en Argentina...</p> : searchError ? <p role="alert" data-testid="jobs-error" className="rounded-xl border border-danger bg-danger-surface p-6 text-body-sm text-danger">{searchError}</p> : result?.items.length === 0 ? <p data-testid="jobs-empty" className="rounded-xl border border-border bg-surface p-6 text-body-sm text-text-muted">No encontramos ofertas con estos términos. Prueba con un puesto más general u otra ubicación.</p> : result ? <div data-testid="jobs-results"><p className="mb-3 text-body-sm font-semibold text-text-muted">{result.items.length} ofertas encontradas · Fuente: Jooble</p><ul className="space-y-3">{result.items.map((job) => <JobCard key={job.id} job={job} />)}</ul></div> : <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-8 text-center"><p className="text-body-sm font-semibold">Tus ofertas aparecerán aquí</p><p className="mt-2 max-w-sm text-caption-xs text-text-muted">Elige un CV, ajusta la búsqueda y pulsa “Buscar empleos”.</p></div>}
          </section>
        </div>
      </main>
    </div>
  );
}

function JobCard({ job }: { job: JobListing }) {
  return (
    <li data-testid={`job-${job.id}`} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-headline-lg text-text">{job.title}</h2><p className="mt-1 text-body-sm text-text-muted">{job.company || "Empresa no indicada"} · {job.location || "Ubicación no indicada"}</p></div>
        <span className="rounded-full bg-subtle px-3 py-1 text-caption-xs font-semibold text-text-muted">{job.source}</span>
      </div>
      {job.snippet && <p className="mt-3 text-body-sm leading-relaxed text-text-muted">{job.snippet}</p>}
      <a href={job.url} target="_blank" rel="noopener noreferrer" data-testid={`job-link-${job.id}`} className="focus-ring mt-4 inline-block rounded-lg border border-primary px-4 py-2 text-body-sm font-semibold text-primary hover:bg-subtle">Ver oferta</a>
    </li>
  );
}
