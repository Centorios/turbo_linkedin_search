import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrameSample } from "../app/lib/expression-check";
import type { FaceAnalyzer } from "../app/lib/face-analyzer";
import { ANALYSIS_INTERVAL_MS, LOAD_TIMEOUT_MS, useExpressionCheck } from "../app/lib/use-expression-check";

const neutral: FrameSample = {
  faceCount: 1,
  blendshapes: {},
  pose: { yaw: 0, pitch: 0, roll: 0 },
  box: { cx: 0.5, cy: 0.5, width: 0.5 },
};
const smiling: FrameSample = { ...neutral, blendshapes: { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 } };
const turned: FrameSample = { ...neutral, pose: { yaw: 30, pitch: 0, roll: 0 } };

const videoRef = { current: { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement };

function setup(initial: FrameSample) {
  const current = { sample: initial };
  const analyzer = { analyze: vi.fn(() => current.sample), close: vi.fn() };
  const factory = vi.fn(async () => analyzer as FaceAnalyzer);
  const hook = renderHook(() => useExpressionCheck(videoRef, factory));
  return { current, analyzer, factory, ...hook };
}

async function tick(times = 1) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ANALYSIS_INTERVAL_MS);
    });
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useExpressionCheck", () => {
  it("exige 3 fotogramas v\u00e1lidos seguidos para mostrar \"listo\"", async () => {
    const { result } = setup(neutral);
    expect(result.current.status).toBe("loading");

    await tick(2);
    expect(result.current.status).not.toBe("ready");

    await tick();
    expect(result.current.status).toBe("ready");
    expect(result.current.message).toBe("Listo, expresi\u00f3n neutra.");
  });

  it("sale de \"listo\" solo tras 2 fotogramas inv\u00e1lidos seguidos", async () => {
    const { result, current } = setup(neutral);
    await tick(3);
    expect(result.current.status).toBe("ready");

    current.sample = smiling;
    await tick();
    expect(result.current.status).toBe("ready");

    await tick();
    expect(result.current.status).toBe("adjust");
    expect(result.current.message).toBe("Relaj\u00e1 la sonrisa.");
  });

  it("un fotograma inv\u00e1lido aislado no rompe la racha de \"listo\"", async () => {
    const { result, current } = setup(neutral);
    await tick(3);

    current.sample = turned;
    await tick();
    current.sample = neutral;
    await tick();

    expect(result.current.status).toBe("ready");
  });

  it("distingue sin rostro y varios rostros", async () => {
    const { result, current } = setup({ ...neutral, faceCount: 0, blendshapes: null, pose: null, box: null });
    await tick();
    expect(result.current.status).toBe("no-face");

    current.sample = { ...current.sample, faceCount: 2 };
    await tick();
    expect(result.current.status).toBe("multiple-faces");
  });

  it("check() decide con los \u00faltimos fotogramas", async () => {
    const { result, current } = setup(neutral);
    await tick(5);
    expect(result.current.check().status).toBe("neutral");

    current.sample = smiling;
    await tick(5);
    expect(result.current.check()).toMatchObject({ status: "rejected", issue: "smiling" });
  });

  it("al desmontar detiene el an\u00e1lisis y libera el analizador", async () => {
    const { analyzer, unmount } = setup(neutral);
    await tick(2);
    const calls = analyzer.analyze.mock.calls.length;

    unmount();
    await tick(3);

    expect(analyzer.close).toHaveBeenCalledTimes(1);
    expect(analyzer.analyze.mock.calls.length).toBe(calls);
  });

  it("si el analizador tarda demasiado queda no disponible y lo libera cuando llega", async () => {
    let arrive!: (analyzer: FaceAnalyzer) => void;
    const late = { analyze: vi.fn(() => neutral), close: vi.fn() };
    const factory = vi.fn(() => new Promise<FaceAnalyzer>((resolve) => { arrive = resolve; }));
    const { result } = renderHook(() => useExpressionCheck(videoRef, factory));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    });
    expect(result.current.status).toBe("unavailable");
    expect(result.current.check().status).toBe("neutral");

    await act(async () => arrive(late as FaceAnalyzer));
    expect(late.close).toHaveBeenCalledTimes(1);
  });

  it("si el analizador no carga queda no disponible", async () => {
    const factory = vi.fn(async () => { throw new Error("sin wasm"); });
    const { result } = renderHook(() => useExpressionCheck(videoRef, factory));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.status).toBe("unavailable");
    expect(result.current.check().status).toBe("neutral");
  });
});
