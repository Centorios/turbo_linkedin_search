import type { ImageSegmenter } from "@mediapipe/tasks-vision";

export type PersonMask = {
  width: number;
  height: number;
  confidence: Float32Array;
};

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/selfie_segmenter.tflite";

async function createImageSegmenter(delegate: "GPU" | "CPU"): Promise<ImageSegmenter> {
  const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: "IMAGE",
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
}

export async function analyzePhotoForBackground(image: HTMLCanvasElement): Promise<PersonMask> {
  let segmenter: ImageSegmenter;
  try {
    segmenter = await createImageSegmenter("GPU");
  } catch {
    segmenter = await createImageSegmenter("CPU");
  }

  try {
    const result = segmenter.segment(image);
    try {
      const labels = segmenter.getLabels().map((label) => label.toLowerCase());
      const masks = result.confidenceMasks;
      if (!masks?.length) throw new Error("No se pudo separar la persona del fondo.");

      let personIndex = labels.findIndex((label) => label.includes("person") || label.includes("selfie"));
      let invertMask = false;
      if (personIndex < 0) {
        personIndex = labels.findIndex((label) => label.includes("background"));
        invertMask = personIndex >= 0;
      }
      if (personIndex < 0 && masks.length === 1) personIndex = 0;
      if (personIndex < 0 || personIndex >= masks.length) {
        throw new Error("El modelo no devolvió una máscara de persona reconocible.");
      }

      const mask = masks[personIndex];
      const confidence = mask.getAsFloat32Array();
      if (!mask.width || !mask.height || confidence.length !== mask.width * mask.height) {
        throw new Error("La máscara de persona no tiene un tamaño válido.");
      }

      return {
        width: mask.width,
        height: mask.height,
        confidence: Float32Array.from(confidence, (value) => invertMask ? 1 - value : value),
      };
    } finally {
      result.close();
    }
  } finally {
    segmenter.close();
  }
}
