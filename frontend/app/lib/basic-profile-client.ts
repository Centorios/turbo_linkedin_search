import type { BasicProfile, BasicProfileResponse } from "../types/profile";
import { createSupabaseBrowserClient } from "./supabase";

type ProfileErrorResponse = {
  detail?: {
    code?: string;
    message?: string;
  };
};

const storageErrorMessages: Record<string, string> = {
  profile_read_failed:
    "No se pudo cargar el perfil desde el almacenamiento. Inténtalo de nuevo; si persiste, comparte el código profile_read_failed.",
  profile_write_failed:
    "No se pudo guardar el perfil. Tus cambios no se guardaron. Inténtalo de nuevo; si persiste, comparte el código profile_write_failed.",
};

export async function getBasicProfile(): Promise<BasicProfileResponse> {
  return requestProfile("GET");
}

export async function saveBasicProfile(profile: BasicProfile): Promise<BasicProfile> {
  return requestProfile("PUT", profile);
}

async function requestProfile(method: "GET" | "PUT", profile?: BasicProfile): Promise<BasicProfileResponse> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("La sesión ha expirado");
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/profile`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(profile ? { "Content-Type": "application/json" } : {}),
      },
      ...(profile ? { body: JSON.stringify(profile) } : {}),
    });
  } catch {
    const operation = method === "PUT" ? "guardar" : "cargar";
    throw new Error(
      `No se pudo conectar con el servidor para ${operation} el perfil. Verifica que el backend esté disponible e inténtalo de nuevo.`,
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    }
    const payload = (await response.json().catch(() => null)) as ProfileErrorResponse | null;
    const codeMessage = payload?.detail?.code ? storageErrorMessages[payload.detail.code] : undefined;
    const operation = method === "PUT" ? "guardar" : "cargar";
    throw new Error(
      codeMessage ??
        payload?.detail?.message ??
        `El servidor no pudo ${operation} el perfil${method === "PUT" ? ". Tus cambios no se guardaron" : ""}.`,
    );
  }

  return (await response.json()) as BasicProfileResponse;
}
