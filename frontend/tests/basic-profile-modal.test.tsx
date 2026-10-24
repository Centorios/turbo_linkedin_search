import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BasicProfileModal } from "../app/components/basic-profile-modal";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  signedUrl: vi.fn(),
  getUserMedia: vi.fn(),
  onSave: vi.fn(),
  onDefer: vi.fn(),
}));

vi.mock("../app/lib/profile-photo-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/profile-photo-client")>()),
  uploadProfilePhoto: mocks.upload,
  deleteProfilePhoto: mocks.remove,
  getProfilePhotoUrl: mocks.signedUrl,
}));

const profile = { fullName: "Ana García", email: "ana@example.com", phone: "", location: "", linkedin: "", website: "", photoPath: null };

function track() {
  return { stop: vi.fn() };
}

function renderModal(overrides: Partial<React.ComponentProps<typeof BasicProfileModal>> = {}) {
  return render(
    <BasicProfileModal
      email="ana@example.com"
      profile={profile}
      isSaving={false}
      isEditing
      saveError={null}
      onSave={mocks.onSave}
      onDefer={mocks.onDefer}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onSave.mockResolvedValue(true);
  mocks.upload.mockResolvedValue("user-a/photo.jpg");
  URL.createObjectURL = vi.fn(() => "blob:foto");
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mocks.getUserMedia } });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["jpeg"], { type: "image/jpeg" }))) as never;
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

async function openCamera() {
  const tracks = [track(), track()];
  mocks.getUserMedia.mockResolvedValue({ getTracks: () => tracks });
  fireEvent.click(await screen.findByTestId("profile-photo-camera-open"));
  await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
  const video = screen.getByTestId("camera-video") as HTMLVideoElement;
  Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
  Object.defineProperty(video, "videoHeight", { configurable: true, value: 480 });
  return tracks;
}

describe("Foto de perfil", () => {
  it("usa el botón \"Buscar\" y sigue aceptando un archivo", () => {
    renderModal();
    expect(screen.getByTestId("profile-photo-browse").textContent).toBe("Buscar");
    expect(screen.getByTestId("profile-photo-browse").className).toContain("bg-primary");
    expect(screen.getByLabelText("Foto de perfil (opcional)")).toBe(screen.getByTestId("profile-photo-input"));
    expect(screen.getByTestId("profile-photo-filename").textContent).toBe("Ningún archivo seleccionado");

    const file = new File(["x"], "yo.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("profile-photo-input"), { target: { files: [file] } });

    expect(screen.getByTestId("profile-photo-filename").textContent).toBe("yo.png");
    expect(screen.getByTestId("profile-photo-preview").getAttribute("src")).toBe("blob:foto");
  });

  it("rechaza formatos no permitidos con un mensaje en español", () => {
    renderModal();
    fireEvent.change(screen.getByTestId("profile-photo-input"), { target: { files: [new File(["x"], "a.svg", { type: "image/svg+xml" })] } });
    expect(screen.getByTestId("profile-photo-error").textContent).toContain("JPEG, PNG o WebP");
  });

  it("oculta \"Usar cámara\" si el navegador no la ofrece", async () => {
    Reflect.deleteProperty(navigator, "mediaDevices");
    renderModal();
    await act(async () => {});
    expect(screen.queryByTestId("profile-photo-camera-open")).toBeNull();
    expect(screen.getByTestId("profile-photo-browse")).toBeTruthy();
  });

  it("toma una foto con la cámara, la muestra y la sube al guardar", async () => {
    renderModal();
    const tracks = await openCamera();

    fireEvent.click(screen.getByTestId("camera-take-photo"));

    expect(screen.queryByTestId("profile-photo-camera")).toBeNull();
    tracks.forEach((item) => expect(item.stop).toHaveBeenCalled());
    expect(screen.getByTestId("profile-photo-filename").textContent).toBe("Foto de la cámara");
    expect(screen.getByTestId("profile-photo-preview")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));
    await waitFor(() => expect(mocks.onSave).toHaveBeenCalled());
    const uploaded = mocks.upload.mock.calls[0][0] as File;
    expect(uploaded.type).toBe("image/jpeg");
    expect(uploaded.name).toBe("foto-camara.jpg");
    expect(mocks.onSave.mock.calls[0][0].photoPath).toBe("user-a/photo.jpg");
  });

  it("una foto de la cámara se puede quitar", async () => {
    renderModal();
    await openCamera();
    fireEvent.click(screen.getByTestId("camera-take-photo"));

    fireEvent.click(screen.getByTestId("profile-photo-remove"));

    expect(screen.queryByTestId("profile-photo-preview")).toBeNull();
    expect(screen.getByTestId("profile-photo-filename").textContent).toBe("Ningún archivo seleccionado");
  });

  it("cancelar la cámara no cambia la foto y Escape no cierra el diálogo", async () => {
    renderModal();
    const tracks = await openCamera();

    fireEvent.keyDown(screen.getByTestId("profile-photo-camera"), { key: "Escape" });

    expect(screen.queryByTestId("profile-photo-camera")).toBeNull();
    expect(mocks.onDefer).not.toHaveBeenCalled();
    tracks.forEach((item) => expect(item.stop).toHaveBeenCalled());
    expect(screen.queryByTestId("profile-photo-preview")).toBeNull();
  });

  it("si no hay permiso muestra el motivo y deja elegir un archivo con Buscar", async () => {
    mocks.getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    renderModal();

    fireEvent.click(await screen.findByTestId("profile-photo-camera-open"));

    expect((await screen.findByTestId("camera-error")).textContent).toContain("No diste permiso para usar la cámara");
    fireEvent.change(screen.getByTestId("profile-photo-input"), { target: { files: [new File(["x"], "yo.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByTestId("profile-photo-filename").textContent).toBe("yo.jpg");
  });

  it("al guardar cierra la cámara abierta y la apaga", async () => {
    renderModal();
    const tracks = await openCamera();

    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));

    await waitFor(() => expect(screen.queryByTestId("profile-photo-camera")).toBeNull());
    tracks.forEach((item) => expect(item.stop).toHaveBeenCalled());
  });
});
