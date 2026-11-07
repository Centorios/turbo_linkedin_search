import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSkinSmoothedPhoto, type SkinContours } from "../app/lib/skin-smoothing";

const canvasMocks = vi.hoisted(() => ({
  beginPath: vi.fn(),
  closePath: vi.fn(),
  clip: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  toBlob: vi.fn(),
}));

const contours: SkinContours = {
  faceOval: [
    { x: 0.25, y: 0.15 },
    { x: 0.75, y: 0.15 },
    { x: 0.8, y: 0.7 },
    { x: 0.5, y: 0.9 },
    { x: 0.2, y: 0.7 },
  ],
  protectedRegions: [
    [{ x: 0.32, y: 0.4 }, { x: 0.45, y: 0.4 }, { x: 0.4, y: 0.46 }],
    [{ x: 0.55, y: 0.4 }, { x: 0.68, y: 0.4 }, { x: 0.6, y: 0.46 }],
    [{ x: 0.32, y: 0.3 }, { x: 0.45, y: 0.28 }, { x: 0.4, y: 0.32 }],
    [{ x: 0.55, y: 0.28 }, { x: 0.68, y: 0.3 }, { x: 0.6, y: 0.32 }],
    [{ x: 0.4, y: 0.65 }, { x: 0.6, y: 0.65 }, { x: 0.5, y: 0.72 }],
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    beginPath: canvasMocks.beginPath,
    closePath: canvasMocks.closePath,
    clip: canvasMocks.clip,
    drawImage: canvasMocks.drawImage,
    fillRect: canvasMocks.fillRect,
    lineTo: canvasMocks.lineTo,
    moveTo: canvasMocks.moveTo,
    restore: canvasMocks.restore,
    save: canvasMocks.save,
  })) as never;
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
    canvasMocks.toBlob(callback);
  }) as never;
  canvasMocks.toBlob.mockImplementation((callback: BlobCallback) => callback(new Blob(["jpeg"], { type: "image/jpeg" })));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("suavizado local de piel", () => {
  it("aplica el suavizado dentro del óvalo facial y excluye ojos, cejas y boca", async () => {
    const source = document.createElement("canvas");
    source.width = 640;
    source.height = 640;

    await createSkinSmoothedPhoto(source, contours);

    expect(canvasMocks.drawImage).toHaveBeenCalledWith(source, 0, 0);
    expect(canvasMocks.clip).toHaveBeenCalledWith("evenodd");
    expect(canvasMocks.moveTo).toHaveBeenCalledWith(160, 96);
    expect(canvasMocks.moveTo).toHaveBeenCalledWith(204.8, 256);
    expect(canvasMocks.moveTo).toHaveBeenCalledWith(204.8, 192);
    expect(canvasMocks.moveTo).toHaveBeenCalledWith(256, 416);
    expect(canvasMocks.lineTo).toHaveBeenCalledWith(384, 416);
  });

  it("produce un JPEG sin modificar las dimensiones de la imagen original", async () => {
    const source = document.createElement("canvas");
    source.width = 640;
    source.height = 640;

    const result = await createSkinSmoothedPhoto(source, contours);

    expect(result.type).toBe("image/jpeg");
    expect(source.width).toBe(640);
    expect(source.height).toBe(640);
    expect(canvasMocks.toBlob).toHaveBeenCalledOnce();
  });
});
