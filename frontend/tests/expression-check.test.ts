import { describe, expect, it } from "vitest";
import {
  EXPRESSION_THRESHOLDS,
  evaluateFrame,
  issueMessage,
  rejectionMessage,
  summarizeWindow,
  type Blendshapes,
  type FrameSample,
} from "../app/lib/expression-check";

function sample(overrides: Partial<FrameSample> & { shapes?: Blendshapes } = {}): FrameSample {
  const { shapes, ...rest } = overrides;
  return {
    faceCount: 1,
    blendshapes: { ...shapes },
    pose: { yaw: 0, pitch: 0, roll: 0 },
    box: { cx: 0.5, cy: 0.5, width: 0.5 },
    ...rest,
  };
}

const smile = (amount: number) => ({ mouthSmileLeft: amount, mouthSmileRight: amount });

describe("evaluateFrame", () => {
  it("acepta un rostro neutro de frente", () => {
    expect(evaluateFrame(sample())).toEqual({ ok: true, issue: null });
  });

  it("acepta una sonrisa muy leve y rechaza una clara (umbral de sonrisa)", () => {
    expect(evaluateFrame(sample({ shapes: smile(0.2) })).ok).toBe(true);
    expect(evaluateFrame(sample({ shapes: smile(EXPRESSION_THRESHOLDS.smile) })).ok).toBe(true);
    expect(evaluateFrame(sample({ shapes: smile(0.31) }))).toEqual({ ok: false, issue: "smiling" });
  });

  it("rechaza boca abierta, boca deformada, cejas y ojos fuera de rango", () => {
    expect(evaluateFrame(sample({ shapes: { jawOpen: 0.26 } })).issue).toBe("mouth-open");
    expect(evaluateFrame(sample({ shapes: { jawOpen: 0.2 } })).ok).toBe(true);
    expect(evaluateFrame(sample({ shapes: { mouthPucker: 0.46 } })).issue).toBe("mouth-open");
    expect(evaluateFrame(sample({ shapes: { browInnerUp: 0.36 } })).issue).toBe("brows-raised");
    expect(evaluateFrame(sample({ shapes: { browDownLeft: 0.4, browDownRight: 0.4 } })).issue).toBe("frowning");
    expect(evaluateFrame(sample({ shapes: { browDownLeft: 0.3, browDownRight: 0.3 } })).ok).toBe(true);
    expect(evaluateFrame(sample({ shapes: { eyeBlinkLeft: 0.6, eyeBlinkRight: 0.6 } })).issue).toBe("eyes-closed");
    expect(evaluateFrame(sample({ shapes: { eyeWideLeft: 0.5, eyeWideRight: 0.5 } })).issue).toBe("eyes-wide");
  });

  it("rechaza cabeza girada o ladeada", () => {
    expect(evaluateFrame(sample({ pose: { yaw: 13, pitch: 0, roll: 0 } })).issue).toBe("head-turned");
    expect(evaluateFrame(sample({ pose: { yaw: 0, pitch: -11, roll: 0 } })).issue).toBe("head-turned");
    expect(evaluateFrame(sample({ pose: { yaw: 0, pitch: 0, roll: 9 } })).issue).toBe("head-tilted");
    expect(evaluateFrame(sample({ pose: { yaw: 12, pitch: 10, roll: 8 } })).ok).toBe(true);
  });

  it("rechaza rostro lejos, muy cerca o descentrado", () => {
    expect(evaluateFrame(sample({ box: { cx: 0.5, cy: 0.5, width: 0.2 } })).issue).toBe("too-far");
    expect(evaluateFrame(sample({ box: { cx: 0.5, cy: 0.5, width: 0.85 } })).issue).toBe("too-close");
    expect(evaluateFrame(sample({ box: { cx: 0.75, cy: 0.5, width: 0.5 } })).issue).toBe("off-center");
  });

  it("detecta sin rostro, varios rostros y datos incompletos", () => {
    expect(evaluateFrame(sample({ faceCount: 0 })).issue).toBe("no-face");
    expect(evaluateFrame(sample({ faceCount: 2 })).issue).toBe("multiple-faces");
    expect(evaluateFrame(sample({ blendshapes: null })).issue).toBe("not-evaluable");
  });

  it("prioriza el motivo: orientación antes que ojos, ojos antes que boca, boca antes que sonrisa", () => {
    const shapes = { ...smile(0.8), jawOpen: 0.5, eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 };
    expect(evaluateFrame(sample({ shapes, pose: { yaw: 40, pitch: 0, roll: 0 } })).issue).toBe("head-turned");
    expect(evaluateFrame(sample({ shapes })).issue).toBe("eyes-closed");
    expect(evaluateFrame(sample({ shapes: { ...smile(0.8), jawOpen: 0.5 } })).issue).toBe("mouth-open");
    expect(evaluateFrame(sample({ shapes: smile(0.8) })).issue).toBe("smiling");
  });
});

