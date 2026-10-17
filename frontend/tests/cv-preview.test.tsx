import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CvPreview } from "../app/components/cv-preview";
import type { StructuredCv } from "../app/types/cv";

const mocks = vi.hoisted(() => ({ renderPdf: vi.fn() }));
vi.mock("../app/lib/cv-pdf", () => ({ renderCvPdf: mocks.renderPdf }));

const cv: StructuredCv = {
  personalInfo: { fullName: "Ana García", email: "ana@example.com", phone: "", location: "", linkedin: "", website: "" },
  summary: "", experience: [], education: [], skills: { hard: [], soft: [] }, languages: [], certifications: [],
};

let urlCount = 0;
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  urlCount = 0;
  mocks.renderPdf.mockImplementation(async (_cv: StructuredCv, template: string) => new Blob([template]));
  URL.createObjectURL = vi.fn(() => `blob:preview-${++urlCount}`);
  URL.revokeObjectURL = vi.fn();
});

describe("Vista previa del CV", () => {
  it("muestra el mismo PDF que se descarga, con respaldo para abrirlo aparte", async () => {
    render(<CvPreview cv={cv} template="ats" />);
    expect(screen.getByTestId("cv-preview-loading")).toBeTruthy();
    const frame = await screen.findByTestId("cv-preview-frame");
    expect(mocks.renderPdf).toHaveBeenCalledWith(cv, "ats");
    expect(frame.getAttribute("src")).toMatch(/^blob:preview-1#/);
    expect(screen.queryByTestId("cv-preview-unsupported")).toBeNull();
    expect(screen.getByTestId("cv-preview-open").getAttribute("href")).toBe("blob:preview-1");
  });

  it("ofrece solo el enlace si el navegador no tiene visor de PDF", async () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", { configurable: true, value: false });
    try {
      render(<CvPreview cv={cv} template="ats" />);
      expect((await screen.findByTestId("cv-preview-open")).getAttribute("href")).toBe("blob:preview-1");
      expect(screen.getByTestId("cv-preview-unsupported")).toBeTruthy();
      expect(screen.queryByTestId("cv-preview-frame")).toBeNull();
    } finally {
      delete (navigator as { pdfViewerEnabled?: boolean }).pdfViewerEnabled;
    }
  });

  it("muestra un error si no se puede generar el PDF", async () => {
    mocks.renderPdf.mockRejectedValue(new Error("render failed"));
    render(<CvPreview cv={cv} template="ats" />);
    expect((await screen.findByTestId("cv-preview-error")).textContent).toContain("No se pudo generar");
    expect(screen.queryByTestId("cv-preview-frame")).toBeNull();
  });

  it("libera el PDF anterior al cambiar de plantilla y al desmontar", async () => {
    const view = render(<CvPreview cv={cv} template="ats" />);
    await screen.findByTestId("cv-preview-frame");
    view.rerender(<CvPreview cv={cv} template="creative" />);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    await waitFor(() => expect(screen.getByTestId("cv-preview-frame").getAttribute("src")).toMatch(/^blob:preview-2#/));
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-2");
  });

  it("ignora un PDF que termina después de cambiar de plantilla", async () => {
    let finishAts!: (blob: Blob) => void;
    mocks.renderPdf.mockImplementationOnce(() => new Promise<Blob>((resolve) => { finishAts = resolve; }));
    const view = render(<CvPreview cv={cv} template="ats" />);
    await waitFor(() => expect(mocks.renderPdf).toHaveBeenCalledTimes(1));
    view.rerender(<CvPreview cv={cv} template="creative" />);
    await screen.findByTestId("cv-preview-frame");
    finishAts(new Blob(["ats"]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(mocks.renderPdf).toHaveBeenLastCalledWith(cv, "creative");
  });
});
