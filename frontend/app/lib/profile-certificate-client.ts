import { createSupabaseBrowserClient } from "./supabase";
import { getBackendUrl } from "./backend-url";
import type { CertificatePage, ProfileCertificate } from "../types/profile-certificate";
import type { Certification, Language } from "../types/cv";

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");
  let response: Response;
  try {
    response = await fetch(`${getBackendUrl()}${path}`, {
      ...init, cache: "no-store",
      headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor de certificados. Comprobá que el backend esté activo y que la dirección del frontend esté permitida en CORS.");
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: { message?: string } } | null;
    throw new Error(payload?.detail?.message ?? "No se pudo completar la operación con el certificado.");
  }
  return response;
}

export async function listProfileCertificates(): Promise<ProfileCertificate[]> {
  const items: ProfileCertificate[] = [];
  let offset = 0;
  while (true) {
    const response = await request(`/api/profile/certificates?offset=${offset}&limit=50`);
    const page = (await response.json()) as CertificatePage;
    items.push(...page.items);
    if (!page.hasMore) return items;
    offset += page.items.length;
  }
}

export async function uploadProfileCertificate(file: File, requestId = crypto.randomUUID()): Promise<ProfileCertificate> {
  if (file.size > 5 * 1024 * 1024) throw new Error("El certificado supera el límite de 5 MiB.");
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("Seleccioná un PDF, JPEG o PNG.");
  }
  const response = await request("/api/profile/certificates", {
    method: "POST", body: file,
    headers: { "Content-Type": file.type, "X-Original-Filename": encodeURIComponent(file.name), "Idempotency-Key": requestId },
  });
  return response.json() as Promise<ProfileCertificate>;
}

export async function reviewProfileCertificate(id: string, certification: Certification, language: Language | null): Promise<ProfileCertificate> {
  const response = await request(`/api/profile/certificates/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ certification, language }),
  });
  return response.json() as Promise<ProfileCertificate>;
}

export async function downloadProfileCertificate(id: string): Promise<Blob> {
  return (await request(`/api/profile/certificates/${encodeURIComponent(id)}/file`)).blob();
}

export async function deleteProfileCertificate(id: string): Promise<void> {
  await request(`/api/profile/certificates/${encodeURIComponent(id)}`, { method: "DELETE" });
}
