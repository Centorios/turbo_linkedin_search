import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBackgroundBlurredCanvas } from "../app/lib/background-blur";
import type { PersonMask } from "../app/lib/background-analyzer";

const canvasMocks = vi.hoisted(() => ({
  createImageData: vi.fn((width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) })),
  drawImage: vi.fn(),
  putImageData: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    createImageData: canvasMocks.createImageData,
    drawImage: canvasMocks.drawImage,
    putImageData: canvasMocks.putImageData,
    filter: "none",
    globalCompositeOperation: "source-over",
  })) as never;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("desenfoque local del fondo", () => {
  it("mantiene la persona en primer plano y aplica desenfoque al fondo", () => {
    const source = document.createElement("canvas");
    source.width = 640;
    source.height = 640;
    const mask: PersonMask = {
      width: 2,
      height: 2,
      confidence: new Float32Array([0, 1, 0.5, 0.6]),
    };

    const result = createBackgroundBlurredCanvas(source, mask);

    expect(result.width).toBe(640);
    expect(result.height).toBe(640);
    expect(canvasMocks.putImageData).toHaveBeenCalledOnce();
    const maskPixels = canvasMocks.putImageData.mock.calls[0][0];
    expect([...maskPixels.data].filter((_value, index) => index % 4 === 3)).toEqual([0, 255, 127, 255]);
    expect(canvasMocks.drawImage).toHaveBeenCalledWith(source, 0, 0);
    expect(canvasMocks.drawImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 0, 0, 640, 640);
  });

  it("rechaza máscaras incompletas o con valores fuera de rango", () => {
    const source = document.createElement("canvas");
    source.width = 640;
    source.height = 640;

    expect(() => createBackgroundBlurredCanvas(source, { width: 2, height: 2, confidence: new Float32Array([1]) }))
      .toThrow("No se pudo separar la persona del fondo.");
    expect(() => createBackgroundBlurredCanvas(source, { width: 1, height: 1, confidence: new Float32Array([2]) }))
      .toThrow("No se pudo separar la persona del fondo.");
  });
});
