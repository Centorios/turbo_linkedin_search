// Pure decision logic for the "neutral expression" photo check. It knows nothing about MediaPipe:
// the analyzer turns each video frame into a FrameSample and this module judges it.

export type Blendshapes = Record<string, number>;

export type FrameSample = {
  faceCount: number;
  blendshapes: Blendshapes | null;
  /** Head orientation in degrees. */
  pose: { yaw: number; pitch: number; roll: number } | null;
  /** Face box relative to the square area that is saved (0–1, center and width). */
  box: { cx: number; cy: number; width: number } | null;
};

export type ExpressionIssue =
  | "no-face"
  | "multiple-faces"
  | "too-far"
  | "too-close"
  | "off-center"
  | "head-turned"
  | "head-tilted"
  | "eyes-closed"
  | "eyes-wide"
  | "mouth-open"
  | "smiling"
  | "brows-raised"
  | "frowning"
  | "not-evaluable";

export type FrameAssessment = { ok: boolean; issue: ExpressionIssue | null };

export type ExpressionVerdict = {
  status: "neutral" | "rejected";
  issue: ExpressionIssue | null;
  message: string | null;
};

export type LiveStatus = "loading" | "unavailable" | "no-face" | "multiple-faces" | "adjust" | "ready";

// Starting values from specs/017-neutral-expression-photo/research.md (R2); calibrate here only.
// Adjusted after the first test with a real camera: resting mouth tripped `jawOpen`/`mouthShape`,
// an angry frown and large head turns were accepted.
export const EXPRESSION_THRESHOLDS = {
  smile: 0.3,
  jawOpen: 0.25,
  mouthShape: 0.45,
  browsRaised: 0.35,
  browsDown: 0.35,
  eyesClosed: 0.5,
  eyesWide: 0.4,
  yaw: 12,
  pitch: 10,
  roll: 8,
  faceMinWidth: 0.25,
  faceMaxWidth: 0.8,
  maxCenterOffset: 0.2,
} as const;

export const WINDOW_SIZE = 5;
export const MIN_PASSING_RATIO = 0.8;
export const MAX_MISSING_FACE_FRAMES = 1;

// Highest priority first: this is the one message shown when several issues apply.
const ISSUE_PRIORITY: ExpressionIssue[] = [
  "no-face",
  "multiple-faces",
  "not-evaluable",
  "too-far",
  "too-close",
  "off-center",
  "head-turned",
  "head-tilted",
  "eyes-closed",
  "eyes-wide",
  "mouth-open",
  "smiling",
  "brows-raised",
  "frowning",
];

const ISSUE_MESSAGES: Record<ExpressionIssue, string> = {
  "no-face": "No te vemos. Ubicá tu rostro frente a la cámara.",
  "multiple-faces": "Tiene que aparecer una sola persona.",
  "too-far": "Acercate un poco a la cámara.",
  "too-close": "Alejate un poco de la cámara.",
  "off-center": "Centrá tu rostro en el círculo.",
  "head-turned": "Mirá de frente y mantené la cabeza derecha.",
  "head-tilted": "Mirá de frente y mantené la cabeza derecha.",
  "eyes-closed": "Abrí bien los ojos.",
  "eyes-wide": "Relajá la mirada, sin abrir tanto los ojos.",
  "mouth-open": "Cerrá la boca.",
  smiling: "Relajá la sonrisa.",
  "brows-raised": "Relajá las cejas.",
  frowning: "Relajá las cejas.",
  "not-evaluable": "No pudimos ver bien tu rostro. Buscá más luz y mostralo completo.",
};

export const READY_MESSAGE = "Listo, expresión neutra.";
export const LOADING_MESSAGE = "Preparando la verificación de expresión...";
export const UNAVAILABLE_MESSAGE = "No pudimos verificar la expresión; podés tomar la foto igual.";
const REJECTION_PREFIX = "La foto no quedó neutra. Sacala de nuevo: ";

export function issueMessage(issue: ExpressionIssue): string {
  return ISSUE_MESSAGES[issue];
}

export function rejectionMessage(issue: ExpressionIssue): string {
  return `${REJECTION_PREFIX}${issueMessage(issue)}`;
}

function value(shapes: Blendshapes, name: string): number {
  return shapes[name] ?? 0;
}

function average(shapes: Blendshapes, left: string, right: string): number {
  return (value(shapes, left) + value(shapes, right)) / 2;
}

