import type { BasicProfile, BasicProfileResponse } from "../types/profile";
import { createSupabaseBrowserClient } from "./supabase";

type ProfileErrorResponse = {
  detail?: {
    message?: string;
  };
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

  const response = await fetch(`${backendUrl}/api/profile`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(profile ? { "Content-Type": "application/json" } : {}),
    },
    ...(profile ? { body: JSON.stringify(profile) } : {}),
  });

  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    }
    const payload = (await response.json().catch(() => null)) as ProfileErrorResponse | null;
    throw new Error(payload?.detail?.message ?? "No se pudo cargar el perfil");
  }

  return (await response.json()) as BasicProfileResponse;
}
