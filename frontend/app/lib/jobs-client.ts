import { getBackendUrl } from "./backend-url";
import { createSupabaseBrowserClient } from "./supabase";
import type { JobSearchProfile, JobSearchResponse } from "../types/jobs";

export function getSearchProfile(userId: string, resumeId: string, signal: AbortSignal): Promise<JobSearchProfile> {
  return requestJobs(userId, `/api/jobs/search-profile/${encodeURIComponent(resumeId)}`, { method: "GET", signal });
}

export function searchJobs(
  userId: string,
  request: { resumeId: string; keywords: string; location: string },
  signal: AbortSignal,
): Promise<JobSearchResponse> {
  return requestJobs(userId, "/api/jobs/search", { method: "POST", body: JSON.stringify(request), signal });
}

async function requestJobs<T>(
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
    throw new Error(payload?.detail?.message ?? "No se pudo consultar empleos. Inténtalo de nuevo.");
  }
  const result = await response.json() as T;
  options.signal.throwIfAborted();
  return result;
}
