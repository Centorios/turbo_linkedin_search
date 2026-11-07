"use client";

import { useEffect, useRef, useState } from "react";
import { analyzePhotoForSkin, type FaceAnalyzerFactory } from "../lib/face-analyzer";
import { createSkinSmoothedPhoto, type SkinContours } from "../lib/skin-smoothing";
import { useExpressionCheck } from "../lib/use-expression-check";
import { AlertIcon, CheckCircleIcon, SpinnerIcon } from "./icons";

type CameraCaptureProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
  createAnalyzer?: FaceAnalyzerFactory;
  createSkinContours?: (image: HTMLCanvasElement) => Promise<SkinContours | null>;
};

type CapturedPhoto = { file: File; canvas: HTMLCanvasElement; previewUrl: string };
type PhotoReview =
  | { status: "processing" }
  | { status: "ready"; enhancedFile: File; enhancedUrl: string }
  | { status: "original-only"; error: string };

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

function CameraSession({
  onPhoto,
  onClose,
  createAnalyzer,
}: {
  onPhoto: (file: File, canvas: HTMLCanvasElement) => void;
  onClose: () => void;
  createAnalyzer?: FaceAnalyzerFactory;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const takeRef = useRef<HTMLButtonElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturingRef = useRef(false);
  const [state, setState] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const expression = useExpressionCheck(videoRef, createAnalyzer);

  function releaseCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => {
    let cancelled = false;
    regionRef.current?.focus();

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false })
      .then((opened) => {
        if (cancelled) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = opened;
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
      releaseCamera();
    };
  }, []);

  useEffect(() => {
    if (state === "ready") takeRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (expression.status === "ready") setRejection(null);
  }, [expression.status]);

  function takePhoto() {
    if (capturingRef.current) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("La cámara todavía no está lista. Esperá un segundo y volvé a intentar.");
      return;
    }
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
        const file = new File([blob], CAMERA_PHOTO_NAME, { type: "image/jpeg" });
        releaseCamera();
        onPhoto(file, canvas);
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

export function CameraCapture({ onCapture, onClose, createAnalyzer, createSkinContours }: CameraCaptureProps) {
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const [review, setReview] = useState<PhotoReview | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    if (!captured) {
      setReview(null);
      return;
    }
    let cancelled = false;
    let enhancedUrl: string | null = null;
    setReview({ status: "processing" });

    void (async () => {
      try {
        const contours = await (createSkinContours ?? analyzePhotoForSkin)(captured.canvas);
        if (!contours) throw new Error("No se detectó un rostro único con contornos válidos.");
        const blob = await createSkinSmoothedPhoto(captured.canvas, contours);
        const enhancedFile = new File([blob], "foto-camara-embellecida.jpg", { type: "image/jpeg" });
        enhancedUrl = URL.createObjectURL(enhancedFile);
        if (cancelled) {
          URL.revokeObjectURL(enhancedUrl);
          enhancedUrl = null;
          return;
        }
        setReview({ status: "ready", enhancedFile, enhancedUrl });
      } catch {
        if (!cancelled) {
          setReview({
            status: "original-only",
            error: "No pudimos aplicar el suavizado. Podés usar la foto original o tomar otra.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(captured.previewUrl);
      if (enhancedUrl) URL.revokeObjectURL(enhancedUrl);
    };
  }, [captured, createSkinContours]);

  function capturePhoto(file: File, canvas: HTMLCanvasElement) {
    setCaptured({ file, canvas, previewUrl: URL.createObjectURL(file) });
  }

  function selectPhoto(file: File) {
    setCaptured(null);
    setReview(null);
    onCapture(file);
    onClose();
  }

  function cancelReview() {
    setCaptured(null);
    setReview(null);
    onClose();
  }

  function retakePhoto() {
    setCaptured(null);
    setReview(null);
    setSessionKey((current) => current + 1);
  }

  if (!captured) {
    return <CameraSession key={sessionKey} onPhoto={capturePhoto} onClose={onClose} createAnalyzer={createAnalyzer} />;
  }

  return (
    <div
      role="group"
      aria-label="Elegir foto de perfil"
      data-testid="camera-photo-review"
      className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-border bg-subtle p-4"
    >
      <div className="flex flex-wrap gap-4">
        <figure className="m-0">
          <img
            src={captured.previewUrl}
            alt="Foto original"
            data-testid="camera-photo-original"
            className="h-36 w-36 rounded-xl border border-border object-cover"
          />
          <figcaption className="mt-1 text-body-sm text-text">Original</figcaption>
        </figure>
        {review?.status === "ready" && (
          <figure className="m-0">
            <img
              src={review.enhancedUrl}
              alt="Foto embellecida"
              data-testid="camera-photo-beautified"
              className="h-36 w-36 rounded-xl border border-border object-cover"
            />
            <figcaption className="mt-1 text-body-sm text-text">Embellecida</figcaption>
          </figure>
        )}
      </div>
      {review?.status === "processing" && (
        <p role="status" aria-live="polite" data-testid="camera-skin-filter-processing" className="flex items-center gap-2 text-body-sm text-text-muted">
          <SpinnerIcon className="h-4 w-4" />
          Preparando la versión embellecida...
        </p>
      )}
      {review?.status === "original-only" && (
        <p role="alert" data-testid="camera-skin-filter-error" className="flex items-start gap-2 text-body-sm text-warning">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{review.error}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectPhoto(captured.file)}
          data-testid="camera-use-original"
          className="focus-ring rounded-lg border border-border bg-surface px-4 py-2 text-body-sm font-semibold text-text hover:bg-subtle"
        >
          Usar original
        </button>
        {review?.status === "ready" && (
          <button
            type="button"
            onClick={() => selectPhoto(review.enhancedFile)}
            data-testid="camera-use-beautified"
            className="focus-ring rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
          >
            Usar embellecida
          </button>
        )}
        <button
          type="button"
          onClick={retakePhoto}
          data-testid="camera-retake-photo"
          className="focus-ring rounded-lg border border-border bg-surface px-4 py-2 text-body-sm font-semibold text-text hover:bg-subtle"
        >
          Tomar otra
        </button>
        <button
          type="button"
          onClick={cancelReview}
          data-testid="camera-cancel"
          className="focus-ring rounded-lg border border-border bg-surface px-4 py-2 text-body-sm font-semibold text-text hover:bg-subtle"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
