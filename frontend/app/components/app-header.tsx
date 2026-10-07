import { BrandLogo } from "./brand-logo";
import { AuthControls } from "./auth-controls";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="app-header sticky top-0 z-10 border-b border-border">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandLogo className="h-12 w-12" />
        <nav aria-label="Navegación de cuenta" className="flex items-center gap-1 sm:gap-3">
          <Link href="/generate" className="focus-ring rounded-lg px-2 py-2 text-caption-xs font-semibold text-text-muted hover:bg-subtle sm:text-body-sm">Crear CV</Link>
          <Link href="/history" data-testid="history-navigation" className="focus-ring rounded-lg px-2 py-2 text-caption-xs font-semibold text-primary hover:bg-subtle sm:text-body-sm">Historial</Link>
          <Link href="/jobs" data-testid="jobs-navigation" className="focus-ring rounded-lg px-2 py-2 text-caption-xs font-semibold text-primary hover:bg-subtle sm:text-body-sm">Empleos</Link>
        </nav>
        <AuthControls />
      </div>
    </header>
  );
}
