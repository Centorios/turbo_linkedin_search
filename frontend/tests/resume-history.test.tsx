import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HistoryPage from "../app/history/page";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "user-a" } } as { user: { id: string } } | null,
  list: vi.fn(), detail: vi.fn(), remove: vi.fn(), photo: vi.fn(), renderPdf: vi.fn(),
}));
vi.mock("../app/auth/session-provider", () => ({ useSession: () => ({ session: mocks.session, isLoading: false }) }));
vi.mock("../app/lib/resume-history-client", () => ({ listResumes: mocks.list, getResume: mocks.detail, deleteResume: mocks.remove }));
vi.mock("../app/lib/profile-photo-client", () => ({ getProfilePhotoUrl: mocks.photo }));
vi.mock("../app/components/app-header", () => ({ AppHeader: () => <header>CV8</header> }));
vi.mock("../app/lib/cv-pdf", () => ({ renderCvPdf: mocks.renderPdf }));
vi.mock("../app/components/pdf-download", () => ({ PdfDownload: () => <button data-testid="pdf-download">Descargar PDF</button> }));

const cv = {
  personalInfo: { fullName: "Nombre original", email: "ana@example.com", phone: "", location: "", linkedin: "", website: "" },
  summary: "Experiencia original", experience: [], education: [], skills: { hard: ["Python"], soft: [] }, languages: [], certifications: [],
};
const item = { id: "resume-a", createdAt: "2026-09-30T12:00:00Z", fullName: "Nombre original", summary: "Experiencia original" };
const page = { items: [item], offset: 0, limit: 20, hasMore: false };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = { user: { id: "user-a" } };
  mocks.list.mockResolvedValue(page);
  mocks.detail.mockResolvedValue({ id: item.id, createdAt: item.createdAt, data: cv });
  mocks.remove.mockResolvedValue(undefined);
  mocks.renderPdf.mockResolvedValue(new Blob(["%PDF-"], { type: "application/pdf" }));
  URL.createObjectURL = vi.fn(() => "blob:cv-preview");
  URL.revokeObjectURL = vi.fn();
});

function lastPreviewed() {
  const [cv, template] = mocks.renderPdf.mock.calls.at(-1) as [{ personalInfo: { fullName: string }; summary: string }, string];
  return { fullName: cv.personalInfo.fullName, summary: cv.summary, template };
}

