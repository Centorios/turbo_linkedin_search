"use client";

import { createSupabaseBrowserClient } from "../lib/supabase";

export type AuthActionResult = {
  error: string | null;
};

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