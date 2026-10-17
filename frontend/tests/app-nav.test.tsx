import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppNav } from "../app/components/app-nav";

const mocks = vi.hoisted(() => ({ pathname: "/generate" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

afterEach(cleanup);
beforeEach(() => {
  mocks.pathname = "/generate";
});

const LINK_IDS = ["generate-navigation", "history-navigation", "jobs-navigation"];

async function flushFrame() {
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
}

describe("Menú de navegación", () => {
  it("muestra las tres secciones con el mismo color", () => {
    render(<AppNav />);
    const classes = LINK_IDS.map((id) => screen.getByTestId(id).className);
    expect(new Set(classes).size).toBe(1);
    for (const id of LINK_IDS) {
      expect(screen.getByTestId(id).className).toContain("text-primary");
      expect(screen.getByTestId(id).className).not.toContain("text-text-muted");
    }
    expect(screen.getByRole("link", { name: "Crear CV" }).getAttribute("href")).toBe("/generate");
  });

  it.each([
    ["/generate", "generate-navigation"],
    ["/history", "history-navigation"],
    ["/jobs", "jobs-navigation"],
  ])("en %s marca su sección como actual y apunta el subrayado ahí", async (pathname, activeId) => {
    mocks.pathname = pathname;
    render(<AppNav />);
    await flushFrame();
    for (const id of LINK_IDS) {
      expect(screen.getByTestId(id).getAttribute("aria-current")).toBe(id === activeId ? "page" : null);
    }
    expect(screen.getByTestId("nav-indicator").dataset.target).toBe(activeId);
  });

  it("el subrayado sigue al mouse y vuelve a la sección actual al salir", async () => {
    mocks.pathname = "/history";
    render(<AppNav />);
    const indicator = screen.getByTestId("nav-indicator");

    fireEvent.mouseEnter(screen.getByTestId("jobs-navigation"));
    expect(indicator.dataset.target).toBe("jobs-navigation");
    fireEvent.mouseLeave(screen.getByRole("navigation"));
    expect(indicator.dataset.target).toBe("history-navigation");
  });

  it("también sigue el foco del teclado", () => {
    mocks.pathname = "/generate";
    render(<AppNav />);
    fireEvent.focus(screen.getByTestId("history-navigation"));
    expect(screen.getByTestId("nav-indicator").dataset.target).toBe("history-navigation");
    fireEvent.blur(screen.getByTestId("history-navigation"));
    expect(screen.getByTestId("nav-indicator").dataset.target).toBe("generate-navigation");
  });

  it("es una animación de deslizamiento que respeta reducir movimiento", () => {
    render(<AppNav />);
    const indicator = screen.getByTestId("nav-indicator");
    expect(indicator.className).toContain("transition-[left,width,opacity]");
    expect(indicator.className).toContain("motion-reduce:transition-none");
    expect(indicator.getAttribute("aria-hidden")).toBe("true");
  });

  it("sin una sección actual el subrayado queda oculto", () => {
    mocks.pathname = "/otra";
    render(<AppNav />);
    expect(screen.getByTestId("nav-indicator").dataset.target).toBe("");
    expect(screen.getByTestId("nav-indicator").className).toContain("opacity-0");
  });
});