describe("Historial de CVs", () => {
  it("lista, abre snapshot y conserva contenido al cambiar plantilla", async () => {
    render(<HistoryPage />);
    fireEvent.click(await screen.findByTestId("history-item-resume-a"));
    await screen.findByTestId("cv-preview-frame");
    expect(lastPreviewed()).toMatchObject({ fullName: "Nombre original", template: "ats" });
    fireEvent.click(screen.getByTestId("template-creative"));
    await waitFor(() => expect(lastPreviewed()).toMatchObject({ summary: "Experiencia original", template: "creative" }));
    expect(screen.getByTestId("pdf-download")).toBeTruthy();
  });

  it("cancelar la confirmación conserva el CV y no envía la solicitud", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<HistoryPage />);
    await screen.findByTestId("history-item-resume-a");

    fireEvent.click(screen.getByTestId("history-delete-resume-a"));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Nombre original"));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(screen.getByTestId("history-item-resume-a")).toBeTruthy();
  });

  it("al confirmar elimina solo ese CV y cierra su vista previa abierta", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.list.mockResolvedValue({ ...page, items: [item, { ...item, id: "resume-b", fullName: "Segundo CV" }] });
    render(<HistoryPage />);
    fireEvent.click(await screen.findByTestId("history-item-resume-a"));
    await screen.findByTestId("cv-preview");

    fireEvent.click(screen.getByTestId("history-delete-resume-a"));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("user-a", "resume-a", expect.any(AbortSignal)));
    await waitFor(() => expect(screen.queryByTestId("cv-preview")).toBeNull());
    expect(screen.queryByTestId("history-item-resume-a")).toBeNull();
    expect(screen.getByTestId("history-item-resume-b")).toBeTruthy();
  });

  it("vuelve a la página anterior al eliminar su único CV", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.list.mockResolvedValueOnce({ ...page, hasMore: true, items: [{ ...item, id: "resume-previous" }] });
    mocks.list.mockResolvedValueOnce({ ...page, offset: 20 });
    mocks.list.mockResolvedValueOnce({ ...page, items: [{ ...item, id: "resume-previous" }] });
    render(<HistoryPage />);
    await screen.findByTestId("history-item-resume-previous");
    fireEvent.click(screen.getByTestId("history-next"));
    await screen.findByTestId("history-item-resume-a");

    fireEvent.click(screen.getByTestId("history-delete-resume-a"));

    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith("user-a", 0, expect.any(AbortSignal)));
    await screen.findByTestId("history-item-resume-previous");
  });

  it("muestra vacío y error con reintento", async () => {
    mocks.list.mockRejectedValueOnce(new Error("No se pudo cargar"));
    mocks.list.mockResolvedValueOnce({ ...page, items: [] });
    render(<HistoryPage />);
    expect((await screen.findByTestId("history-error")).textContent).toContain("No se pudo cargar");
    fireEvent.click(screen.getByTestId("history-retry"));
    await screen.findByTestId("history-empty");
  });

  it("navega entre páginas", async () => {
    mocks.list.mockResolvedValueOnce({ ...page, hasMore: true });
    mocks.list.mockResolvedValueOnce({ ...page, offset: 20 });
    render(<HistoryPage />);
    await screen.findByTestId("history-item-resume-a");
    fireEvent.click(screen.getByTestId("history-next"));
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith("user-a", 20, expect.any(AbortSignal)));
    await waitFor(() => expect((screen.getByTestId("history-previous") as HTMLButtonElement).disabled).toBe(false));
  });

  it("descarta detalle tardío de otra selección", async () => {
    let finishFirst!: (value: unknown) => void;
    mocks.list.mockResolvedValue({ ...page, items: [item, { ...item, id: "resume-b", fullName: "Segundo CV" }] });
    mocks.detail.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
    mocks.detail.mockResolvedValueOnce({ id: "resume-b", createdAt: item.createdAt, data: { ...cv, personalInfo: { ...cv.personalInfo, fullName: "Segundo CV" } } });
    render(<HistoryPage />);
    fireEvent.click(await screen.findByTestId("history-item-resume-a"));
    fireEvent.click(screen.getByTestId("history-item-resume-b"));
    await screen.findByTestId("cv-preview");
    finishFirst({ id: item.id, createdAt: item.createdAt, data: cv });
    await screen.findByTestId("cv-preview-frame");
    await waitFor(() => expect(lastPreviewed().fullName).toBe("Segundo CV"));
    expect(mocks.renderPdf.mock.calls.every(([previewed]) => previewed.personalInfo.fullName === "Segundo CV")).toBe(true);
  });

  it("borra documentos al cambiar de cuenta o cerrar sesión", async () => {
    const view = render(<HistoryPage />);
    fireEvent.click(await screen.findByTestId("history-item-resume-a"));
    await screen.findByTestId("cv-preview");
    mocks.session = { user: { id: "user-b" } };
    mocks.list.mockResolvedValue({ ...page, items: [] });
    view.rerender(<HistoryPage />);
    expect(screen.queryByTestId("cv-preview")).toBeNull();
    await screen.findByTestId("history-empty");
    mocks.session = null;
    view.rerender(<HistoryPage />);
    expect(screen.queryByTestId("history-empty")).toBeNull();
    expect(screen.queryByText("Nombre original")).toBeNull();
  });

  it("descarta una respuesta de eliminación pendiente al cambiar de cuenta", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let finishDelete!: () => void;
    mocks.remove.mockImplementationOnce(() => new Promise<void>((resolve) => { finishDelete = resolve; }));
    const view = render(<HistoryPage />);
    await screen.findByTestId("history-item-resume-a");
    fireEvent.click(screen.getByTestId("history-delete-resume-a"));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalled());
    const deleteSignal = mocks.remove.mock.calls[0][2] as AbortSignal;

    mocks.session = { user: { id: "user-b" } };
    mocks.list.mockResolvedValue({ ...page, items: [{ ...item, id: "resume-b", fullName: "Cuenta B" }] });
    view.rerender(<HistoryPage />);

    expect(deleteSignal.aborted).toBe(true);
    await screen.findByTestId("history-item-resume-b");
    finishDelete();
    expect(screen.queryByTestId("history-delete-error")).toBeNull();
    expect(screen.getByTestId("history-item-resume-b")).toBeTruthy();
  });

  it("conserva el CV si falla y permite reintentar hasta eliminarlo", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.remove.mockRejectedValueOnce(new Error("No se pudo eliminar el CV. Inténtalo de nuevo."));
    render(<HistoryPage />);
    await screen.findByTestId("history-item-resume-a");

    fireEvent.click(screen.getByTestId("history-delete-resume-a"));
    expect(await screen.findByTestId("history-delete-error")).toBeTruthy();
    expect(screen.getByTestId("history-item-resume-a")).toBeTruthy();

    fireEvent.click(screen.getByTestId("history-delete-resume-a"));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(2));
    await screen.findByTestId("history-empty");
    expect(screen.queryByTestId("history-delete-error")).toBeNull();
  });

  it("deshabilita la acción mientras el borrado está pendiente", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let finishDelete!: () => void;
    mocks.remove.mockImplementationOnce(() => new Promise<void>((resolve) => { finishDelete = resolve; }));
    render(<HistoryPage />);
    await screen.findByTestId("history-item-resume-a");
    const button = screen.getByTestId("history-delete-resume-a");

    fireEvent.click(button);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(button);
    expect(mocks.remove).toHaveBeenCalledTimes(1);

    finishDelete();
    await screen.findByTestId("history-empty");
  });

  it("permite abrir texto cuando la foto histórica ya no existe", async () => {
    mocks.detail.mockResolvedValue({ id: item.id, createdAt: item.createdAt, data: { ...cv, personalInfo: { ...cv.personalInfo, photoPath: "user-a/old.webp" } } });
    mocks.photo.mockRejectedValue(new Error("Foto eliminada"));
    render(<HistoryPage />);
    fireEvent.click(await screen.findByTestId("history-item-resume-a"));
    await screen.findByTestId("cv-preview-frame");
    expect(lastPreviewed().fullName).toBe("Nombre original");
  });

  it("descarta la lista de la cuenta previa si llega después del cambio", async () => {
    let finishOld!: (value: unknown) => void;
    mocks.list.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    const view = render(<HistoryPage />);
    mocks.session = { user: { id: "user-b" } };
    mocks.list.mockResolvedValueOnce({ ...page, items: [] });
    view.rerender(<HistoryPage />);
    await screen.findByTestId("history-empty");
    finishOld(page);
    await waitFor(() => expect(screen.queryByTestId("history-item-resume-a")).toBeNull());
  });

  it("un detalle fallido permite volver a intentarlo", async () => {
    mocks.detail.mockRejectedValueOnce(new Error("El CV no está disponible"));
    render(<HistoryPage />);
    fireEvent.click(await screen.findByTestId("history-item-resume-a"));
    await screen.findByTestId("history-detail-error");
    fireEvent.click(screen.getByTestId("history-detail-retry"));
    await screen.findByTestId("cv-preview");
  });
});
