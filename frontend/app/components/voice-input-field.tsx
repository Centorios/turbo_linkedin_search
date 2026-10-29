"use client";

import type { ReactNode } from "react";
import { AlertIcon, MicrophoneIcon } from "./icons";
import { useSpeechDictation } from "../lib/speech-dictation";

type VoiceInputFieldProps = {
  /** Suffix for the data-testid of the button, the status and the error. */
  id: string;
  /** Receives each confirmed phrase; the parent adds it with appendDictation. */
  onTranscript: (chunk: string) => void;
  /** Name of the field, added (for screen readers) to the button's name when a screen has several. */
  fieldLabel?: string;
  /** Disables the microphone and stops a dictation in progress. */
  disabled?: boolean;
  /** The textarea that receives the dictated text. */
  children: ReactNode;
};

// Wraps a textarea with a microphone button in its bottom-right corner, plus the
// "Escuchando…" status and any error below it. Without browser support it only
// renders the textarea, so nothing broken or in English is ever shown.
export function VoiceInputField({ id, onTranscript, fieldLabel, disabled = false, children }: VoiceInputFieldProps) {
  const { supported, status, interim, error, toggle } = useSpeechDictation({ onTranscript, disabled });

  if (!supported) return <>{children}</>;

  const listening = status === "listening";
  const action = listening ? "Detener dictado" : "Dictar por voz";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="voice-input-field relative" data-voice-enabled="true">
        {children}
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-pressed={listening}
          title={action}
          data-testid={`voice-input-${id}`}
          data-listening={listening ? "true" : "false"}
          className={`voice-input-button focus-ring absolute bottom-2.5 right-6 flex h-9 items-center gap-1.5 rounded-full border px-3 text-caption-xs font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            listening
              ? "border-danger bg-danger text-on-primary hover:opacity-90"
              : "border-border bg-surface text-text-muted hover:bg-subtle hover:text-text"
          }`}
        >
          <MicrophoneIcon className="h-4 w-4" />
          {/* The name comes from the content, not aria-label: an aria-label holding the
              field's name would also match getByLabel(<field label>) and the field itself. */}
          <span>{listening ? "Detener" : "Dictar"}</span>{" "}
          <span className="sr-only">
            {listening ? "dictado" : "por voz"}
            {fieldLabel ? ` en ${fieldLabel}` : ""}
          </span>
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        data-testid={`voice-input-status-${id}`}
        className="min-h-0 text-caption-xs text-text-muted empty:hidden"
      >
        {listening ? (
          <>
            <span className="font-semibold text-danger">Escuchando…</span>
            {interim ? <span className="ml-1 italic">{interim}</span> : <span className="ml-1">Hablá con naturalidad; el texto se agrega al final.</span>}
          </>
        ) : null}
      </p>
      {error && (
        <p role="alert" data-testid={`voice-input-error-${id}`} className="flex items-start gap-2 text-caption-xs text-danger">
          <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
