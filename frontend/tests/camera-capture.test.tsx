import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAMERA_PHOTO_NAME, CameraCapture, cameraErrorMessage, isCameraSupported } from "../app/components/camera-capture";

type FakeTrack = { stop: ReturnType<typeof vi.fn> };
const mocks = vi.hoisted(() => ({ getUserMedia: vi.fn() }));

function fakeStream(): { stream: MediaStream; tracks: FakeTrack[] } {
  const tracks: FakeTrack[] = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks };
}

function domError(name: string): DOMException {
  return new DOMException("camera", name);
}

function setVideoSize(width: number, height: number) {
  const video = screen.getByTestId("camera-video") as HTMLVideoElement;
  Object.defineProperty(video, "videoWidth", { configurable: true, value: width });
  Object.defineProperty(video, "videoHeight", { configurable: true, value: height });
}

const drawImage = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mocks.getUserMedia } });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage })) as never;
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["jpeg"], { type: "image/jpeg" }))) as never;
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("Cámara para la foto de perfil", () => {
  it("pide la cámara frontal sin audio y avisa mientras espera el permiso", async () => {
    let allow!: (stream: MediaStream) => void;
    mocks.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { allow = resolve; }));
    render(<CameraCapture onCapture={vi.fn()} onClose={vi.fn()} />);

    expect(mocks.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
    expect(screen.getByText("Esperando el permiso de la cámara...")).toBeTruthy();
    expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => allow(fakeStream().stream));
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("camera-take-photo")));
  });

  it("\"Tomar foto\" entrega un JPEG cuadrado, apaga la cámara y cierra", async () => {
    const { stream, tracks } = fakeStream();
    mocks.getUserMedia.mockResolvedValue(stream);
    const onCapture = vi.fn();
    const onClose = vi.fn();
    const view = render(<CameraCapture onCapture={onCapture} onClose={onClose} />);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    setVideoSize(1280, 720);

    fireEvent.click(screen.getByTestId("camera-take-photo"));

    const file = onCapture.mock.calls[0][0] as File;
    expect(file.name).toBe(CAMERA_PHOTO_NAME);
    expect(file.type).toBe("image/jpeg");
    // Centered square crop of the 1280x720 frame, scaled to 640x640.
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 280, 0, 720, 720, 0, 0, 640, 640);
    expect(onClose).toHaveBeenCalledTimes(1);

    view.unmount();
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalled());
  });

  it("cancelar y desmontar apagan todas las pistas de la cámara", async () => {
    const { stream, tracks } = fakeStream();
    mocks.getUserMedia.mockResolvedValue(stream);
    const onClose = vi.fn();
    const view = render(<CameraCapture onCapture={vi.fn()} onClose={onClose} />);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByTestId("camera-cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();

    expect(tracks).toHaveLength(2);
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
  });

  it("si se cierra mientras el navegador pide permiso, apaga la cámara apenas llega", async () => {
    let allow!: (stream: MediaStream) => void;
    mocks.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { allow = resolve; }));
    const { stream, tracks } = fakeStream();
    const view = render(<CameraCapture onCapture={vi.fn()} onClose={vi.fn()} />);

    view.unmount();
    await act(async () => allow(stream));

    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
  });

  it("Escape cierra la cámara sin cerrar el diálogo que la contiene", async () => {
    mocks.getUserMedia.mockResolvedValue(fakeStream().stream);
    const onClose = vi.fn();
    const parentKey = vi.fn();
    render(<div onKeyDown={parentKey}><CameraCapture onCapture={vi.fn()} onClose={onClose} /></div>);

    fireEvent.keyDown(screen.getByTestId("profile-photo-camera"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(parentKey).not.toHaveBeenCalled();
  });

  it.each([
    ["NotAllowedError", "No diste permiso para usar la cámara"],
    ["NotFoundError", "No encontramos una cámara en este dispositivo."],
    ["NotReadableError", "La cámara está siendo usada por otra aplicación."],
    ["AbortError", "No se pudo abrir la cámara."],
  ])("muestra un mensaje en español para %s", async (name, message) => {
    mocks.getUserMedia.mockRejectedValue(domError(name));
    render(<CameraCapture onCapture={vi.fn()} onClose={vi.fn()} />);

    expect((await screen.findByTestId("camera-error")).textContent).toContain(message);
    expect(screen.queryByTestId("camera-take-photo")).toBeNull();
    expect(screen.getByTestId("camera-cancel").textContent).toBe("Cerrar");
  });

  it("avisa si la cámara todavía no mostró imagen y no entrega una foto vacía", async () => {
    mocks.getUserMedia.mockResolvedValue(fakeStream().stream);
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} onClose={vi.fn()} />);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByTestId("camera-take-photo"));

    expect((await screen.findByTestId("camera-error")).textContent).toContain("todavía no está lista");
    expect(onCapture).not.toHaveBeenCalled();
  });

  it("detecta si el navegador ofrece cámara", () => {
    expect(isCameraSupported()).toBe(true);
    Reflect.deleteProperty(navigator, "mediaDevices");
    expect(isCameraSupported()).toBe(false);
    expect(cameraErrorMessage(new Error("raro"))).toBe("No se pudo abrir la cámara.");
  });
});
