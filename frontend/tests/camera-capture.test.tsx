import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAMERA_BACKGROUND_BLURRED_PHOTO_NAME,
  CAMERA_PHOTO_NAME,
  CameraCapture,
  cameraErrorMessage,
  isCameraSupported,
} from "../app/components/camera-capture";
import type { FrameSample } from "../app/lib/expression-check";
import type { FaceAnalyzer } from "../app/lib/face-analyzer";
import type { SkinContours } from "../app/lib/skin-smoothing";

// Por defecto la verificación queda "no disponible"; las pruebas de guía inyectan su propio analizador.
vi.mock("../app/lib/face-analyzer", () => ({
  createFaceAnalyzer: () => Promise.reject(new Error("MediaPipe no se carga en pruebas")),
  analyzePhotoForSkin: async () => ({
    faceOval: [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.5, y: 0.9 }],
    protectedRegions: [[{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.5, y: 0.5 }]],
  }),
}));

vi.mock("../app/lib/background-analyzer", () => ({
  analyzePhotoForBackground: async () => ({
    width: 2,
    height: 2,
    confidence: new Float32Array([1, 1, 1, 1]),
  }),
}));

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
const canvasContext = {
  beginPath: vi.fn(),
  closePath: vi.fn(),
  clip: vi.fn(),
  createImageData: vi.fn((width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) })),
  drawImage,
  fill: vi.fn(),
  fillRect: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  putImageData: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  filter: "none",
  globalAlpha: 1,
  globalCompositeOperation: "source-over",
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: mocks.getUserMedia } });
  URL.createObjectURL = vi.fn(() => `blob:camera-${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => canvasContext) as never;
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["jpeg"], { type: "image/jpeg" }))) as never;
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "mediaDevices");
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
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

  it("\"Tomar foto\" crea una revisión JPEG cuadrada y apaga la cámara", async () => {
    const { stream, tracks } = fakeStream();
    mocks.getUserMedia.mockResolvedValue(stream);
    const onCapture = vi.fn();
    const onClose = vi.fn();
    const view = render(<CameraCapture onCapture={onCapture} onClose={onClose} />);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    setVideoSize(1280, 720);

    fireEvent.click(screen.getByTestId("camera-take-photo"));

    await screen.findByTestId("camera-photo-review");
    const file = screen.getByTestId("camera-photo-original");
    expect(file).toBeTruthy();
    // Centered square crop of the 1280x720 frame, scaled to 640x640.
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 280, 0, 720, 720, 0, 0, 640, 640);
    expect(onCapture).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    await screen.findByTestId("camera-use-beautified");
    fireEvent.click(screen.getByTestId("camera-use-original"));

    const selected = onCapture.mock.calls[0][0] as File;
    expect(selected.name).toBe(CAMERA_BACKGROUND_BLURRED_PHOTO_NAME);
    expect(selected.type).toBe("image/jpeg");
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

const neutralFrame: FrameSample = {
  faceCount: 1,
  blendshapes: {},
  pose: { yaw: 0, pitch: 0, roll: 0 },
  box: { cx: 0.5, cy: 0.5, width: 0.5 },
};

function fakeAnalyzer(initial: FrameSample) {
  const current = { sample: initial };
  const analyzer = { analyze: vi.fn(() => current.sample), close: vi.fn() };
  return { current, analyzer, factory: vi.fn(async () => analyzer as FaceAnalyzer) };
}

async function openWithAnalyzer(initial: FrameSample) {
  const { stream, tracks } = fakeStream();
  mocks.getUserMedia.mockResolvedValue(stream);
  const fake = fakeAnalyzer(initial);
  const onCapture = vi.fn();
  const onClose = vi.fn();
  const createSkinContours = vi.fn(async () => ({
    faceOval: [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.5, y: 0.9 }],
    protectedRegions: [[{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.5, y: 0.5 }]],
  } satisfies SkinContours));
  const view = render(
    <CameraCapture
      onCapture={onCapture}
      onClose={onClose}
      createAnalyzer={fake.factory}
      createSkinContours={createSkinContours}
    />,
  );
  setVideoSize(1280, 720);
  await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
  return { ...fake, onCapture, onClose, tracks, view, createSkinContours };
}

function expectStatus(text: string) {
  return waitFor(() => expect(screen.getByTestId("camera-expression-status").textContent).toContain(text));
}

describe("Guía de expresión en vivo", () => {
  it("bloquea \"Tomar foto\" hasta que carga la verificación", async () => {
    mocks.getUserMedia.mockResolvedValue(fakeStream().stream);
    const fake = fakeAnalyzer(neutralFrame);
    let load!: () => void;
    const factory = vi.fn(() => new Promise<FaceAnalyzer>((resolve) => { load = () => resolve(fake.analyzer as FaceAnalyzer); }));
    render(<CameraCapture onCapture={vi.fn()} onClose={vi.fn()} createAnalyzer={factory} />);
    setVideoSize(1280, 720);

    await expectStatus("Preparando la verificación de expresión...");
    expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => load());
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
  });

  it.each([
    ["sin rostro", { ...neutralFrame, faceCount: 0, blendshapes: null, pose: null, box: null }, "No te vemos. Ubicá tu rostro frente a la cámara."],
    ["varios rostros", { ...neutralFrame, faceCount: 2, blendshapes: null, pose: null, box: null }, "Tiene que aparecer una sola persona."],
    ["sonrisa clara", { ...neutralFrame, blendshapes: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 } }, "Relajá la sonrisa."],
    ["cabeza girada", { ...neutralFrame, pose: { yaw: 30, pitch: 0, roll: 0 } }, "Mirá de frente y mantené la cabeza derecha."],
  ] as [string, FrameSample, string][])("avisa qué corregir: %s", async (_name, frame, message) => {
    await openWithAnalyzer(frame);

    await expectStatus(message);
  });

  it("muestra \"Listo, expresión neutra.\" tras unos fotogramas válidos y vuelve a avisar si cambia", async () => {
    const { current } = await openWithAnalyzer({ ...neutralFrame, blendshapes: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 } });
    await expectStatus("Relajá la sonrisa.");

    current.sample = neutralFrame;
    await expectStatus("Listo, expresión neutra.");
  });

  it("nunca toma la foto sola, ni siquiera cuando todo está listo", async () => {
    const { onCapture, onClose } = await openWithAnalyzer(neutralFrame);
    await expectStatus("Listo, expresión neutra.");

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(onCapture).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false);
  });

  it("el indicador es un estado anunciable y no depende solo del color", async () => {
    await openWithAnalyzer(neutralFrame);
    await expectStatus("Listo, expresión neutra.");

    const status = screen.getByTestId("camera-expression-status");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });
});

const smilingFrame: FrameSample = { ...neutralFrame, blendshapes: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 } };
const noFaceFrame: FrameSample = { faceCount: 0, blendshapes: null, pose: null, box: null };
const take = () => fireEvent.click(screen.getByTestId("camera-take-photo"));

describe("Selección de la foto de cámara", () => {
  it("muestra la original y la embellecida para que el usuario elija", async () => {
    const { onCapture, onClose } = await openWithAnalyzer(neutralFrame);

    take();

    expect(await screen.findByTestId("camera-photo-review")).toBeTruthy();
    expect(await screen.findByRole("img", { name: "Foto embellecida" })).toBeTruthy();
    expect(screen.getByTestId("camera-photo-original").getAttribute("alt")).toBe("Original con fondo desenfocado");
    expect(screen.getByTestId("camera-mobile-preview-image").getAttribute("src")).toContain("blob:camera-");
    fireEvent.click(screen.getByTestId("camera-preview-beautified"));
    expect(screen.getByTestId("camera-mobile-preview-image").getAttribute("alt")).toBe("Vista previa embellecida");
    expect(screen.getByTestId("camera-preview-beautified").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId("camera-preview-original"));
    expect(screen.getByTestId("camera-mobile-preview-image").getAttribute("alt")).toBe("Vista previa original con fondo desenfocado");
    expect(onCapture).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("camera-use-beautified"));

    const selected = onCapture.mock.calls[0][0] as File;
    expect(selected.name).toBe("foto-camara-embellecida.jpg");
    expect(selected.type).toBe("image/jpeg");
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("permite elegir la foto base con el fondo desenfocado", async () => {
    const { onCapture } = await openWithAnalyzer(neutralFrame);

    take();
    await screen.findByTestId("camera-photo-review");
    await screen.findByRole("img", { name: "Foto embellecida" });
    fireEvent.click(screen.getByTestId("camera-use-original"));

    const selected = onCapture.mock.calls[0][0] as File;
    expect(selected.name).toBe(CAMERA_BACKGROUND_BLURRED_PHOTO_NAME);
    expect(selected.type).toBe("image/jpeg");
  });

  it.each([
    ["original", "camera-use-original", CAMERA_PHOTO_NAME],
    ["embellecida", "camera-use-beautified", "foto-camara-embellecida-sin-desenfoque.jpg"],
  ])("selecciona la foto %s sin desenfoque y actualiza ambas vistas", async (_label, button, filename) => {
    const { onCapture } = await openWithAnalyzer(neutralFrame);
    take();
    await screen.findByTestId("camera-use-beautified");
    const toggle = screen.getByRole("switch", { name: "Desenfocar fondo" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    const originalBlurred = screen.getByTestId("camera-photo-original").getAttribute("src");
    const enhancedBlurred = screen.getByRole("img", { name: "Foto embellecida" }).getAttribute("src");
    fireEvent.click(screen.getByTestId("camera-preview-beautified"));

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByTestId("camera-photo-original").getAttribute("src")).not.toBe(originalBlurred);
    const enhancedPlain = screen.getByRole("img", { name: "Foto embellecida" }).getAttribute("src");
    expect(enhancedPlain).not.toBe(enhancedBlurred);
    expect(screen.getByTestId("camera-mobile-preview-image").getAttribute("src")).toBe(enhancedPlain);
    expect(onCapture).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    expect(screen.getByTestId("camera-photo-original").getAttribute("src")).toBe(originalBlurred);
    expect(screen.getByTestId("camera-mobile-preview-image").getAttribute("src")).toBe(enhancedBlurred);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByTestId(button));
    expect((onCapture.mock.calls[0][0] as File).name).toBe(filename);
  });

  it("si falla el suavizado, permite confirmar la original y muestra un aviso", async () => {
    const { stream } = fakeStream();
    mocks.getUserMedia.mockResolvedValue(stream);
    const fake = fakeAnalyzer(neutralFrame);
    const onCapture = vi.fn();
    render(
      <CameraCapture
        onCapture={onCapture}
        onClose={vi.fn()}
        createAnalyzer={fake.factory}
        createSkinContours={vi.fn(async () => { throw new Error("landmarks unavailable"); })}
      />,
    );
    setVideoSize(640, 480);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));

    take();

    expect(await screen.findByTestId("camera-skin-filter-error")).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Foto embellecida" })).toBeNull();
    fireEvent.click(screen.getByTestId("camera-use-original"));
    expect((onCapture.mock.calls[0][0] as File).name).toBe(CAMERA_BACKGROUND_BLURRED_PHOTO_NAME);
  });

  it("si falla la segmentación, avisa y conserva la foto original sin efecto como alternativa", async () => {
    const { stream } = fakeStream();
    mocks.getUserMedia.mockResolvedValue(stream);
    const fake = fakeAnalyzer(neutralFrame);
    const onCapture = vi.fn();
    render(
      <CameraCapture
        onCapture={onCapture}
        onClose={vi.fn()}
        createAnalyzer={fake.factory}
        createPersonMask={vi.fn(async () => { throw new Error("segmentation unavailable"); })}
      />,
    );
    setVideoSize(640, 480);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));

    take();

    expect(await screen.findByTestId("camera-skin-filter-error")).toBeTruthy();
    expect(screen.getByTestId("camera-skin-filter-error").textContent).toContain("No pudimos desenfocar el fondo");
    expect(screen.getByRole("switch", { name: "Desenfocar fondo" }).getAttribute("aria-checked")).toBe("false");
    expect((screen.getByRole("switch", { name: "Desenfocar fondo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("camera-use-beautified")).toBeTruthy();
    fireEvent.click(screen.getByTestId("camera-use-original"));
    expect((onCapture.mock.calls[0][0] as File).name).toBe(CAMERA_PHOTO_NAME);
  });

  it("permite elegir la embellecida sin desenfoque si falla la segmentación", async () => {
    mocks.getUserMedia.mockResolvedValue(fakeStream().stream);
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} onClose={vi.fn()} createPersonMask={vi.fn(async () => { throw new Error("segmentación"); })} />);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    setVideoSize(640, 480);
    take();
    await screen.findByTestId("camera-use-beautified");
    fireEvent.click(screen.getByTestId("camera-use-beautified"));
    expect((onCapture.mock.calls[0][0] as File).name).toBe("foto-camara-embellecida-sin-desenfoque.jpg");
  });

  it("avisa si falla solo el suavizado con desenfoque y permite usarlo sin desenfoque", async () => {
    let encoding = 0;
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
      encoding += 1;
      callback(encoding === 4 ? null : new Blob(["jpeg"], { type: "image/jpeg" }));
    }) as never;
    const { onCapture } = await openWithAnalyzer(neutralFrame);
    take();
    expect((await screen.findByTestId("camera-skin-filter-error")).textContent).toContain("Desactivá el desenfoque");
    expect(screen.queryByTestId("camera-use-beautified")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Desenfocar fondo" }));
    expect(screen.queryByTestId("camera-skin-filter-error")).toBeNull();
    fireEvent.click(screen.getByTestId("camera-use-beautified"));
    expect((onCapture.mock.calls[0][0] as File).name).toBe("foto-camara-embellecida-sin-desenfoque.jpg");
  });
});

describe("Cancelar o repetir la revisión", () => {
  it("al cancelar durante la segmentación no crea URLs tardías", async () => {
    mocks.getUserMedia.mockResolvedValue(fakeStream().stream);
    let finish!: (mask: { width: number; height: number; confidence: Float32Array }) => void;
    const createPersonMask = vi.fn(() => new Promise<{ width: number; height: number; confidence: Float32Array }>((resolve) => { finish = resolve; }));
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} onClose={vi.fn()} createPersonMask={createPersonMask} />);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    setVideoSize(640, 480);
    take();
    await waitFor(() => expect(createPersonMask).toHaveBeenCalledTimes(1));
    const toggle = screen.getByRole("switch", { name: "Desenfocar fondo" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    const url = vi.mocked(URL.createObjectURL).mock.results[0].value;
    fireEvent.click(screen.getByTestId("camera-cancel"));
    await act(async () => finish({ width: 1, height: 1, confidence: new Float32Array([1]) }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(onCapture).not.toHaveBeenCalled();
  });

  it("descarta la revisión anterior y vuelve a abrir la cámara al elegir tomar otra", async () => {
    const first = fakeStream();
    const second = fakeStream();
    mocks.getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    const fake = fakeAnalyzer(neutralFrame);
    const onCapture = vi.fn();
    const createSkinContours = vi.fn(async () => ({
      faceOval: [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.5, y: 0.9 }],
      protectedRegions: [[{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.5, y: 0.5 }]],
    } satisfies SkinContours));
    render(
      <CameraCapture
        onCapture={onCapture}
        onClose={vi.fn()}
        createAnalyzer={fake.factory}
        createSkinContours={createSkinContours}
      />,
    );
    setVideoSize(640, 480);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    take();
    await screen.findByTestId("camera-use-beautified");
    fireEvent.click(screen.getByRole("switch", { name: "Desenfocar fondo" }));
    const generatedUrls = vi.mocked(URL.createObjectURL).mock.results.map((result) => result.value);

    fireEvent.click(screen.getByTestId("camera-retake-photo"));

    await waitFor(() => expect(mocks.getUserMedia).toHaveBeenCalledTimes(2));
    generatedUrls.forEach((url) => expect(URL.revokeObjectURL).toHaveBeenCalledWith(url));
    setVideoSize(640, 480);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId("camera-photo-review")).toBeNull();
    expect(onCapture).not.toHaveBeenCalled();
    first.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    second.tracks.forEach((track) => expect(track.stop).not.toHaveBeenCalled());
    take();
    await screen.findByTestId("camera-use-beautified");
    expect(screen.getByRole("switch", { name: "Desenfocar fondo" }).getAttribute("aria-checked")).toBe("true");
  });

  it("permite tomar otra desde el fallback y libera la vista temporal", async () => {
    const first = fakeStream();
    const second = fakeStream();
    mocks.getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    const fake = fakeAnalyzer(neutralFrame);
    const createSkinContours = vi.fn()
      .mockRejectedValueOnce(new Error("landmarks unavailable"))
      .mockResolvedValueOnce({
        faceOval: [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.5, y: 0.9 }],
        protectedRegions: [[{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.5, y: 0.5 }]],
      } satisfies SkinContours);
    render(
      <CameraCapture
        onCapture={vi.fn()}
        onClose={vi.fn()}
        createAnalyzer={fake.factory}
        createSkinContours={createSkinContours}
      />,
    );
    setVideoSize(640, 480);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    take();
    await screen.findByTestId("camera-skin-filter-error");
    const generatedUrls = vi.mocked(URL.createObjectURL).mock.results.map((result) => result.value);

    fireEvent.click(screen.getByTestId("camera-retake-photo"));

    await waitFor(() => expect(mocks.getUserMedia).toHaveBeenCalledTimes(2));
    generatedUrls.forEach((url) => expect(URL.revokeObjectURL).toHaveBeenCalledWith(url));
    setVideoSize(640, 480);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId("camera-photo-review")).toBeNull();
    expect(first.tracks[0].stop).toHaveBeenCalledTimes(1);
    second.tracks.forEach((track) => expect(track.stop).not.toHaveBeenCalled());
  });

  it("cancelar la comparación descarta ambas versiones sin confirmar una foto", async () => {
    const { stream, tracks } = fakeStream();
    mocks.getUserMedia.mockResolvedValue(stream);
    const fake = fakeAnalyzer(neutralFrame);
    const onCapture = vi.fn();
    const onClose = vi.fn();
    const createSkinContours = vi.fn(async () => ({
      faceOval: [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.5, y: 0.9 }],
      protectedRegions: [[{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.5, y: 0.5 }]],
    } satisfies SkinContours));
    render(
      <CameraCapture
        onCapture={onCapture}
        onClose={onClose}
        createAnalyzer={fake.factory}
        createSkinContours={createSkinContours}
      />,
    );
    setVideoSize(640, 480);
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));
    take();
    await screen.findByTestId("camera-use-beautified");
    const generatedUrls = vi.mocked(URL.createObjectURL).mock.results.map((result) => result.value);

    fireEvent.click(screen.getByTestId("camera-cancel"));

    expect(onCapture).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    generatedUrls.forEach((url) => expect(URL.revokeObjectURL).toHaveBeenCalledWith(url));
  });
});

describe("Verificación al tomar la foto", () => {
  it("una foto neutra se acepta: entrega el JPEG y cierra la cámara", async () => {
    const { onCapture, onClose } = await openWithAnalyzer(neutralFrame);
    await expectStatus("Listo, expresión neutra.");

    take();

    await screen.findByTestId("camera-photo-review");
    await screen.findByTestId("camera-use-beautified");
    fireEvent.click(screen.getByTestId("camera-use-original"));
    const file = onCapture.mock.calls[0][0] as File;
    expect(file.name).toBe(CAMERA_BACKGROUND_BLURRED_PHOTO_NAME);
    expect(file.type).toBe("image/jpeg");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("camera-expression-rejection")).toBeNull();
  });

  it("una sonrisa muy leve se acepta", async () => {
    const { onCapture } = await openWithAnalyzer({ ...neutralFrame, blendshapes: { mouthSmileLeft: 0.05, mouthSmileRight: 0.05 } });
    await expectStatus("Listo, expresión neutra.");

    take();

    await screen.findByTestId("camera-photo-review");
    expect(onCapture).not.toHaveBeenCalled();
    await screen.findByTestId("camera-use-beautified");
    fireEvent.click(screen.getByTestId("camera-use-original"));
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it("una sonrisa clara se rechaza: pide sacarla de nuevo, indica qué mejorar y deja la cámara activa", async () => {
    const { onCapture, onClose, tracks } = await openWithAnalyzer(smilingFrame);

    take();

    expect((await screen.findByTestId("camera-expression-rejection")).textContent).toBe(
      "La foto no quedó neutra. Sacala de nuevo: Relajá la sonrisa.",
    );
    expect(screen.getByTestId("camera-expression-rejection").getAttribute("role")).toBe("alert");
    expect(onCapture).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("profile-photo-camera")).toBeTruthy();
    tracks.forEach((track) => expect(track.stop).not.toHaveBeenCalled());
  });

  it("si no puede evaluar el rostro rechaza y pide más luz y rostro completo", async () => {
    const { analyzer, onCapture } = await openWithAnalyzer(noFaceFrame);
    await waitFor(() => expect(analyzer.analyze.mock.calls.length).toBeGreaterThanOrEqual(3));

    take();

    expect((await screen.findByTestId("camera-expression-rejection")).textContent).toContain("Buscá más luz y mostralo completo.");
    expect(onCapture).not.toHaveBeenCalled();
  });

  it("tras 5 rechazos seguidos nunca ofrece usar la foto rechazada", async () => {
    const { onCapture } = await openWithAnalyzer(smilingFrame);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      take();
      expect(await screen.findByTestId("camera-expression-rejection")).toBeTruthy();
    }

    expect(onCapture).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Tomar foto", "Cancelar"]);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("toques rápidos no generan capturas ni mensajes duplicados", async () => {
    const { onCapture, onClose } = await openWithAnalyzer(neutralFrame);
    await expectStatus("Listo, expresión neutra.");

    const button = screen.getByTestId("camera-take-photo");
    fireEvent.click(button);
    fireEvent.click(button);

    await screen.findByTestId("camera-photo-review");
    expect(onCapture).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("repetir un rechazo muestra un solo mensaje", async () => {
    await openWithAnalyzer(smilingFrame);

    take();
    take();

    expect(await screen.findAllByTestId("camera-expression-rejection")).toHaveLength(1);
  });

  it("el mensaje de rechazo desaparece cuando la expresión vuelve a estar lista", async () => {
    const { current } = await openWithAnalyzer(smilingFrame);
    take();
    expect(await screen.findByTestId("camera-expression-rejection")).toBeTruthy();

    current.sample = neutralFrame;

    await waitFor(() => expect(screen.queryByTestId("camera-expression-rejection")).toBeNull());
    await expectStatus("Listo, expresión neutra.");
  });
});

describe("Verificación no disponible", () => {
  it("avisa que no se verificará y permite tomar la foto igual", async () => {
    mocks.getUserMedia.mockResolvedValue(fakeStream().stream);
    const onCapture = vi.fn();
    const failing = vi.fn(async () => { throw new Error("sin wasm"); });
    render(
      <CameraCapture
        onCapture={onCapture}
        onClose={vi.fn()}
        createAnalyzer={failing}
        createPersonMask={vi.fn(async () => { throw new Error("segmentation unavailable"); })}
      />,
    );
    setVideoSize(1280, 720);

    expect((await screen.findByTestId("camera-expression-unavailable")).textContent).toContain(
      "No pudimos verificar la expresión; podés tomar la foto igual.",
    );
    expect(screen.queryByTestId("camera-expression-status")).toBeNull();
    await waitFor(() => expect((screen.getByTestId("camera-take-photo") as HTMLButtonElement).disabled).toBe(false));

    take();

    await screen.findByTestId("camera-skin-filter-error");
    expect(onCapture).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("camera-use-original"));
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it("al desmontar apaga la cámara y libera el analizador", async () => {
    const { analyzer, tracks, view } = await openWithAnalyzer(neutralFrame);

    view.unmount();

    expect(analyzer.close).toHaveBeenCalledTimes(1);
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalled());
  });
});