describe("summarizeWindow", () => {
  const neutral = () => sample();
  const blink = () => sample({ shapes: { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 } });

  it("acepta cuando 4 de 5 fotogramas pasan (un parpadeo aislado no rechaza)", () => {
    const verdict = summarizeWindow([neutral(), neutral(), blink(), neutral(), neutral()]);
    expect(verdict).toEqual({ status: "neutral", issue: null, message: null });
  });

  it("rechaza cuando solo 3 de 5 pasan, con el motivo más frecuente", () => {
    const verdict = summarizeWindow([neutral(), blink(), blink(), neutral(), neutral()]);
    expect(verdict.status).toBe("rejected");
    expect(verdict.issue).toBe("eyes-closed");
    expect(verdict.message).toBe(rejectionMessage("eyes-closed"));
  });

  it("rechaza una sonrisa clara sostenida y pide sacarla de nuevo", () => {
    const smiling = () => sample({ shapes: smile(0.7) });
    const verdict = summarizeWindow([smiling(), smiling(), smiling(), smiling(), smiling()]);
    expect(verdict.issue).toBe("smiling");
    expect(verdict.message).toBe("La foto no quedó neutra. Sacala de nuevo: Relajá la sonrisa.");
  });

  it("acepta una sonrisa muy leve sostenida", () => {
    const slight = () => sample({ shapes: smile(0.2) });
    expect(summarizeWindow([slight(), slight(), slight(), slight(), slight()]).status).toBe("neutral");
  });

  it("marca no evaluable cuando 2 o más fotogramas no tienen rostro", () => {
    const none = () => sample({ faceCount: 0, blendshapes: null, pose: null, box: null });
    const verdict = summarizeWindow([neutral(), none(), none(), neutral(), neutral()]);
    expect(verdict.issue).toBe("not-evaluable");
    expect(verdict.message).toContain("Buscá más luz y mostralo completo.");
  });

  it("tolera un único fotograma sin rostro si los otros 4 pasan", () => {
    const none = () => sample({ faceCount: 0, blendshapes: null, pose: null, box: null });
    expect(summarizeWindow([neutral(), none(), neutral(), neutral(), neutral()]).status).toBe("neutral");
  });

  it("con una ventana vacía no hay nada que evaluar", () => {
    expect(summarizeWindow([]).issue).toBe("not-evaluable");
  });

  it("con pocos fotogramas exige que pasen todos", () => {
    expect(summarizeWindow([neutral(), blink()]).status).toBe("rejected");
    expect(summarizeWindow([neutral(), neutral()]).status).toBe("neutral");
  });

  it("en un empate gana el motivo de mayor prioridad", () => {
    const verdict = summarizeWindow([
      sample({ shapes: smile(0.7) }),
      sample({ shapes: smile(0.7) }),
      sample({ shapes: { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 } }),
      sample({ shapes: { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 } }),
      neutral(),
    ]);
    expect(verdict.issue).toBe("eyes-closed");
  });

  it("los mensajes están en español rioplatense (voseo)", () => {
    expect(issueMessage("no-face")).toContain("Ubicá");
    expect(issueMessage("too-far")).toContain("Acercate");
  });
});
