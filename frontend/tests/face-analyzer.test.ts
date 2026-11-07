import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFaceAnalyzer } from "../app/lib/face-analyzer";

const mocks = vi.hoisted(() => ({
  createFromOptions: vi.fn(),
  detectForVideo: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  FaceLandmarker: { createFromOptions: mocks.createFromOptions },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createFromOptions.mockResolvedValue({
    detectForVideo: mocks.detectForVideo,
    close: mocks.close,
  });
});

describe("medición de apertura de labios", () => {
  it("normaliza la separación entre labios por el ancho de la boca en píxeles", async () => {
    const landmarks = Array.from({ length: 292 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    landmarks[13] = { x: 0.5, y: 0.48, z: 0 };
    landmarks[14] = { x: 0.5, y: 0.52, z: 0 };
    landmarks[61] = { x: 0.4, y: 0.5, z: 0 };
    landmarks[291] = { x: 0.6, y: 0.5, z: 0 };
    mocks.detectForVideo.mockReturnValue({
      faceLandmarks: [landmarks],
      faceBlendshapes: [{ categories: [] }],
      facialTransformationMatrixes: [],
    });
    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", { value: 1280 });
    Object.defineProperty(video, "videoHeight", { value: 720 });
    const analyzer = await createFaceAnalyzer();

    expect(analyzer.analyze(video, 100).lipOpening).toBeCloseTo(0.1125);
    analyzer.close();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("informa una medida no disponible si faltan landmarks de la boca", async () => {
    mocks.detectForVideo.mockReturnValue({
      faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      faceBlendshapes: [{ categories: [] }],
      facialTransformationMatrixes: [],
    });
    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", { value: 640 });
    Object.defineProperty(video, "videoHeight", { value: 480 });
    const analyzer = await createFaceAnalyzer();

    expect(analyzer.analyze(video, 100).lipOpening).toBeNull();
    analyzer.close();
  });
});
