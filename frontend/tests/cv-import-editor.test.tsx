import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CvImportEditor } from "../app/components/cv-import-editor";
import type { CvImportResponse, EditResponse, ResumeVersion } from "../app/types/cv-import";

const mocks = vi.hoisted(() => ({
  importCv: vi.fn(),
  proposeCvEdit: vi.fn(),
  saveCvVersion: vi.fn(),
  downloadCvSource: vi.fn(),
  deleteCvSource: vi.fn(),
}));

vi.mock("../app/lib/cv-import-client", () => mocks);
vi.mock("../app/components/cv-preview", () => ({
  CvPreview: ({ cv }: { cv: { summary: string } }) => <div data-testid="cv-preview">{cv.summary}</div>,
}));
vi.mock("../app/components/pdf-download", () => ({
  PdfDownload: () => <button type="button">Descargar CV nuevo</button>,
}));
vi.mock("../app/components/template-selector", () => ({
  TemplateSelector: () => <div>Plantillas</div>,
}));

const cv = {
  personalInfo: {
    fullName: "Ana García",
    email: "ana@example.com",
    phone: "",
    location: "Buenos Aires",
    linkedin: "",
    website: "",
    photoPath: null,
  },
  summary: "Desarrolladora de software",
  experience: [],
  education: [],
  skills: { hard: ["Python"], soft: [] },
  languages: [],
  certifications: [],
};
const source = {
  id: "source-1",
  originalFilename: "ana.pdf",
  fileSizeBytes: 100,
  pageCount: 1,
  createdAt: "2026-10-14T12:00:00Z",
};
const imported: CvImportResponse = {
  source,
  resume: {
    id: "resume-1",
    sourceId: "source-1",
    parentResumeId: null,
    createdAt: source.createdAt,
    data: cv,
  },
};
const proposal: EditResponse = {
  status: "ready",
  proposedCv: { ...cv, summary: "Desarrolladora de software con experiencia en Python" },
  changedSections: ["summary"],
  changeSummary: "Se proponen cambios en resumen.",
};
const saved: ResumeVersion = {
  id: "resume-2",
  sourceId: "source-1",
  parentResumeId: "resume-1",
  createdAt: "2026-10-14T12:01:00Z",
  data: proposal.proposedCv,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.importCv.mockResolvedValue(imported);
  mocks.proposeCvEdit
    .mockResolvedValueOnce({ status: "needs_input", questions: ["¿Cuándo comenzaste?"] })
    .mockResolvedValueOnce(proposal);
  mocks.saveCvVersion.mockResolvedValue(saved);
  mocks.downloadCvSource.mockResolvedValue(new Blob(["%PDF-source"]));
  mocks.deleteCvSource.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Importación y edición de CV PDF", () => {
  it("muestra el progreso mientras importa el archivo", async () => {
    let resolveImport!: (value: CvImportResponse) => void;
    mocks.importCv.mockImplementationOnce(
      () => new Promise<CvImportResponse>((resolve) => {
        resolveImport = resolve;
      }),
    );
    render(<CvImportEditor />);
    const file = new File(["%PDF-1.4"], "ana.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Seleccioná el CV en PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar CV" }));

    expect(screen.getByTestId("cv-import-status").textContent).toBe("Importando el PDF...");
    resolveImport(imported);
    expect((await screen.findByTestId("cv-import-status")).textContent).toBe("CV importado: ana.pdf");
  });

  it("solicita aclaraciones, permite iterar la propuesta y la guarda solo al confirmar", async () => {
    render(<CvImportEditor />);
    const file = new File(["%PDF-1.4"], "ana.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Seleccioná el CV en PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar CV" }));

    await screen.findByTestId("cv-import-status");
    fireEvent.change(screen.getByLabelText("¿Qué querés cambiar?"), {
      target: { value: "Agrega mi experiencia en Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Proponer cambios" }));
    await screen.findByText("¿Cuándo comenzaste?");
    fireEvent.change(screen.getByLabelText("¿Cuándo comenzaste?"), { target: { value: "En 2022" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar respuestas" }));

    expect((await screen.findByTestId("cv-preview")).textContent).toContain(proposal.proposedCv.summary);
    expect(screen.getByTestId("cv-import-changed-sections").textContent).toContain("resumen");
    expect(mocks.saveCvVersion).not.toHaveBeenCalled();

    mocks.proposeCvEdit.mockResolvedValueOnce(proposal);
    fireEvent.change(screen.getByLabelText("¿Qué querés ajustar de esta propuesta?"), {
      target: { value: "Quita una frase del resumen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Proponer ajuste" }));
    await screen.findByTestId("cv-import-proposal");
    expect(mocks.proposeCvEdit).toHaveBeenNthCalledWith(
      3,
      "source-1",
      "resume-1",
      "Quita una frase del resumen",
      [],
      proposal.proposedCv,
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar nueva versión" }));
    await waitFor(() => expect(mocks.saveCvVersion).toHaveBeenCalledWith(
      "source-1",
      "resume-1",
      proposal.proposedCv,
    ));
    expect((await screen.findByTestId("cv-import-status")).textContent).toBe("Nueva versión guardada.");
  });

  it("mantiene el formulario disponible cuando la importación falla", async () => {
    mocks.importCv.mockRejectedValueOnce(new Error("El PDF no contiene texto extraíble"));
    render(<CvImportEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Importar CV" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Seleccioná el archivo PDF");
    const file = new File(["%PDF-1.4"], "scan.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Seleccioná el CV en PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar CV" }));

    expect((await screen.findByRole("alert")).textContent).toContain("El PDF no contiene texto extraíble");
    expect((screen.getByLabelText("Seleccioná el CV en PDF") as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Importar CV" }));
    expect((await screen.findByTestId("cv-import-status")).textContent).toBe("CV importado: ana.pdf");
  });

  it("descarga el original y permite eliminar su fuente", async () => {
    render(<CvImportEditor />);
    const file = new File(["%PDF-1.4"], "ana.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Seleccioná el CV en PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar CV" }));
    await screen.findByTestId("cv-import-status");

    fireEvent.click(screen.getByRole("button", { name: "Descargar PDF original" }));
    await waitFor(() => expect(mocks.downloadCvSource).toHaveBeenCalledWith("source-1"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar CV importado" }));
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    await waitFor(() => expect(mocks.deleteCvSource).toHaveBeenCalledWith("source-1"));
    expect((await screen.findByTestId("cv-import-status")).textContent).toBe("Fuente eliminada.");
  });
});
