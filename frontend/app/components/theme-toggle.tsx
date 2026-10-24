"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getActiveTheme,
  getStoredTheme,
  getSystemTheme,
  saveTheme,
  type Theme,
} from "../lib/theme";
import { MoonIcon, SunIcon } from "./icons";

// The active theme lives on <html data-theme>, set before the first paint by the
// script in layout.tsx. This follows that attribute, so the button is always in sync.
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  // The server cannot know the theme: it renders "light" and the client corrects it.
  const theme = useSyncExternalStore<Theme>(subscribe, getActiveTheme, () => "light");

  useEffect(() => {
    // Without a saved choice the page follows the system, also while it is open.
    const media = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
    const onSystemChange = () => {
      if (!getStoredTheme()) applyTheme(getSystemTheme(), { animate: true });
    };
    // Another tab changed the choice.
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) applyTheme(getStoredTheme() ?? getSystemTheme());
    };
    media?.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    saveTheme(next);
    applyTheme(next, { animate: true });
  }

  const label = theme === "dark" ? "Activar modo claro" : "Activar modo oscuro";
  // Both icons are always rendered and swapped with CSS from <html data-theme>:
  // the right one shows on the very first paint and they cross-fade when toggled.
  const swap = "absolute inset-0 h-5 w-5 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      className="focus-ring relative inline-flex h-9 w-9 shrink-0 items-center sm:h-10 sm:w-10 justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:bg-subtle hover:text-text"
    >
      <span aria-hidden="true" className="relative block h-5 w-5">
        <MoonIcon
          className={`${swap} rotate-0 opacity-100 [html[data-theme=dark]_&]:-rotate-90 [html[data-theme=dark]_&]:opacity-0`}
        />
        <SunIcon
          className={`${swap} rotate-90 opacity-0 [html[data-theme=dark]_&]:rotate-0 [html[data-theme=dark]_&]:opacity-100`}
        />
      </span>
    </button>
  );
}
