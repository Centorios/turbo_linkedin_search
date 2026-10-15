import { createSupabaseBrowserClient } from "./supabase";
import { getBackendUrl } from "./backend-url";
import type { StructuredCv } from "../types/cv";
import type { CvImportResponse, EditResponse, ResumeVersion } from "../types/cv-import";

interface ApiError {
  detail?: {
    message?: string;
  };
}

export async function importCv(file: File, requestId = crypto.randomUUID()): Promise<CvImportResponse> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Selecciona un archivo PDF.");
  }
  const response = await request("/api/cv-imports", {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "Idempotency-Key": requestId,
      "X-Original-Filename": encodeURIComponent(file.name),
    },
    body: file,
  });
  return (await response.json()) as CvImportResponse;
}

export async function proposeCvEdit(
  sourceId: string,
  baseResumeId: string,
  instruction: string,
  answers: string[] = [],
  currentCv?: StructuredCv,
): Promise<EditResponse> {
  const response = await request(`/api/cv-imports/${encodeURIComponent(sourceId)}/edits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseResumeId,
      instruction,
      answers,
      ...(currentCv ? { currentCv } : {}),
    }),
  });
  return (await response.json()) as EditResponse;
}

export async function saveCvVersion(
  sourceId: string,
  baseResumeId: string,
  data: StructuredCv,
  requestId = crypto.randomUUID(),
): Promise<ResumeVersion> {
  const response = await request(`/api/cv-imports/${encodeURIComponent(sourceId)}/versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": requestId,
    },
    body: JSON.stringify({ baseResumeId, data }),
  });
  return (await response.json()) as ResumeVersion;
}

export async function downloadCvSource(sourceId: string): Promise<Blob> {
  const response = await request(`/api/cv-imports/${encodeURIComponent(sourceId)}/file`, { method: "GET" });
  return response.blob();
}

export async function deleteCvSource(sourceId: string): Promise<void> {
  await request(`/api/cv-imports/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("La sesión ha expirado. Vuelve a iniciar sesión.");
  }

  let response: Response;
  try {
    response = await fetch(`${getBackendUrl()}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("No se pudo conectar con el servidor. Inténtalo de nuevo.");
  }

  if (response.status === 401) {
    await supabase.auth.signOut();
    throw new Error("La sesión ha expirado. Vuelve a iniciar sesión.");
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(payload?.detail?.message ?? "No se pudo completar la operación con el CV.");
  }
  return response;
}
