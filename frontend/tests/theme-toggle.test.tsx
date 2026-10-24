import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "../app/components/theme-toggle";

type Listener = () => void;
let systemDark = false;
let systemListeners: Listener[] = [];

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.className = "";
  systemDark = false;
  systemListeners = [];
  window.matchMedia = vi.fn((query: string) => ({
    get matches() { return query.includes("prefers-color-scheme: dark") ? systemDark : false; },
    addEventListener: (_: string, listener: Listener) => systemListeners.push(listener),
    removeEventListener: (_: string, listener: Listener) => { systemListeners = systemListeners.filter((item) => item !== listener); },
  })) as never;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const button = () => screen.getByTestId("theme-toggle");
const theme = () => document.documentElement.dataset.theme;

describe("Botón sol/luna", () => {
  it("en modo claro ofrece pasar a oscuro, con el ícono de luna", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);

    expect(button().getAttribute("aria-label")).toBe("Activar modo oscuro");
    expect(button().getAttribute("title")).toBe("Activar modo oscuro");
    expect(button().tagName).toBe("BUTTON");
    expect(button().getAttribute("type")).toBe("button");
    // Both icons are rendered; CSS shows the right one from <html data-theme>.
    expect(button().querySelectorAll("svg")).toHaveLength(2);
    expect(button().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("en modo oscuro ofrece pasar a claro", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);
    expect(button().getAttribute("aria-label")).toBe("Activar modo claro");
  });

  it("alterna el tema, lo guarda y actualiza el aviso", async () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);

    await act(async () => { fireEvent.click(button()); });
    expect(theme()).toBe("dark");
    expect(localStorage.getItem("cv8-theme")).toBe("dark");
    expect(button().getAttribute("aria-label")).toBe("Activar modo claro");

    await act(async () => { fireEvent.click(button()); });
    expect(theme()).toBe("light");
    expect(localStorage.getItem("cv8-theme")).toBe("light");
    expect(button().getAttribute("aria-label")).toBe("Activar modo oscuro");
  });

  it("se puede usar con el teclado", async () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);
    button().focus();
    expect(document.activeElement).toBe(button());
    await act(async () => { fireEvent.click(button()); });
    expect(theme()).toBe("dark");
  });

  it("sin elección guardada sigue los cambios del sistema", async () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);

    systemDark = true;
    await act(async () => { systemListeners.forEach((listener) => listener()); });

    expect(theme()).toBe("dark");
  });

  it("con una elección guardada ignora los cambios del sistema", async () => {
    localStorage.setItem("cv8-theme", "light");
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);

    systemDark = true;
    await act(async () => { systemListeners.forEach((listener) => listener()); });

    expect(theme()).toBe("light");
  });

  it("copia la elección que se hizo en otra pestaña", async () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);

    localStorage.setItem("cv8-theme", "dark");
    await act(async () => { window.dispatchEvent(new StorageEvent("storage", { key: "cv8-theme" })); });

    expect(theme()).toBe("dark");
  });

  it("si el almacenamiento está bloqueado, igual cambia el tema", async () => {
    document.documentElement.dataset.theme = "light";
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("blocked"); };
    try {
      render(<ThemeToggle />);
      await act(async () => { fireEvent.click(button()); });
      expect(theme()).toBe("dark");
    } finally {
      Storage.prototype.setItem = originalSet;
    }
  });

  it("anima el cambio de color un instante", async () => {
    vi.useFakeTimers();
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);

    await act(async () => { fireEvent.click(button()); });
    expect(document.documentElement.classList.contains("theme-transition")).toBe(true);
    await act(async () => { vi.advanceTimersByTime(350); });
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);
  });

  it("desmonta sin dejar escuchas del sistema", () => {
    const view = render(<ThemeToggle />);
    expect(systemListeners).toHaveLength(1);
    view.unmount();
    expect(systemListeners).toHaveLength(0);
  });
});
