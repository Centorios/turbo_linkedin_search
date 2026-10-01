import type { StructuredCv } from "../types/cv";
import { createSupabaseBrowserClient } from "./supabase";
import { getBackendUrl } from "./backend-url";

export async function generateCv(text: string, requestId = crypto.randomUUID()): Promise<StructuredCv> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("La sesión ha expirado");
  }

  const backendUrl = getBackendUrl();

  const response = await fetch(`${backendUrl}/api/generate-cv`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": requestId,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string; detail?: { message?: string } } | null;
    throw new Error(payload?.message ?? payload?.detail?.message ?? "No se pudo generar el CV");
  }

  return (await response.json()) as StructuredCv;
}
