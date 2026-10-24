"use client";

import Link from "next/link";
import { BrandLogo } from "./components/brand-logo";

// Shown when a page fails while rendering. Replaces Next.js's English default.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="app-canvas flex min-h-screen items-center justify-center px-4 py-8">
      <div role="alert" data-testid="error-page" className="workspace-card flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <BrandLogo className="mb-4 h-16 w-16" />
        <h1 className="text-headline-2xl tracking-tight text-text">Algo salió mal</h1>
        <p className="mt-2 text-body-sm text-text-muted">
          Tuvimos un problema al mostrar esta página. Intentá de nuevo; si sigue pasando, volvé al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            data-testid="error-page-retry"
            className="focus-ring rounded-lg bg-primary px-5 py-2.5 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
          >
            Intentar de nuevo
          </button>
          <Link
            href="/generate"
            className="focus-ring rounded-lg border border-border bg-surface px-5 py-2.5 text-body-sm font-semibold text-text hover:bg-subtle"
          >
            Ir a Crear CV
          </Link>
        </div>
      </div>
    </main>
  );
}
