import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CertificateSelector } from "../app/components/certificate-selector";

const api = vi.hoisted(() => ({ listProfileCertificates: vi.fn(), uploadProfileCertificate: vi.fn(), reviewProfileCertificate: vi.fn(), downloadProfileCertificate: vi.fn(), deleteProfileCertificate: vi.fn() }));
vi.mock("../app/lib/profile-certificate-client", () => api);

const certificate = (id: string, status: "ready" | "pending_review" = "ready") => ({
  id, originalFilename: `${id}.pdf`, mimeType: "application/pdf", fileSizeBytes: 10,
  status, certification: { name: `Curso ${id}`, issuer: "Instituto", issueDate: "2025", expirationDate: "", credential: id },
  language: null, createdAt: "2026-10-31T00:00:00Z", duplicate: false,
});

afterEach(() => cleanup());
beforeEach(() => { vi.clearAllMocks(); api.listProfileCertificates.mockResolvedValue([certificate("one"), certificate("two")]); });

describe("Selección de certificados", () => {
  it("muestra un botón de carga y los controles debajo de la lista", async () => {
    render(<CertificateSelector selectedIds={[]} onChange={vi.fn()} />);
    const uploadButton = screen.getByRole("button", { name: "Subir Archivo" });
    const listHeading = screen.getByRole("heading", { name: "Lista de Certificados" });
    const selectAll = screen.getByRole("button", { name: "Seleccionar todos" });
    expect(uploadButton.compareDocumentPosition(listHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(listHeading.compareDocumentPosition(selectAll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const fileInput = screen.getByTestId("certificate-files") as HTMLInputElement;
    const click = vi.spyOn(fileInput, "click");
    fireEvent.click(uploadButton);
    expect(click).toHaveBeenCalledOnce();
  });

  it("permite reintentar la lista después de un error de conexión", async () => {
    api.listProfileCertificates.mockRejectedValueOnce(new Error("No se pudo conectar con el servidor de certificados."));
    render(<CertificateSelector selectedIds={[]} onChange={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("No se pudo conectar");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
    await screen.findByTestId("certificate-checkbox-one");
    expect(api.listProfileCertificates).toHaveBeenCalledTimes(2);
  });

  it("abre el archivo original en una vista previa y libera la URL al cerrar", async () => {
    const createObjectURL = vi.fn(() => "blob:certificado-prueba");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    api.downloadProfileCertificate.mockResolvedValue(new Blob(["%PDF-test"], { type: "application/pdf" }));
    render(<CertificateSelector selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.click(await screen.findByTestId("certificate-view-one"));
    const preview = await screen.findByTestId("certificate-preview");
    expect(preview.querySelector("iframe")?.getAttribute("src")).toBe("blob:certificado-prueba");
    expect(api.downloadProfileCertificate).toHaveBeenCalledWith("one");
    fireEvent.click(screen.getByTestId("certificate-preview-close"));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:certificado-prueba"));
  });

  it("confirma la eliminación, quita el certificado de la lista y de la selección", async () => {
    const onChange = vi.fn();
    api.deleteProfileCertificate.mockResolvedValue(undefined);
    render(<CertificateSelector selectedIds={["one", "two"]} onChange={onChange} />);
    fireEvent.click(await screen.findByTestId("certificate-delete-one"));
    expect(screen.getByTestId("confirm-dialog").textContent).toContain("Los CV ya guardados conservarán sus datos");
    fireEvent.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(api.deleteProfileCertificate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("certificate-delete-one"));
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    await waitFor(() => expect(api.deleteProfileCertificate).toHaveBeenCalledWith("one"));
    await waitFor(() => expect(screen.queryByTestId("certificate-checkbox-one")).toBeNull());
    expect(onChange).toHaveBeenCalledWith(["two"]);
    expect(screen.getByTestId("certificate-view-two")).toBeTruthy();
  });

  it("conserva el certificado si falla la eliminación", async () => {
    api.deleteProfileCertificate.mockRejectedValue(new Error("No se pudo eliminar el certificado."));
    render(<CertificateSelector selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.click(await screen.findByTestId("certificate-delete-one"));
    fireEvent.click(screen.getByTestId("confirm-dialog-confirm"));
    expect((await screen.findByRole("alert")).textContent).toContain("No se pudo eliminar");
    expect(screen.getByTestId("certificate-checkbox-one")).toBeTruthy();
  });

  it("carga la biblioteca desmarcada y permite elegir todos o quitar uno", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<CertificateSelector selectedIds={[]} onChange={onChange} />);
    await screen.findByTestId("certificate-checkbox-one");
    expect((screen.getByTestId("certificate-checkbox-one") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByTestId("certificate-select-all"));
    expect(onChange).toHaveBeenCalledWith(["one", "two"]);
    rerender(<CertificateSelector selectedIds={["one", "two"]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("certificate-checkbox-one"));
    expect(onChange).toHaveBeenLastCalledWith(["two"]);
  });

  it("marca una carga nueva lista y deja la incierta pendiente de revisión", async () => {
    const onChange = vi.fn();
    api.uploadProfileCertificate.mockResolvedValueOnce(certificate("new")).mockResolvedValueOnce(certificate("pending", "pending_review"));
    render(<CertificateSelector selectedIds={[]} onChange={onChange} />);
    await screen.findByTestId("certificate-checkbox-one");
    fireEvent.change(screen.getByTestId("certificate-files"), { target: { files: [new File(["x"], "new.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["new"]));
    fireEvent.change(screen.getByTestId("certificate-files"), { target: { files: [new File(["y"], "pending.pdf", { type: "application/pdf" })] } });
    await screen.findByTestId("certificate-review-pending");
    expect(screen.queryByTestId("certificate-checkbox-pending")).toBeNull();
  });

  it("permite corregir todos los datos dudosos antes de marcar un certificado", async () => {
    const onChange = vi.fn();
    api.listProfileCertificates.mockResolvedValueOnce([certificate("pending", "pending_review")]);
    api.reviewProfileCertificate.mockResolvedValueOnce(certificate("pending"));
    render(<CertificateSelector selectedIds={[]} onChange={onChange} />);
    await screen.findByTestId("certificate-review-form-pending");
    fireEvent.change(screen.getByTestId("certificate-review-issuer-pending"), { target: { value: "Nueva academia" } });
    fireEvent.change(screen.getByTestId("certificate-review-language-pending"), { target: { value: "Inglés" } });
    fireEvent.change(screen.getByTestId("certificate-review-proficiency-pending"), { target: { value: "C1" } });
    fireEvent.click(screen.getByTestId("certificate-review-pending"));
    await waitFor(() => expect(api.reviewProfileCertificate).toHaveBeenCalledWith("pending",
      expect.objectContaining({ issuer: "Nueva academia" }), { name: "Inglés", proficiency: "C1" }));
    expect(onChange).toHaveBeenCalledWith(["pending"]);
  });
});
