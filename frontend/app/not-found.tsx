import Link from "next/link";
import { BrandLogo } from "./components/brand-logo";

export default function NotFound() {
  return (
    <main className="app-canvas flex min-h-screen items-center justify-center px-4 py-8">
      <div data-testid="not-found" className="workspace-card flex w-full max-w-md flex-col items-center rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <BrandLogo className="mb-4 h-16 w-16" />
        <p className="text-label-xs uppercase tracking-widest text-primary">Error 404</p>
        <h1 className="mt-2 text-headline-2xl tracking-tight text-text">No encontramos esta página</h1>
        <p className="mt-2 text-body-sm text-text-muted">
          Puede que el enlace esté mal escrito o que la página ya no exista.
        </p>
        <Link
          href="/generate"
          data-testid="not-found-home"
          className="focus-ring mt-6 rounded-lg bg-primary px-5 py-2.5 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
        >
          Ir a Crear CV
        </Link>
      </div>
    </main>
  );
}
