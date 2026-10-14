import { createSupabaseBrowserClient } from "./supabase";
import { getBackendUrl } from "./backend-url";
import type { ResumeDetail, ResumeHistoryPage } from "../types/resume-history";

export function listResumes(userId: string, offset: number, signal: AbortSignal): Promise<ResumeHistoryPage> {
  return requestHistory(userId, `/api/resumes?offset=${offset}&limit=20`, signal).then((response) => response.json() as Promise<ResumeHistoryPage>);
}

export function getResume(userId: string, id: string, signal: AbortSignal): Promise<ResumeDetail> {
  return requestHistory(userId, `/api/resumes/${encodeURIComponent(id)}`, signal).then((response) => response.json() as Promise<ResumeDetail>);
}

export async function deleteResume(userId: string, id: string, signal: AbortSignal): Promise<void> {
  await requestHistory(userId, `/api/resumes/${encodeURIComponent(id)}`, signal, "DELETE");
}

async function requestHistory(userId: string, path: string, signal: AbortSignal, method: "GET" | "DELETE" = "GET"): Promise<Response> {
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  signal.throwIfAborted();
  if (!session?.access_token) throw new Error("La sesión ha expirado. Vuelve a iniciar sesión.");
  if (session.user.id !== userId) throw new DOMException("La cuenta cambió", "AbortError");
  const backendUrl = getBackendUrl();
  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, { method, headers: { Authorization: `Bearer ${session.access_token}` }, signal, cache: "no-store" });
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("No se pudo conectar con el servidor. Inténtalo de nuevo.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: { message?: string } } | null;
    signal.throwIfAborted();
    if (response.status === 401) {
      const { data: { session: current } } = await supabase.auth.getSession();
      signal.throwIfAborted();
      if (current?.access_token === session.access_token) await supabase.auth.signOut();
      throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    }
    throw new Error(payload?.detail?.message ?? "No se pudo cargar el historial. Inténtalo de nuevo.");
  }
  signal.throwIfAborted();
  return response;
}
