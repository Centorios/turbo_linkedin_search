"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  LOADING_MESSAGE,
  READY_MESSAGE,
  UNAVAILABLE_MESSAGE,
  WINDOW_SIZE,
  evaluateFrame,
  issueMessage,
  measureFrame,
  summarizeWindow,
  type ExpressionVerdict,
  type FrameSample,
  type LiveStatus,
} from "./expression-check";
import { createFaceAnalyzer, type FaceAnalyzer, type FaceAnalyzerFactory } from "./face-analyzer";

export const ANALYSIS_INTERVAL_MS = 100;
export const LOAD_TIMEOUT_MS = 8000;
const READY_STREAK = 3;
const LEAVE_READY_STREAK = 2;

type LiveState = { status: LiveStatus; message: string };

const LOADING: LiveState = { status: "loading", message: LOADING_MESSAGE };
const UNAVAILABLE: LiveState = { status: "unavailable", message: UNAVAILABLE_MESSAGE };
const READY: LiveState = { status: "ready", message: READY_MESSAGE };
const NEUTRAL: ExpressionVerdict = { status: "neutral", issue: null, message: null };

export type ExpressionCheck = {
  status: LiveStatus;
  /** Text for the live indicator. */
  message: string;
  /** Verdict for the photo being taken now, from the last frames. */
  check: () => ExpressionVerdict;
};

// Analyzes the camera preview a few times per second and keeps the last frames,
// so the verdict at capture time does not depend on a single noisy frame.
export function useExpressionCheck(
  videoRef: RefObject<HTMLVideoElement | null>,
  createAnalyzer: FaceAnalyzerFactory = createFaceAnalyzer,
): ExpressionCheck {
  const [state, setState] = useState<LiveState>(LOADING);
  const stateRef = useRef<LiveState>(LOADING);
  const historyRef = useRef<FrameSample[]>([]);
  const factoryRef = useRef(createAnalyzer);

  const update = useCallback((next: LiveState) => {
    stateRef.current = next;
    setState((current) => (current.status === next.status && current.message === next.message ? current : next));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let analyzer: FaceAnalyzer | null = null;
    let interval: ReturnType<typeof setInterval> | undefined;
    let okStreak = 0;
    let badStreak = 0;
    let ticks = 0;
    const debug = new URLSearchParams(window.location.search).has("debug-expression");
    historyRef.current = [];

    const giveUp = () => {
      if (interval) clearInterval(interval);
      update(UNAVAILABLE);
    };
    const timeout = setTimeout(() => {
      // Too slow: the camera works as usual and a late analyzer is released on arrival.
      cancelled = true;
      giveUp();
    }, LOAD_TIMEOUT_MS);

    function tick() {
      const video = videoRef.current;
      if (!analyzer || !video || !video.videoWidth) return;
      let sample: FrameSample;
      try {
        sample = analyzer.analyze(video, performance.now());
      } catch {
        giveUp();
        return;
      }
      historyRef.current = [...historyRef.current, sample].slice(-WINDOW_SIZE);

      // Calibration aid: open the page with ?debug-expression=1 to see the measured values in the console.
      if (debug && ++ticks % 5 === 0) {
        const measures = measureFrame(sample);
        console.debug("[expression]", measures
          ? {
              ...Object.fromEntries(Object.entries(measures).map(([key, number]) => [key, Math.round(number * 100) / 100])),
              lipOpening: sample.lipOpening == null ? null : Math.round(sample.lipOpening * 1000) / 1000,
            }
          : `faces=${sample.faceCount}`);
      }

      const { ok, issue } = evaluateFrame(sample);
      okStreak = ok ? okStreak + 1 : 0;
      badStreak = ok ? 0 : badStreak + 1;

      const wasReady = stateRef.current.status === "ready";
      if (ok) {
        if (okStreak >= READY_STREAK) update(READY);
      } else if (issue && (!wasReady || badStreak >= LEAVE_READY_STREAK)) {
        const status = issue === "no-face" || issue === "multiple-faces" ? issue : "adjust";
        update({ status, message: issueMessage(issue) });
      }
    }

    factoryRef
      .current()
      .then((created) => {
        if (cancelled) {
          created.close();
          return;
        }
        clearTimeout(timeout);
        analyzer = created;
        interval = setInterval(tick, ANALYSIS_INTERVAL_MS);
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeout);
        update(UNAVAILABLE);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
      analyzer?.close();
    };
  }, [videoRef, update]);

  const check = useCallback((): ExpressionVerdict => {
    // Without an analyzer the photo is taken unverified; while loading, the button is disabled.
    if (stateRef.current.status === "unavailable") return NEUTRAL;
    return summarizeWindow(historyRef.current);
  }, []);

  return { status: state.status, message: state.message, check };
}
