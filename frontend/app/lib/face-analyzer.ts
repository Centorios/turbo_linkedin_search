import type { FaceLandmarker, FaceLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Blendshapes, FrameSample } from "./expression-check";
import type { NormalizedPoint, SkinContours } from "./skin-smoothing";

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
type LandmarkConnection = { start: number; end: number };
type FaceContourSets = {
  FACE_LANDMARKS_FACE_OVAL: LandmarkConnection[];
  FACE_LANDMARKS_LEFT_EYE: LandmarkConnection[];
  FACE_LANDMARKS_RIGHT_EYE: LandmarkConnection[];
  FACE_LANDMARKS_LEFT_EYEBROW: LandmarkConnection[];
  FACE_LANDMARKS_RIGHT_EYEBROW: LandmarkConnection[];
  FACE_LANDMARKS_LIPS: LandmarkConnection[];
};

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

function measureLipOpening(landmarks: Landmarks | undefined, video: HTMLVideoElement): number | null {
  const upper = landmarks?.[13];
  const lower = landmarks?.[14];
  const left = landmarks?.[61];
  const right = landmarks?.[291];
  if (!upper || !lower || !left || !right) return null;

  const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
    Math.hypot((a.x - b.x) * video.videoWidth, (a.y - b.y) * video.videoHeight);
  const mouthWidth = distance(left, right);
  const lipGap = distance(upper, lower);
  return Number.isFinite(mouthWidth) && mouthWidth > 0 && Number.isFinite(lipGap) ? lipGap / mouthWidth : null;
}

async function createLandmarker(delegate: "GPU" | "CPU", runningMode: "VIDEO" | "IMAGE" = "VIDEO"): Promise<FaceLandmarker> {
  // Dynamic import keeps MediaPipe out of the server render and the initial bundle.
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode,
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

function contourRegions(connections: LandmarkConnection[], landmarks: NormalizedLandmark[]): NormalizedPoint[][] {
  const adjacency = new Map<number, Set<number>>();
  for (const { start, end } of connections) {
    if (!adjacency.has(start)) adjacency.set(start, new Set());
    if (!adjacency.has(end)) adjacency.set(end, new Set());
    adjacency.get(start)?.add(end);
    adjacency.get(end)?.add(start);
  }

  const remaining = new Set(adjacency.keys());
  const regions: NormalizedPoint[][] = [];
  while (remaining.size) {
    const seed = remaining.values().next().value as number;
    const component: number[] = [];
    const pending = [seed];
    remaining.delete(seed);
    while (pending.length) {
      const current = pending.pop() as number;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!remaining.delete(neighbor)) continue;
        pending.push(neighbor);
      }
    }

    const degrees = component.map((index) => adjacency.get(index)?.size ?? 0);
    if (degrees.every((degree) => degree === 2)) {
      const ordered = [component[0]];
      let previous = -1;
      let current = component[0];
      while (ordered.length <= component.length) {
        const next = [...(adjacency.get(current) ?? [])].find((index) => index !== previous);
        if (next === undefined || next === ordered[0]) break;
        ordered.push(next);
        previous = current;
        current = next;
      }
      if (ordered.length === component.length) {
        regions.push(ordered.map((index) => landmarks[index]));
        continue;
      }
    }

    const points = component.map((index) => landmarks[index]);
    const padding = 0.012;
    const minX = Math.max(0, Math.min(...points.map((point) => point.x)) - padding);
    const maxX = Math.min(1, Math.max(...points.map((point) => point.x)) + padding);
    const minY = Math.max(0, Math.min(...points.map((point) => point.y)) - padding);
    const maxY = Math.min(1, Math.max(...points.map((point) => point.y)) + padding);
    regions.push([
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ]);
  }
  return regions;
}

function toSkinContours(result: FaceLandmarkerResult, contourSets: FaceContourSets): SkinContours | null {
  const landmarks = result.faceLandmarks[0];
  if (result.faceLandmarks.length !== 1 || !landmarks?.length) return null;
  if (landmarks.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1)) return null;

  const faceOval = contourRegions(contourSets.FACE_LANDMARKS_FACE_OVAL, landmarks)[0];
  const protectedRegions = [
    contourSets.FACE_LANDMARKS_LEFT_EYE,
    contourSets.FACE_LANDMARKS_RIGHT_EYE,
    contourSets.FACE_LANDMARKS_LEFT_EYEBROW,
    contourSets.FACE_LANDMARKS_RIGHT_EYEBROW,
    contourSets.FACE_LANDMARKS_LIPS,
  ].flatMap((connections) => contourRegions(connections, landmarks));

  if (!faceOval || faceOval.length < 3 || protectedRegions.some((region) => region.length < 3)) return null;
  return { faceOval, protectedRegions };
}

export async function analyzePhotoForSkin(image: HTMLCanvasElement): Promise<SkinContours | null> {
  const { FaceLandmarker } = await import("@mediapipe/tasks-vision");
  let landmarker: FaceLandmarker;
  try {
    landmarker = await createLandmarker("GPU", "IMAGE");
  } catch {
    landmarker = await createLandmarker("CPU", "IMAGE");
  }

  try {
    return toSkinContours(landmarker.detect(image), FaceLandmarker);
  } finally {
    landmarker.close();
  }
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
        lipOpening: measureLipOpening(result.faceLandmarks[0], video),
      };
    },
    close() {
      landmarker.close();
    },
  };
};
