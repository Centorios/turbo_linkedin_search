import { BrandLogo } from "./brand-logo";
import { AuthControls } from "./auth-controls";
import { AppNav } from "./app-nav";

export function AppHeader() {
  return (
    <header className="app-header sticky top-0 z-10 border-b border-border">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandLogo className="h-12 w-12" />
        <AppNav />
        <AuthControls />
      </div>
    </header>
  );
}
