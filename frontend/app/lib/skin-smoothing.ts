export type NormalizedPoint = { x: number; y: number };

export type SkinContours = {
  faceOval: NormalizedPoint[];
  protectedRegions: NormalizedPoint[][];
};

const SKIN_BLUR_PX = 3;
const SKIN_BLEND = 0.35;

function isValidContour(points: NormalizedPoint[]): boolean {
  return points.length >= 3 && points.every(
    ({ x, y }) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1,
  );
}

function traceContour(context: CanvasRenderingContext2D, points: NormalizedPoint[], width: number, height: number) {
  const [first, ...rest] = points;
  context.moveTo(first.x * width, first.y * height);
  for (const point of rest) context.lineTo(point.x * width, point.y * height);
  context.closePath();
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar el suavizado de la foto.");
  return { canvas, context };
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo generar la foto."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", 0.9);
  });
}

export async function createSkinSmoothedPhoto(
  source: HTMLCanvasElement,
  contours: SkinContours,
): Promise<Blob> {
  if (!source.width || !source.height || !isValidContour(contours.faceOval) || contours.protectedRegions.some((region) => !isValidContour(region))) {
    throw new Error("No se pudieron reconocer los contornos necesarios para suavizar la piel.");
  }

  const { width, height } = source;
  const blurred = createCanvas(width, height);
  blurred.context.filter = `blur(${SKIN_BLUR_PX}px)`;
  blurred.context.drawImage(source, 0, 0);

  const mask = createCanvas(width, height);
  mask.context.beginPath();
  traceContour(mask.context, contours.faceOval, width, height);
  for (const region of contours.protectedRegions) traceContour(mask.context, region, width, height);
  mask.context.clip("evenodd");
  mask.context.fillStyle = "white";
  mask.context.fillRect(0, 0, width, height);

  const skinLayer = createCanvas(width, height);
  skinLayer.context.drawImage(blurred.canvas, 0, 0);
  skinLayer.context.globalCompositeOperation = "destination-in";
  skinLayer.context.drawImage(mask.canvas, 0, 0);

  const output = createCanvas(width, height);
  output.context.drawImage(source, 0, 0);
  output.context.globalAlpha = SKIN_BLEND;
  output.context.drawImage(skinLayer.canvas, 0, 0);

  return canvasToJpeg(output.canvas);
}
