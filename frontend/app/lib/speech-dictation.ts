"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Voice dictation with the browser's own speech recognition (Web Speech API).
// No dependency, key or backend: the app only receives the recognized text.
// Chrome, Edge and Safari expose it (prefixed as webkitSpeechRecognition);
// Firefox does not, so the microphone button is simply not shown there.

export const DICTATION_LANG = "es-AR";

// lib.dom no longer ships these types, so only what this module uses is declared.
type RecognitionAlternativeLike = { transcript: string };
type RecognitionResultLike = { readonly isFinal: boolean; readonly length: number; [index: number]: RecognitionAlternativeLike };
export type SpeechRecognitionResultEventLike = {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResultLike };
};
export type SpeechRecognitionErrorEventLike = { readonly error: string };

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type DictationStatus = "idle" | "listening" | "error";

export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function isSpeechDictationSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

const GENERIC_ERROR = "No se pudo usar el dictado por voz.";

/** Message for a recognition error code; null when there is nothing to tell (we cancelled it). */
export function dictationErrorMessage(code: string): string | null {
  switch (code) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "No diste permiso para usar el micrófono. Podés habilitarlo en la configuración del navegador o seguir escribiendo.";
    case "audio-capture":
      return "No encontramos un micrófono en este dispositivo.";
    case "network":
      return "El dictado necesita conexión a internet. Revisá tu conexión y volvé a intentar.";
    case "no-speech":
      return "No escuchamos nada. Tocá el micrófono y volvé a intentar.";
    case "language-not-supported":
      return "Tu navegador no puede dictar en español.";
    default:
      return GENERIC_ERROR;
  }
}

/** Adds a dictated phrase at the end of the text, never replacing what was there. */
export function appendDictation(current: string, chunk: string): string {
  const phrase = chunk.trim();
  if (!phrase) return current;
  if (!current || /\s$/.test(current)) return `${current}${phrase}`;
  return `${current} ${phrase}`;
}

type DictationSession = {
  recognition: SpeechRecognitionLike;
  /** Releases the microphone right away and drops anything still pending. */
  abort: () => void;
};

// Only one dictation at a time across the whole page: starting one cancels the other.
let activeSession: DictationSession | null = null;

type UseSpeechDictationOptions = {
  onTranscript: (chunk: string) => void;
  disabled?: boolean;
};

export function useSpeechDictation({ onTranscript, disabled = false }: UseSpeechDictationOptions) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The session still delivering results (listening, or stopping and flushing the last phrase).
  const sessionRef = useRef<DictationSession | null>(null);
  // The session the person sees as "listening"; null once they stop it.
  const listeningRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  // Read after mount: the server (and the first render) cannot know about the browser.
  useEffect(() => setSupported(isSpeechDictationSupported()), []);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;
    activeSession?.abort();

    const recognition = new Recognition();
    recognition.lang = DICTATION_LANG;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let live = true;
    const finish = () => {
      live = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      if (sessionRef.current === session) sessionRef.current = null;
      if (activeSession === session) activeSession = null;
      if (listeningRef.current === recognition) {
        listeningRef.current = null;
        setStatus((current) => (current === "error" ? "error" : "idle"));
      }
      setInterim("");
    };
    const session: DictationSession = {
      recognition,
      abort: () => {
        if (!live) return;
        finish();
        try {
          recognition.abort();
        } catch {
          // Already stopped: nothing to release.
        }
      },
    };

    recognition.onresult = (event) => {
      if (!live) return;
      let pending = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? "";
        if (result.isFinal) {
          if (transcript.trim()) onTranscriptRef.current(transcript.trim());
        } else {
          pending += transcript;
        }
      }
      if (listeningRef.current === recognition) setInterim(pending.trim());
    };
    recognition.onerror = (event) => {
      if (!live || listeningRef.current !== recognition) return;
      const message = dictationErrorMessage(event.error);
      if (!message) return;
      setError(message);
      setStatus("error");
    };
    recognition.onend = () => {
      if (live) finish();
    };

    sessionRef.current = session;
    listeningRef.current = recognition;
    activeSession = session;
    setError(null);
    setInterim("");
    setStatus("listening");
    try {
      recognition.start();
    } catch {
      setError(GENERIC_ERROR);
      setStatus("error");
      session.abort();
    }
  }, []);

  /** Stops listening but keeps the phrase the browser is still finishing. */
  const stop = useCallback(() => {
    const recognition = listeningRef.current;
    if (!recognition) return;
    listeningRef.current = null;
    setStatus("idle");
    setInterim("");
    try {
      recognition.stop();
    } catch {
      sessionRef.current?.abort();
    }
  }, []);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop();
    else start();
  }, [start, stop]);

  // Disabling the field (e.g. while the CV is being generated) releases the microphone.
  useEffect(() => {
    if (disabled) sessionRef.current?.abort();
  }, [disabled]);

  // Leaving the screen always releases the microphone.
  useEffect(() => () => sessionRef.current?.abort(), []);

  return { supported, status, interim, error, toggle, stop };
}
