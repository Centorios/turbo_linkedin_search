"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceAnalyzerFactory } from "../lib/face-analyzer";
import { useExpressionCheck } from "../lib/use-expression-check";
import { AlertIcon, CheckCircleIcon, SpinnerIcon } from "./icons";

type CameraCaptureProps = {
  /** Receives the captured photo as a JPEG file. */
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Replaces the face analyzer (tests only). */
  createAnalyzer?: FaceAnalyzerFactory;
};

const CAPTURE_SIZE = 640;
export const CAMERA_PHOTO_NAME = "foto-camara.jpg";

export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "No diste permiso para usar la cámara. Podés habilitarlo en la configuración del navegador o elegir un archivo con Buscar.";
    case "NotFoundError":
    case "OverconstrainedError":
    case "DevicesNotFoundError":
      return "No encontramos una cámara en este dispositivo.";
    case "NotReadableError":
    case "TrackStartError":
      return "La cámara está siendo usada por otra aplicación.";
    default:
      return "No se pudo abrir la cámara.";
  }
}

export function isCameraSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

// Live camera preview with a "Tomar foto" button. The camera is always released
// (every track stopped) when this component unmounts, whatever the reason.
export function CameraCapture({ onCapture, onClose, createAnalyzer }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const takeRef = useRef<HTMLButtonElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const capturingRef = useRef(false);
  const expression = useExpressionCheck(videoRef, createAnalyzer);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    regionRef.current?.focus();

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false })
      .then((opened) => {
        if (cancelled) {
          // Closed while the permission prompt was open: release the camera right away.
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        if (videoRef.current) videoRef.current.srcObject = opened;
        setState("ready");
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(cameraErrorMessage(failure));
        setState("error");
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  useEffect(() => {
    if (state === "ready") takeRef.current?.focus();
  }, [state]);

  useEffect(() => {
    // The rejection is stale once the live indicator says the expression is fine.
    if (expression.status === "ready") setRejection(null);
  }, [expression.status]);

  function takePhoto() {
    if (capturingRef.current) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("La cámara todavía no está lista. Esperá un segundo y volvé a intentar.");
      return;
    }
    // A rejected photo is dropped: the camera stays on and nothing is offered to keep it.
    const verdict = expression.check();
    if (verdict.status === "rejected") {
      setRejection(verdict.message);
      return;
    }
    setRejection(null);
    const canvas = document.createElement("canvas");
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("No se pudo tomar la foto.");
      return;
    }
    // Centered square crop, not mirrored: the saved photo looks like the real one.
    capturingRef.current = true;
    const side = Math.min(video.videoWidth, video.videoHeight);
    context.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      CAPTURE_SIZE,
      CAPTURE_SIZE,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          capturingRef.current = false;
          setError("No se pudo tomar la foto.");
          return;
        }
        onCapture(new File([blob], CAMERA_PHOTO_NAME, { type: "image/jpeg" }));
        onClose();
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div
      ref={regionRef}
      role="group"
      aria-label="Cámara"
      tabIndex={-1}
      data-testid="profile-photo-camera"
      onKeyDown={(event) => {
        // Escape closes the camera, not the profile dialog around it.
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-border bg-subtle p-4 focus:outline-none"
    >
      {state !== "error" && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          data-testid="camera-video"
          className={`h-44 w-44 -scale-x-100 rounded-full border border-border bg-black object-cover ${state === "ready" ? "" : "opacity-40"}`}
        />
      )}
      {state === "starting" && (
        <p role="status" className="flex items-center gap-2 text-body-sm text-text-muted">
          <SpinnerIcon className="h-4 w-4" />
          Esperando el permiso de la cámara...
        </p>
      )}
      {state === "ready" && expression.status !== "unavailable" && (
        <p
          role="status"
          aria-live="polite"
          data-testid="camera-expression-status"
          className="flex items-start gap-2 text-body-sm text-text"
        >
          {expression.status === "loading" && <SpinnerIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />}
          {expression.status === "ready" && <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
          {expression.status !== "loading" && expression.status !== "ready" && (
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          )}
          <span>{expression.message}</span>
        </p>
      )}
      {state === "ready" && expression.status === "unavailable" && (
        <p role="status" data-testid="camera-expression-unavailable" className="flex items-start gap-2 text-body-sm text-text-muted">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{expression.message}</span>
        </p>
      )}
      {rejection && (
        <p role="alert" data-testid="camera-expression-rejection" className="flex items-start gap-2 text-body-sm text-danger">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{rejection}</span>
        </p>
      )}
      {error && (
        <p role="alert" data-testid="camera-error" className="flex items-start gap-2 text-body-sm text-danger">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {state !== "error" && (
          <button
            ref={takeRef}
            type="button"
            onClick={takePhoto}
            disabled={state !== "ready" || expression.status === "loading"}
            data-testid="camera-take-photo"
            className="focus-ring rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            Tomar foto
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          data-testid="camera-cancel"
          className="focus-ring rounded-lg border border-border bg-surface px-4 py-2 text-body-sm font-semibold text-text hover:bg-subtle"
        >
          {state === "error" ? "Cerrar" : "Cancelar"}
        </button>
      </div>
    </div>
  );
}
