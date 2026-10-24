import { BrandLogo } from "./brand-logo";
import { AuthControls } from "./auth-controls";
import { AppNav } from "./app-nav";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader() {
  return (
    <header className="app-header sticky top-0 z-10 border-b border-border">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8 max-[359px]:h-auto max-[359px]:flex-wrap max-[359px]:gap-y-2 max-[359px]:py-2">
        <BrandLogo className="h-12 w-12" />
        <AppNav />
        <div className="flex items-center gap-1.5 sm:gap-3 max-[359px]:ml-auto">
          <ThemeToggle />
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
