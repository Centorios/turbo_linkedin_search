import type { PersonMask } from "./background-analyzer";

const BACKGROUND_BLUR_PX = 14;
const MASK_SOFTNESS = 0.18;

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar el desenfoque del fondo.");
  return { canvas, context };
}

function foregroundAlpha(confidence: number): number {
  const edgeStart = 0.5 - MASK_SOFTNESS / 2;
  const edgeProgress = Math.max(0, Math.min(1, (confidence - edgeStart) / MASK_SOFTNESS));
  const smoothEdge = edgeProgress * edgeProgress * (3 - 2 * edgeProgress);
  return Math.round(smoothEdge * 255);
}

export function createBackgroundBlurredCanvas(source: HTMLCanvasElement, mask: PersonMask): HTMLCanvasElement {
  if (
    !source.width ||
    !source.height ||
    !mask.width ||
    !mask.height ||
    mask.confidence.length !== mask.width * mask.height ||
    mask.confidence.some((confidence) => !Number.isFinite(confidence) || confidence < 0 || confidence > 1)
  ) {
    throw new Error("No se pudo separar la persona del fondo.");
  }

  const { width, height } = source;
  const maskLayer = createCanvas(mask.width, mask.height);
  const maskPixels = maskLayer.context.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.confidence.length; index += 1) {
    const pixelIndex = index * 4;
    maskPixels.data[pixelIndex] = 255;
    maskPixels.data[pixelIndex + 1] = 255;
    maskPixels.data[pixelIndex + 2] = 255;
    maskPixels.data[pixelIndex + 3] = foregroundAlpha(mask.confidence[index]);
  }
  maskLayer.context.putImageData(maskPixels, 0, 0);

  const blurredBackground = createCanvas(width, height);
  blurredBackground.context.filter = `blur(${BACKGROUND_BLUR_PX}px)`;
  blurredBackground.context.drawImage(source, 0, 0);

  const foreground = createCanvas(width, height);
  foreground.context.drawImage(source, 0, 0);
  foreground.context.globalCompositeOperation = "destination-in";
  foreground.context.drawImage(maskLayer.canvas, 0, 0, width, height);

  const output = createCanvas(width, height);
  output.context.drawImage(blurredBackground.canvas, 0, 0);
  output.context.drawImage(foreground.canvas, 0, 0);
  return output.canvas;
}
