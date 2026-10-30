import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DICTATION_LANG,
  appendDictation,
  dictationErrorMessage,
  getSpeechRecognitionConstructor,
  isSpeechDictationSupported,
  useSpeechDictation,
} from "../app/lib/speech-dictation";
import { FakeRecognition, installSpeechRecognition, removeSpeechRecognition } from "./speech-test-utils";

beforeEach(() => installSpeechRecognition());

afterEach(() => {
  cleanup();
  removeSpeechRecognition();
});

describe("appendDictation", () => {
  it.each([
    ["", "Hola", "Hola"],
    ["Trabajé en Acme.", "Lideré un equipo", "Trabajé en Acme. Lideré un equipo"],
    ["Primera línea\n", "segunda", "Primera línea\nsegunda"],
    ["Texto con espacio ", "  frase  ", "Texto con espacio frase"],
    ["Sin cambios", "   ", "Sin cambios"],
  ])("agrega %j + %j al final", (current, chunk, expected) => {
    expect(appendDictation(current, chunk)).toBe(expected);
  });
});

describe("Mensajes de error del dictado", () => {
  it.each([
    ["not-allowed", "No diste permiso para usar el micrófono"],
    ["service-not-allowed", "No diste permiso para usar el micrófono"],
    ["audio-capture", "No encontramos un micrófono"],
    ["network", "necesita conexión a internet"],
    ["no-speech", "No escuchamos nada"],
    ["language-not-supported", "no puede dictar en español"],
    ["algo-raro", "No se pudo usar el dictado por voz."],
  ])("traduce %s", (code, message) => {
    expect(dictationErrorMessage(code)).toContain(message);
  });

  it("no muestra nada cuando el dictado se canceló a propósito", () => {
    expect(dictationErrorMessage("aborted")).toBeNull();
  });
});

describe("Detección del dictado", () => {
  it("acepta la versión con y sin prefijo y la ausencia", () => {
    expect(isSpeechDictationSupported()).toBe(true);
    removeSpeechRecognition();
    expect(isSpeechDictationSupported()).toBe(false);
    expect(getSpeechRecognitionConstructor()).toBeNull();
    installSpeechRecognition(false);
    expect(getSpeechRecognitionConstructor()).toBe(FakeRecognition);
  });
});

describe("useSpeechDictation", () => {
  it("configura español de Argentina, continuo y con resultados provisorios", () => {
    const { result } = renderHook(() => useSpeechDictation({ onTranscript: vi.fn() }));
    expect(result.current.supported).toBe(true);

    act(() => result.current.toggle());

    const recognition = FakeRecognition.last;
    expect(recognition.lang).toBe(DICTATION_LANG);
    expect(recognition.lang).toBe("es-AR");
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("listening");
  });

  it("entrega solo las frases confirmadas y muestra las provisorias aparte", () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechDictation({ onTranscript }));
    act(() => result.current.toggle());

    act(() => FakeRecognition.last.emit(["trabajé cinco", false]));
    expect(onTranscript).not.toHaveBeenCalled();
    expect(result.current.interim).toBe("trabajé cinco");

    act(() => FakeRecognition.last.emit([" trabajé cinco años en Acme ", true], ["como", false]));
    expect(onTranscript).toHaveBeenCalledWith("trabajé cinco años en Acme");
    expect(result.current.interim).toBe("como");
  });

  it("al detener conserva la última frase que el navegador termina de confirmar", () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechDictation({ onTranscript }));
    act(() => result.current.toggle());
    const recognition = FakeRecognition.last;

    act(() => result.current.toggle());
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");

    act(() => recognition.emit(["última frase", true]));
    act(() => recognition.end());
    expect(onTranscript).toHaveBeenCalledWith("última frase");
    expect(result.current.status).toBe("idle");
  });

  it("muestra el error, ignora la cancelación propia y permite reintentar", () => {
    const { result } = renderHook(() => useSpeechDictation({ onTranscript: vi.fn() }));
    act(() => result.current.toggle());
    act(() => FakeRecognition.last.fail("aborted"));
    expect(result.current.error).toBeNull();

    act(() => FakeRecognition.last.fail("not-allowed"));
    act(() => FakeRecognition.last.end());
    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("No diste permiso");

    act(() => result.current.toggle());
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(result.current.status).toBe("listening");
    expect(result.current.error).toBeNull();
  });

  it("si el navegador rechaza el inicio, avisa y libera el micrófono", () => {
    installThrowingStart();
    const { result } = renderHook(() => useSpeechDictation({ onTranscript: vi.fn() }));

    act(() => result.current.toggle());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("No se pudo usar el dictado por voz.");
    expect(FakeRecognition.last.abort).toHaveBeenCalledTimes(1);
  });

  it("deshabilitar el campo y desmontar liberan el micrófono sin agregar texto", () => {
    const onTranscript = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ disabled }) => useSpeechDictation({ onTranscript, disabled }),
      { initialProps: { disabled: false } },
    );
    act(() => result.current.toggle());
    const first = FakeRecognition.last;

    rerender({ disabled: true });
    expect(first.abort).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
    act(() => first.emit(["tarde", true]));
    expect(onTranscript).not.toHaveBeenCalled();

    rerender({ disabled: false });
    act(() => result.current.toggle());
    const second = FakeRecognition.last;
    unmount();
    expect(second.abort).toHaveBeenCalledTimes(1);
  });

  it("solo hay un dictado a la vez: empezar otro detiene el anterior", () => {
    const first = renderHook(() => useSpeechDictation({ onTranscript: vi.fn() }));
    const second = renderHook(() => useSpeechDictation({ onTranscript: vi.fn() }));

    act(() => first.result.current.toggle());
    const firstRecognition = FakeRecognition.last;
    act(() => second.result.current.toggle());

    expect(firstRecognition.abort).toHaveBeenCalledTimes(1);
    expect(first.result.current.status).toBe("idle");
    expect(second.result.current.status).toBe("listening");
  });
});

function installThrowingStart() {
  class ThrowingRecognition extends FakeRecognition {
    start = vi.fn(() => {
      throw new Error("InvalidStateError");
    });
  }
  Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, writable: true, value: ThrowingRecognition });
}
