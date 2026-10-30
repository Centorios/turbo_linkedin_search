import { vi } from "vitest";
import type {
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionLike,
  SpeechRecognitionResultEventLike,
} from "../app/lib/speech-dictation";

// Stand-in for the browser's SpeechRecognition: tests drive it with emit/fail/end.
export class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }

  static get last(): FakeRecognition {
    return FakeRecognition.instances[FakeRecognition.instances.length - 1];
  }

  /** Sends results; each entry is [transcript, isFinal]. */
  emit(...results: Array<[string, boolean]>) {
    const list = results.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal }));
    this.onresult?.({ resultIndex: 0, results: list });
  }

  fail(error: string) {
    this.onerror?.({ error });
  }

  end() {
    this.onend?.();
  }
}

export function installSpeechRecognition(prefixed = true) {
  FakeRecognition.instances = [];
  const key = prefixed ? "webkitSpeechRecognition" : "SpeechRecognition";
  Object.defineProperty(window, key, { configurable: true, writable: true, value: FakeRecognition });
}

export function removeSpeechRecognition() {
  Reflect.deleteProperty(window, "webkitSpeechRecognition");
  Reflect.deleteProperty(window, "SpeechRecognition");
}
