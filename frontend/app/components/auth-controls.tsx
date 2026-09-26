"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "../auth/actions";
import { AlertIcon } from "./icons";

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
    <div className="flex items-center gap-3">
      {error && (
        <p role="alert" data-testid="auth-sign-out-error" className="flex items-center gap-1.5 text-caption-xs text-danger">
          <AlertIcon className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        data-testid="auth-sign-out"
        className="focus-ring rounded-lg border border-border bg-surface px-3 py-1.5 text-body-sm font-semibold text-text-muted transition-colors hover:bg-subtle hover:text-text"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
