import { createSupabaseBrowserClient } from "./supabase";
import type { ResumeDetail, ResumeHistoryPage } from "../types/resume-history";

export function listResumes(userId: string, offset: number, signal: AbortSignal): Promise<ResumeHistoryPage> {
  return requestHistory(userId, `/api/resumes?offset=${offset}&limit=20`, signal);
}

export function getResume(userId: string, id: string, signal: AbortSignal): Promise<ResumeDetail> {
  return requestHistory(userId, `/api/resumes/${encodeURIComponent(id)}`, signal);
}

async function requestHistory<T>(userId: string, path: string, signal: AbortSignal): Promise<T> {
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  signal.throwIfAborted();
  if (!session?.access_token) throw new Error("La sesión ha expirado. Vuelve a iniciar sesión.");
  if (session.user.id !== userId) throw new DOMException("La cuenta cambió", "AbortError");
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";
  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, { headers: { Authorization: `Bearer ${session.access_token}` }, signal, cache: "no-store" });
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("No se pudo conectar con el servidor. Inténtalo de nuevo.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: { message?: string } } | null;
    signal.throwIfAborted();
    if (response.status === 401) {
      // A late response must not sign out a different account.
      const { data: { session: current } } = await supabase.auth.getSession();
      signal.throwIfAborted();
      if (current?.access_token === session.access_token) await supabase.auth.signOut();
      throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    }
    throw new Error(payload?.detail?.message ?? "No se pudo cargar el historial. Inténtalo de nuevo.");
  }
  const payload = await response.json() as T;
  signal.throwIfAborted();
  return payload;
}
