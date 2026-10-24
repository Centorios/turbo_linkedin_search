export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "cv8-theme";
const THEME_TRANSITION_MS = 300;

// Runs in <head> before the first paint, so a page opened in dark mode never
// flashes white. Keep it free of dependencies: it is inlined as a string.
// A saved choice wins; without one, the system preference decides.
export const THEME_INIT_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}if(t!=="light"&&t!=="dark"){try{t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){t="light"}}document.documentElement.dataset.theme=t})();`;

export function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice just lasts for this visit.
  }
}

export function getSystemTheme(): Theme {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** The theme currently applied to the page. */
export function getActiveTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme, { animate = false }: { animate?: boolean } = {}): void {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (animate && !reduceMotion) {
    // Colors fade only while switching; the class is removed right after.
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), THEME_TRANSITION_MS);
  }
  root.dataset.theme = theme;
}
