"use client";

import { useEffect, useRef, useState } from "react";
import { analyzePhotoForBackground } from "../lib/background-analyzer";
import { createBackgroundBlurredCanvas } from "../lib/background-blur";
import { analyzePhotoForSkin, type FaceAnalyzerFactory } from "../lib/face-analyzer";
import { canvasToJpeg, createSkinSmoothedPhoto, type SkinContours } from "../lib/skin-smoothing";
import { useExpressionCheck } from "../lib/use-expression-check";
import { AlertIcon, CheckCircleIcon, SpinnerIcon } from "./icons";

type CameraCaptureProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
  createAnalyzer?: FaceAnalyzerFactory;
  createPersonMask?: typeof analyzePhotoForBackground;
  createSkinContours?: (image: HTMLCanvasElement) => Promise<SkinContours | null>;
};

type CapturedPhoto = { file: File; canvas: HTMLCanvasElement; previewUrl: string };
type PhotoVersion = { file: File; url: string };
type PhotoReview =
  | { status: "processing" }
  | {
      status: "ready";
      background: PhotoVersion | null;
      enhanced: PhotoVersion | null;
      enhancedBackground: PhotoVersion | null;
      backgroundError: string | null;
      skinError: string | null;
      enhancedBackgroundError: string | null;
    };

const CAPTURE_SIZE = 640;
export const CAMERA_PHOTO_NAME = "foto-camara.jpg";
export const CAMERA_BACKGROUND_BLURRED_PHOTO_NAME = "foto-camara-fondo-desenfocado.jpg";

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

