import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzePhotoForBackground } from "../app/lib/background-analyzer";

const mocks = vi.hoisted(() => ({
  createFromOptions: vi.fn(),
  forVisionTasks: vi.fn(),
  getLabels: vi.fn(),
  resultClose: vi.fn(),
  segment: vi.fn(),
  segmenterClose: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mocks.forVisionTasks },
  ImageSegmenter: { createFromOptions: mocks.createFromOptions },
}));

const image = document.createElement("canvas");

function setupSegmenter(labels: string[], masks: Array<{ width: number; height: number; values: Float32Array }>) {
  const segmenter = {
    close: mocks.segmenterClose,
    getLabels: mocks.getLabels,
    segment: mocks.segment,
  };
  mocks.getLabels.mockReturnValue(labels);
  mocks.segment.mockReturnValue({
    close: mocks.resultClose,
    confidenceMasks: masks.map(({ width, height, values }) => ({
      width,
      height,
      getAsFloat32Array: () => values,
    })),
  });
  mocks.createFromOptions.mockResolvedValue(segmenter);
  return segmenter;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.forVisionTasks.mockResolvedValue({});
});

describe("segmentación local de persona", () => {
  it("selecciona la máscara de persona y libera los recursos de MediaPipe", async () => {
    setupSegmenter(["background", "selfie"], [
      { width: 2, height: 1, values: new Float32Array([0.9, 0.8]) },
      { width: 2, height: 1, values: new Float32Array([0.1, 0.2]) },
    ]);

    const mask = await analyzePhotoForBackground(image);

    expect(mask).toEqual({ width: 2, height: 1, confidence: new Float32Array([0.1, 0.2]) });
    expect(mocks.createFromOptions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        baseOptions: { modelAssetPath: "/mediapipe/selfie_segmenter.tflite", delegate: "GPU" },
        runningMode: "IMAGE",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }),
    );
    expect(mocks.resultClose).toHaveBeenCalledOnce();
    expect(mocks.segmenterClose).toHaveBeenCalledOnce();
  });

  it("invierte la máscara cuando el modelo solo identifica el fondo", async () => {
    setupSegmenter(["background"], [{ width: 2, height: 1, values: new Float32Array([0.8, 0.25]) }]);

    const mask = await analyzePhotoForBackground(image);

    expect(mask.confidence[0]).toBeCloseTo(0.2);
    expect(mask.confidence[1]).toBeCloseTo(0.75);
  });

  it("reintenta en CPU cuando la inicialización de GPU falla", async () => {
    setupSegmenter(["selfie"], [{ width: 1, height: 1, values: new Float32Array([0.7]) }]);
    mocks.createFromOptions.mockReset().mockRejectedValueOnce(new Error("GPU unavailable")).mockResolvedValueOnce({
      close: mocks.segmenterClose,
      getLabels: mocks.getLabels,
      segment: mocks.segment,
    });

    const mask = await analyzePhotoForBackground(image);

    expect(mask.confidence[0]).toBeCloseTo(0.7);
    expect(mocks.createFromOptions.mock.calls.map(([_, options]) => options.baseOptions.delegate)).toEqual(["GPU", "CPU"]);
  });
});
