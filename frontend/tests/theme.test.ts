import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  getActiveTheme,
  getStoredTheme,
  getSystemTheme,
  saveTheme,
} from "../app/lib/theme";

function mockMedia(matches: { dark?: boolean; reduceMotion?: boolean }) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("prefers-color-scheme: dark") ? Boolean(matches.dark) : Boolean(matches.reduceMotion),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as never;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.className = "";
  mockMedia({});
});

afterEach(() => vi.useRealTimers());

describe("Preferencia de tema", () => {
  it("guarda y lee la elección, y descarta valores raros", () => {
    expect(getStoredTheme()).toBeNull();
    saveTheme("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(getStoredTheme()).toBe("dark");
    localStorage.setItem(THEME_STORAGE_KEY, "azul");
    expect(getStoredTheme()).toBeNull();
  });

  it("si el almacenamiento falla, no se rompe", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error("blocked"); };
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("blocked"); };
    try {
      expect(getStoredTheme()).toBeNull();
      expect(() => saveTheme("dark")).not.toThrow();
    } finally {
      Storage.prototype.getItem = original;
      Storage.prototype.setItem = originalSet;
    }
  });

  it("lee la preferencia del sistema", () => {
    mockMedia({ dark: true });
    expect(getSystemTheme()).toBe("dark");
    mockMedia({ dark: false });
    expect(getSystemTheme()).toBe("light");
  });

  it("aplica el tema en <html> y lo informa", () => {
    expect(getActiveTheme()).toBe("light");
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(getActiveTheme()).toBe("dark");
  });

  it("anima el cambio solo un momento y no con reducir movimiento", () => {
    vi.useFakeTimers();
    applyTheme("dark", { animate: true });
    expect(document.documentElement.classList.contains("theme-transition")).toBe(true);
    vi.advanceTimersByTime(300);
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);

    mockMedia({ reduceMotion: true });
    applyTheme("light", { animate: true });
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("Script que evita el destello al cargar", () => {
  function run(options: { stored?: string | null; systemDark?: boolean; storageThrows?: boolean; mediaThrows?: boolean }) {
    const root = { dataset: {} as Record<string, string> };
    const storage = {
      getItem: () => {
        if (options.storageThrows) throw new Error("blocked");
        return options.stored ?? null;
      },
    };
    const matchMedia = () => {
      if (options.mediaThrows) throw new Error("unsupported");
      return { matches: Boolean(options.systemDark) };
    };
    new Function("localStorage", "matchMedia", "document", THEME_INIT_SCRIPT)(storage, matchMedia, { documentElement: root });
    return root.dataset.theme;
  }

  it("una elección guardada gana sobre el sistema", () => {
    expect(run({ stored: "dark", systemDark: false })).toBe("dark");
    expect(run({ stored: "light", systemDark: true })).toBe("light");
  });

  it("sin elección sigue al sistema", () => {
    expect(run({ systemDark: true })).toBe("dark");
    expect(run({ systemDark: false })).toBe("light");
  });

  it("ignora una elección inválida", () => {
    expect(run({ stored: "azul", systemDark: true })).toBe("dark");
  });

  it("si el almacenamiento falla, igual usa el sistema; si todo falla, claro", () => {
    expect(run({ storageThrows: true, systemDark: true })).toBe("dark");
    expect(run({ storageThrows: true, mediaThrows: true })).toBe("light");
  });
});
