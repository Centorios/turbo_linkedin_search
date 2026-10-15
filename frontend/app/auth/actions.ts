"use client";

import { createSupabaseBrowserClient } from "../lib/supabase";

export type AuthActionResult = {
  error: string | null;
};

export type AuthProvider = "google" | "azure";

export async function signInWithProvider(provider: AuthProvider): Promise<AuthActionResult> {
  const providerName = provider === "google" ? "Google" : "Microsoft";
  const message = `No se pudo iniciar sesión con ${providerName}. Inténtalo de nuevo o usa tu correo y contraseña.`;

  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(provider === "azure" ? { scopes: "email" } : {}),
      },
    });

    return { error: error || !data.url ? message : null };
  } catch {
    return { error: message };
  }
}

function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

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