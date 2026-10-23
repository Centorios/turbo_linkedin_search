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
  proposeResumeEdit: vi.fn(),
  saveResumeVersion: vi.fn(),
}));
const history = vi.hoisted(() => ({ getResume: vi.fn() }));

vi.mock("../app/lib/cv-import-client", () => mocks);
vi.mock("../app/lib/resume-history-client", () => history);
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
  history.getResume.mockResolvedValue({ id: "resume-9", createdAt: "2026-10-17T03:33:00Z", data: cv });
  mocks.proposeResumeEdit.mockResolvedValue(proposal);
  mocks.saveResumeVersion.mockResolvedValue({ ...saved, id: "resume-10", sourceId: null, parentResumeId: "resume-9" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Importación y edición de CV PDF", () => {
  it("elige el archivo con un botón \"Buscar\" y muestra su nombre", () => {
    render(<CvImportEditor />);
    const browse = screen.getByTestId("cv-import-browse");
    expect(browse.textContent).toBe("Buscar");
    expect(browse.className).toContain("bg-primary");
    expect(browse.getAttribute("for")).toBe("cv-import-file");
    expect(screen.getByTestId("cv-import-filename").textContent).toBe("Ningún archivo seleccionado");

    const file = new File(["%PDF-1.4"], "mi-cv.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Seleccioná el CV en PDF"), { target: { files: [file] } });
    expect(screen.getByTestId("cv-import-filename").textContent).toBe("mi-cv.pdf");
  });

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
    expect((await screen.findByTestId("cv-import-status")).textContent).toBe("Nueva versión guardada. Ya aparece en tu Historial. Ver en Historial");
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

describe("Editar una versión del historial", () => {
  function openVersion() {
    render(<CvImportEditor initialResumeId="resume-9" userId="user-a" />);
    return screen.findByTestId("cv-history-edit-banner");
  }

  it("carga la versión, la muestra y oculta lo que es propio de un PDF importado", async () => {
    const banner = await openVersion();

    expect(history.getResume).toHaveBeenCalledWith("user-a", "resume-9", expect.any(AbortSignal));
    expect(banner.textContent).toContain("Editando tu CV del");
    expect(screen.getByTestId("cv-preview").textContent).toBe("Desarrolladora de software");
    expect(screen.queryByTestId("cv-import-file")).toBeNull();
    expect(screen.queryByTestId("cv-import-download")).toBeNull();
    expect(screen.queryByTestId("cv-import-delete")).toBeNull();
    expect(document.getElementById("editar-cv")).toBe(screen.getByTestId("cv-import-editor"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Editá un CV existente" })));
  });

  it("pide los cambios y guarda una versión nueva por los endpoints del historial", async () => {
    await openVersion();

    fireEvent.change(screen.getByTestId("cv-edit-instruction"), { target: { value: "Mejorá el resumen" } });
    fireEvent.click(screen.getByTestId("cv-edit-submit"));
    await screen.findByTestId("cv-import-proposal");
    expect(mocks.proposeResumeEdit).toHaveBeenCalledWith("resume-9", "Mejorá el resumen", [], cv);
    expect(mocks.proposeCvEdit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("cv-import-save"));
    await waitFor(() => expect(mocks.saveResumeVersion).toHaveBeenCalledWith("resume-9", proposal.status === "ready" ? proposal.proposedCv : null));
    expect(mocks.saveCvVersion).not.toHaveBeenCalled();
    expect((await screen.findByTestId("cv-import-status")).textContent).toContain("Ya aparece en tu Historial");
    expect(screen.getByTestId("cv-import-history-link").getAttribute("href")).toBe("/history");

    // The saved version becomes the base for the next change.
    fireEvent.change(screen.getByTestId("cv-edit-instruction"), { target: { value: "Agregá Python" } });
    fireEvent.click(screen.getByTestId("cv-edit-submit"));
    await waitFor(() => expect(mocks.proposeResumeEdit).toHaveBeenLastCalledWith("resume-10", "Agregá Python", [], expect.anything()));
  });

  it("si la versión no existe avisa y deja importar un PDF", async () => {
    history.getResume.mockRejectedValueOnce(new Error("El CV no está disponible"));
    render(<CvImportEditor initialResumeId="resume-x" userId="user-a" />);

    expect((await screen.findByTestId("cv-import-error")).textContent).toContain("No encontramos esa versión del CV");
    expect(screen.getByTestId("cv-import-file")).toBeTruthy();
    expect(screen.queryByTestId("cv-history-edit-banner")).toBeNull();
  });

  it("\"Importar otro PDF\" vuelve al formulario de importación", async () => {
    await openVersion();
    fireEvent.click(screen.getByTestId("cv-history-edit-close"));

    expect(screen.queryByTestId("cv-history-edit-banner")).toBeNull();
    expect(screen.getByTestId("cv-import-file")).toBeTruthy();
    expect(screen.queryByTestId("cv-preview")).toBeNull();
  });

  it("espera la sesión antes de pedir la versión", () => {
    render(<CvImportEditor initialResumeId="resume-9" userId={null} />);
    expect(history.getResume).not.toHaveBeenCalled();
  });
});
