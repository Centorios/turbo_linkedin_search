"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "../auth/actions";

export function AuthControls() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    const result = await signOut();
    if (result.error) {
      setError("No se pudo cerrar la sesión. Inténtalo de nuevo.");
      return;
    }

    router.replace("/auth");
    router.refresh();
  }

  return (
    <div>
      <button type="button" onClick={handleSignOut} data-testid="auth-sign-out">
        Cerrar sesión
      </button>
      {error && <p role="alert" data-testid="auth-sign-out-error">{error}</p>}
    </div>
  );
}
