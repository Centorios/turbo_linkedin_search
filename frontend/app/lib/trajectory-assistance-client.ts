import { createSupabaseBrowserClient } from "./supabase";
import type { AssistanceResult, AssistanceTurnRequest } from "../types/trajectory-assistance";

type AssistanceErrorResponse = {
  detail?: {
    message?: string;
  };
};

export async function requestTrajectoryAssistance(
  turn: AssistanceTurnRequest,
): Promise<AssistanceResult> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("La sesión ha expirado. Vuelve a iniciar sesión.");
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

  const response = await fetch(`${backendUrl}/api/trajectory-assistance/turn`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(turn),
  });

  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      throw new Error("La sesión ha expirado. Vuelve a iniciar sesión.");
    }
    const payload = (await response.json().catch(() => null)) as AssistanceErrorResponse | null;
    throw new Error(payload?.detail?.message ?? "No se pudo completar la asistencia");
  }

  return (await response.json()) as AssistanceResult;
}
