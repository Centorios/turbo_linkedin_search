"use client";

import { createSupabaseBrowserClient } from "../lib/supabase";

export type AuthActionResult = {
  error: string | null;
};

export async function signInWithGoogle(): Promise<AuthActionResult> {
  const message = "No se pudo iniciar sesión con Google. Intentá de nuevo o usá tu correo y contraseña.";

  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    return { error: error || !data.url ? message : null };
  } catch {
    return { error: message };
  }
}

// Supabase Auth reports errors in English. They are never shown as they come:
// each known `code` has its own message and anything else gets the fallback.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "El correo o la contraseña no son correctos.",
  user_already_exists: "Ya existe una cuenta con ese correo. Iniciá sesión.",
  email_exists: "Ya existe una cuenta con ese correo. Iniciá sesión.",
  email_not_confirmed: "Confirmá tu correo antes de iniciar sesión. Revisá tu bandeja de entrada.",
  weak_password: "La contraseña es muy débil: usá al menos 6 caracteres.",
  email_address_invalid: "Ingresá un correo válido.",
  validation_failed: "Ingresá un correo válido.",
  over_request_rate_limit: "Hiciste demasiados intentos. Esperá unos minutos y volvé a probar.",
  over_email_send_rate_limit: "Hiciste demasiados intentos. Esperá unos minutos y volvé a probar.",
  signup_disabled: "El registro de cuentas está deshabilitado por el momento.",
};
const CONNECTION_ERROR = "No se pudo conectar con el servidor. Intentá de nuevo.";

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;
  const { code, status, name } = error as { code?: unknown; status?: unknown; name?: unknown };

  if (typeof code === "string" && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  if (status === 429) return AUTH_ERROR_MESSAGES.over_request_rate_limit;
  if (name === "AuthRetryableFetchError") return CONNECTION_ERROR;
  return fallback;
}

export async function signUp(email: string, password: string): Promise<AuthActionResult> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({ email, password });

    return {
      error: error ? getAuthErrorMessage(error, "No se pudo crear la cuenta") : null,
    };
  } catch (error) {
    return { error: getAuthErrorMessage(error, "No se pudo crear la cuenta") };
  }
}

export async function signIn(email: string, password: string): Promise<AuthActionResult> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    return {
      error: error ? getAuthErrorMessage(error, "Las credenciales no son válidas") : null,
    };
  } catch (error) {
    return { error: getAuthErrorMessage(error, "Las credenciales no son válidas") };
  }
}

export async function signOut(): Promise<AuthActionResult> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();

    return {
      error: error ? getAuthErrorMessage(error, "No se pudo cerrar la sesión") : null,
    };
  } catch (error) {
    return { error: getAuthErrorMessage(error, "No se pudo cerrar la sesión") };
  }
}