export function CameraCapture({ onCapture, onClose, createAnalyzer, createPersonMask, createSkinContours }: CameraCaptureProps) {
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const [review, setReview] = useState<PhotoReview | null>(null);
  const [backgroundEnabled, setBackgroundEnabled] = useState(true);
  const [mobilePreview, setMobilePreview] = useState<"original" | "beautified">("original");
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    if (!captured) {
      setReview(null);
      return;
    }
    let cancelled = false;
    const urls: string[] = [];
    function makeVersion(blob: Blob, name: string): PhotoVersion {
      const file = new File([blob], name, { type: "image/jpeg" });
      const url = URL.createObjectURL(file);
      urls.push(url);
      return { file, url };
    }
    setReview({ status: "processing" });

    void (async () => {
      let background: PhotoVersion | null = null;
      let backgroundCanvas: HTMLCanvasElement | null = null;
      let enhanced: PhotoVersion | null = null;
      let enhancedBackground: PhotoVersion | null = null;
      let backgroundError: string | null = null;
      let skinError: string | null = null;
      let enhancedBackgroundError: string | null = null;
      try {
        const personMask = await (createPersonMask ?? analyzePhotoForBackground)(captured.canvas);
        if (cancelled) return;
        backgroundCanvas = createBackgroundBlurredCanvas(captured.canvas, personMask);
        const backgroundBlob = await canvasToJpeg(backgroundCanvas);
        if (cancelled) return;
        background = makeVersion(backgroundBlob, CAMERA_BACKGROUND_BLURRED_PHOTO_NAME);
      } catch {
        backgroundCanvas = null;
        backgroundError = "No pudimos desenfocar el fondo. Podés usar la foto sin desenfoque o tomar otra.";
      }
      if (cancelled) return;
      try {
        const contours = await (createSkinContours ?? analyzePhotoForSkin)(captured.canvas);
        if (cancelled) return;
        if (!contours) throw new Error("No se detectó un rostro único con contornos válidos.");
        const enhancedBlob = await createSkinSmoothedPhoto(captured.canvas, contours);
        if (cancelled) return;
        enhanced = makeVersion(enhancedBlob, "foto-camara-embellecida-sin-desenfoque.jpg");
        if (backgroundCanvas) {
          try {
            const blurredEnhancedBlob = await createSkinSmoothedPhoto(backgroundCanvas, contours);
            if (cancelled) return;
            enhancedBackground = makeVersion(blurredEnhancedBlob, "foto-camara-embellecida.jpg");
          } catch {
            enhancedBackgroundError = "No pudimos suavizar la piel con el fondo desenfocado. Desactivá el desenfoque para usar la foto embellecida.";
          }
        }
      } catch {
        skinError = "No pudimos suavizar la piel. Podés usar la foto original o tomar otra.";
      }
      if (cancelled) return;
      if (!background) setBackgroundEnabled(false);
      setReview({ status: "ready", background, enhanced, enhancedBackground, backgroundError, skinError, enhancedBackgroundError });
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(captured.previewUrl);
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [captured, createPersonMask, createSkinContours]);

  function capturePhoto(file: File, canvas: HTMLCanvasElement) {
    setMobilePreview("original");
    setBackgroundEnabled(true);
    setReview({ status: "processing" });
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

  const readyReview = review?.status === "ready" ? review : null;
  const backgroundVersion = backgroundEnabled ? readyReview?.background : null;
  const useBackground = !!backgroundVersion;
  const backgroundChecked = review?.status === "processing" ? backgroundEnabled : useBackground;
  const originalPreviewUrl = backgroundVersion?.url ?? captured.previewUrl;
  const originalLabel = backgroundVersion ? "Original con fondo desenfocado" : "Original";
  const originalFile = backgroundVersion?.file ?? captured.file;
  const enhancedVersion = useBackground ? readyReview?.enhancedBackground : readyReview?.enhanced;
  const visibleMobilePreview = mobilePreview === "beautified" && enhancedVersion ? "beautified" : "original";

  return (
    <div
      role="group"
      aria-label="Elegir foto de perfil"
      data-testid="camera-photo-review"
      className="mt-3 flex w-full flex-col items-center gap-4 rounded-xl border border-border bg-subtle p-4 sm:p-6"
    >
      <button
        type="button"
        role="switch"
        aria-checked={backgroundChecked}
        disabled={!readyReview?.background}
        onClick={() => setBackgroundEnabled((current) => !current)}
        data-testid="camera-background-toggle"
        className="focus-ring flex items-center gap-3 rounded-lg text-body-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>Desenfocar fondo</span>
        <span aria-hidden="true" className={`relative h-6 w-11 rounded-full transition-colors ${backgroundChecked ? "bg-primary" : "bg-text-muted"}`}>
          <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${backgroundChecked ? "translate-x-5" : "translate-x-0.5"}`} />
        </span>
      </button>
      {enhancedVersion && (
        <div className="flex w-full max-w-sm gap-2 md:hidden" role="group" aria-label="Elegir vista previa">
          <button
            type="button"
            aria-pressed={visibleMobilePreview === "original"}
            onClick={() => setMobilePreview("original")}
            data-testid="camera-preview-original"
            className="focus-ring flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-body-sm font-semibold text-text aria-pressed:border-primary aria-pressed:text-primary"
          >
            Original
          </button>
          <button
            type="button"
            aria-pressed={visibleMobilePreview === "beautified"}
            onClick={() => setMobilePreview("beautified")}
            data-testid="camera-preview-beautified"
            className="focus-ring flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-body-sm font-semibold text-text aria-pressed:border-primary aria-pressed:text-primary"
          >
            Embellecida
          </button>
        </div>
      )}
      <figure className="m-0 flex w-full flex-col items-center gap-2 md:hidden">
        <img
          src={visibleMobilePreview === "beautified" && enhancedVersion ? enhancedVersion.url : originalPreviewUrl}
          alt={`Vista previa ${visibleMobilePreview === "beautified" ? "embellecida" : originalLabel.toLowerCase()}`}
          data-testid="camera-mobile-preview-image"
          className="aspect-square w-full max-w-sm rounded-xl border border-border object-cover"
        />
        <figcaption className="text-body-sm font-semibold text-text">
          {visibleMobilePreview === "beautified" ? "Embellecida" : originalLabel}
        </figcaption>
      </figure>
      <div className="hidden w-full grid-cols-2 justify-items-center gap-6 md:grid">
        <figure className="m-0">
          <img
            src={originalPreviewUrl}
            alt={originalLabel}
            data-testid="camera-photo-original"
            className="aspect-square w-full max-w-[420px] rounded-xl border border-border object-cover"
          />
          <figcaption className="mt-2 text-body-sm font-semibold text-text">{originalLabel}</figcaption>
        </figure>
        {enhancedVersion && (
          <figure className="m-0">
            <img
              src={enhancedVersion.url}
              alt="Foto embellecida"
              data-testid="camera-photo-beautified"
              className="aspect-square w-full max-w-[420px] rounded-xl border border-border object-cover"
            />
            <figcaption className="mt-2 text-body-sm font-semibold text-text">Embellecida</figcaption>
          </figure>
        )}
      </div>
      {review?.status === "processing" && (
        <p role="status" aria-live="polite" data-testid="camera-skin-filter-processing" className="flex items-center gap-2 text-body-sm text-text-muted">
          <SpinnerIcon className="h-4 w-4" />
          Desenfocando el fondo y preparando la versión embellecida...
        </p>
      )}
      {(readyReview?.backgroundError || readyReview?.skinError || (useBackground && readyReview?.enhancedBackgroundError)) && (
        <p role="alert" data-testid="camera-skin-filter-error" className="flex items-start gap-2 text-body-sm text-warning">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{[readyReview?.backgroundError, readyReview?.skinError, useBackground && readyReview?.enhancedBackgroundError].filter(Boolean).join(" ")}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectPhoto(originalFile)}
          disabled={review?.status === "processing"}
          data-testid="camera-use-original"
          className="focus-ring rounded-lg border border-border bg-surface px-4 py-2 text-body-sm font-semibold text-text hover:bg-subtle disabled:cursor-wait disabled:opacity-60"
        >
          Usar original
        </button>
        {enhancedVersion && (
          <button
            type="button"
            onClick={() => selectPhoto(enhancedVersion.file)}
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
