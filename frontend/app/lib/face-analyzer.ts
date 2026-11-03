import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Blendshapes, FrameSample } from "./expression-check";

export type FaceAnalyzer = {
  analyze(video: HTMLVideoElement, timestampMs: number): FrameSample;
  close(): void;
};

export type FaceAnalyzerFactory = () => Promise<FaceAnalyzer>;

// Served from frontend/public/mediapipe; nothing is fetched from a third party.
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/face_landmarker.task";

const EMPTY_SAMPLE: FrameSample = { faceCount: 0, blendshapes: null, pose: null, box: null };

type Landmarks = FaceLandmarkerResult["faceLandmarks"][number];
type FacialMatrix = FaceLandmarkerResult["facialTransformationMatrixes"][number];

function toBlendshapes(result: FaceLandmarkerResult): Blendshapes | null {
  const categories = result.faceBlendshapes[0]?.categories;
  if (!categories) return null;
  return Object.fromEntries(categories.map((category) => [category.categoryName, category.score]));
}

// Euler angles (degrees) from the rotation part of MediaPipe's column-major 4x4 matrix.
function toPose(matrix: FacialMatrix | undefined): FrameSample["pose"] {
  if (!matrix || matrix.data.length < 16) return null;
  const d = matrix.data;
  const norm = (column: number) => Math.hypot(d[column * 4], d[column * 4 + 1], d[column * 4 + 2]) || 1;
  const r = (row: number, column: number) => d[column * 4 + row] / norm(column);
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;
  return {
    pitch: toDegrees(Math.atan2(r(2, 1), r(2, 2))),
    yaw: toDegrees(Math.atan2(-r(2, 0), Math.hypot(r(2, 1), r(2, 2)))),
    roll: toDegrees(Math.atan2(r(1, 0), r(0, 0))),
  };
}

// The saved photo is the centered square of the video, so the box is measured against that square.
function toBox(landmarks: Landmarks | undefined, video: HTMLVideoElement): FrameSample["box"] {
  if (!landmarks?.length) return null;
  const { videoWidth: width, videoHeight: height } = video;
  const side = Math.min(width, height);
  const left = (width - side) / 2;
  const top = (height - side) / 2;
  const xs = landmarks.map((point) => (point.x * width - left) / side);
  const ys = landmarks.map((point) => (point.y * height - top) / side);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  return { cx: (minX + maxX) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, width: maxX - minX };
}

async function createLandmarker(delegate: "GPU" | "CPU"): Promise<FaceLandmarker> {
  // Dynamic import keeps MediaPipe out of the server render and the initial bundle.
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: "VIDEO",
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

export const createFaceAnalyzer: FaceAnalyzerFactory = async () => {
  let landmarker: FaceLandmarker;
  try {
    landmarker = await createLandmarker("GPU");
  } catch {
    landmarker = await createLandmarker("CPU");
  }

  return {
    analyze(video, timestampMs) {
      if (!video.videoWidth || !video.videoHeight) return EMPTY_SAMPLE;
      const result = landmarker.detectForVideo(video, timestampMs);
      const faceCount = result.faceLandmarks.length;
      if (faceCount === 0) return EMPTY_SAMPLE;
      if (faceCount > 1) return { ...EMPTY_SAMPLE, faceCount };
      return {
        faceCount,
        blendshapes: toBlendshapes(result),
        pose: toPose(result.facialTransformationMatrixes[0]),
        box: toBox(result.faceLandmarks[0], video),
      };
    },
    close() {
      landmarker.close();
    },
  };
};