function pickIssue(issues: ExpressionIssue[]): ExpressionIssue | null {
  return ISSUE_PRIORITY.find((candidate) => issues.includes(candidate)) ?? null;
}

export type FrameMeasures = {
  smile: number;
  jawOpen: number;
  mouthShape: number;
  browsRaised: number;
  browsDown: number;
  eyesClosed: number;
  eyesWide: number;
  yaw: number;
  pitch: number;
  roll: number;
  faceWidth: number;
  offsetX: number;
  offsetY: number;
};

// Every signal compared against EXPRESSION_THRESHOLDS; also printed by the debug mode.
export function measureFrame(sample: FrameSample): FrameMeasures | null {
  const { blendshapes: shapes, pose, box } = sample;
  if (sample.faceCount !== 1 || !shapes || !pose || !box) return null;
  return {
    smile: average(shapes, "mouthSmileLeft", "mouthSmileRight"),
    jawOpen: value(shapes, "jawOpen"),
    mouthShape: Math.max(value(shapes, "mouthFunnel"), value(shapes, "mouthPucker")),
    browsRaised: Math.max(value(shapes, "browInnerUp"), average(shapes, "browOuterUpLeft", "browOuterUpRight")),
    browsDown: average(shapes, "browDownLeft", "browDownRight"),
    eyesClosed: average(shapes, "eyeBlinkLeft", "eyeBlinkRight"),
    eyesWide: average(shapes, "eyeWideLeft", "eyeWideRight"),
    yaw: pose.yaw,
    pitch: pose.pitch,
    roll: pose.roll,
    faceWidth: box.width,
    offsetX: box.cx - 0.5,
    offsetY: box.cy - 0.5,
  };
}

export function evaluateFrame(sample: FrameSample): FrameAssessment {
  const t = EXPRESSION_THRESHOLDS;
  if (sample.faceCount === 0) return { ok: false, issue: "no-face" };
  if (sample.faceCount > 1) return { ok: false, issue: "multiple-faces" };
  const m = measureFrame(sample);
  if (!m) return { ok: false, issue: "not-evaluable" };

  const issues: ExpressionIssue[] = [];
  if (m.faceWidth < t.faceMinWidth) issues.push("too-far");
  if (m.faceWidth > t.faceMaxWidth) issues.push("too-close");
  if (Math.abs(m.offsetX) > t.maxCenterOffset || Math.abs(m.offsetY) > t.maxCenterOffset) issues.push("off-center");
  if (Math.abs(m.yaw) > t.yaw || Math.abs(m.pitch) > t.pitch) issues.push("head-turned");
  if (Math.abs(m.roll) > t.roll) issues.push("head-tilted");
  if (m.eyesClosed > t.eyesClosed) issues.push("eyes-closed");
  if (m.eyesWide > t.eyesWide) issues.push("eyes-wide");
  if (m.jawOpen > t.jawOpen || m.mouthShape > t.mouthShape) issues.push("mouth-open");
  if (m.smile > t.smile) issues.push("smiling");
  if (m.browsRaised > t.browsRaised) issues.push("brows-raised");
  if (m.browsDown > t.browsDown) issues.push("frowning");

  const issue = pickIssue(issues);
  return { ok: issue === null, issue };
}

// Decides the photo from the last frames: one noisy frame (a blink) must not reject it.
export function summarizeWindow(frames: FrameSample[]): ExpressionVerdict {
  if (frames.length === 0) return rejected("not-evaluable");

  const missing = frames.filter((frame) => frame.faceCount === 0).length;
  if (missing > MAX_MISSING_FACE_FRAMES) return rejected("not-evaluable");

  const assessments = frames.map(evaluateFrame);
  const passing = assessments.filter((assessment) => assessment.ok).length;
  if (passing >= Math.ceil(frames.length * MIN_PASSING_RATIO)) {
    return { status: "neutral", issue: null, message: null };
  }

  // The most frequent issue wins; ties go to the higher-priority one.
  const counts = new Map<ExpressionIssue, number>();
  for (const { issue } of assessments) if (issue) counts.set(issue, (counts.get(issue) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const tied = [...counts].filter(([, count]) => count === top).map(([issue]) => issue);
  return rejected(pickIssue(tied) ?? "not-evaluable");
}

function rejected(issue: ExpressionIssue): ExpressionVerdict {
  return { status: "rejected", issue, message: rejectionMessage(issue) };
}
