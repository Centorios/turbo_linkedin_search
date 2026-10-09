import { getBackendUrl } from "./backend-url";
import { createSupabaseBrowserClient } from "./supabase";
import type { JobSearchProfile, JobSearchResponse, JobSourceName } from "../types/jobs";

export class JobsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "JobsApiError";
  }
}

export function getSearchProfile(userId: string, resumeId: string, signal: AbortSignal): Promise<JobSearchProfile> {
  return requestJobs(userId, `/api/jobs/search-profile/${encodeURIComponent(resumeId)}`, { method: "GET", signal });
}

export function searchJobs(
  userId: string,
  request: { resumeId: string; keywords: string; location: string; sources?: JobSourceName[] },
  signal: AbortSignal,
): Promise<JobSearchResponse> {
  return requestJobs(userId, "/api/jobs/search", { method: "POST", body: JSON.stringify(request), signal });
}

export function getSearchStatus(userId: string, searchId: string, signal: AbortSignal): Promise<JobSearchResponse> {
  return requestJobs(userId, `/api/jobs/search/${encodeURIComponent(searchId)}/status`, { method: "GET", signal });
}

export function retryLinkedIn(userId: string, searchId: string, signal: AbortSignal): Promise<JobSearchResponse> {
  return requestJobs(userId, `/api/jobs/search/${encodeURIComponent(searchId)}/sources/linkedin/retry`, { method: "POST", signal });
}

export async function warmBackend(signal: AbortSignal): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/health`, {
    method: "GET",
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`No se pudo preparar el servidor de empleos (HTTP ${response.status}).`);
  }
}

export async function requestJobs<T>(
  userId: string,
  path: string,
  options: { method: "GET" | "POST"; body?: string; signal: AbortSignal },
): Promise<T> {
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  options.signal.throwIfAborted();
  if (!session?.access_token) throw new Error("La sesión ha expirado. Vuelve a iniciar sesión.");
  if (session.user.id !== userId) throw new DOMException("La cuenta cambió", "AbortError");

  let response: Response;
  try {
    response = await fetch(`${getBackendUrl()}${path}`, {
      method: options.method,
      body: options.body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    options.signal.throwIfAborted();
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("No se pudo conectar con el servidor. Inténtalo de nuevo.");
  }
  options.signal.throwIfAborted();
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: { message?: string } } | null;
    options.signal.throwIfAborted();
    if (response.status === 401) {
      const { data: { session: current } } = await supabase.auth.getSession();
      options.signal.throwIfAborted();
      if (current?.access_token === session.access_token) await supabase.auth.signOut();
      throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    }
    throw new JobsApiError(
      payload?.detail?.message ?? "No se pudo consultar empleos. Inténtalo de nuevo.",
      response.status,
    );
  }
  const result = await response.json() as T;
  options.signal.throwIfAborted();
  return result;
}
