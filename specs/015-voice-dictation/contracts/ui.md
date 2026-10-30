# UI Contract: Dictado por voz

## `VoiceInputField` (`frontend/app/components/voice-input-field.tsx`)

Envuelve el `<textarea>` (children) y ubica el micrófono en su esquina inferior derecha; el estado y los errores van debajo.

```ts
type VoiceInputFieldProps = {
  /** Sufijo de los data-testid y de los ids de la región de estado. */
  id: string;
  /** Recibe cada frase confirmada; el padre la agrega con appendDictation. */
  onTranscript: (chunk: string) => void;
  /** Nombre del campo, para el nombre accesible cuando hay varios micrófonos. */
  fieldLabel?: string;
  /** Deshabilita el botón y detiene un dictado activo. */
  disabled?: boolean;
  children: ReactNode; // el <textarea>
};
```

| Elemento | data-testid | Rol / nombre accesible |
|----------|-------------|------------------------|
| Botón | `voice-input-<id>` | `button`, `aria-pressed`; nombre desde el contenido: "Dictar" visible + "por voz en <fieldLabel>" solo para lectores de pantalla (sin `aria-label`, para no coincidir con `getByLabel` del campo) |
| Estado | `voice-input-status-<id>` | `status` (polite): "Escuchando…" + texto provisorio |
| Error | `voice-input-error-<id>` | `alert` |

- Sin soporte del navegador: renderiza solo el `<textarea>`.
- Al desmontar o con `disabled=true` durante el dictado: `abort()` del reconocedor.

## Integraciones

| Pantalla | id | Campo |
|----------|----|-------|
| `/generate` | `professional-text` | "Biografía o experiencia profesional" (`data-testid="professional-text"`) |
| Asistente de trayectoria | `trajectory-answer-<questionId>` | respuesta de cada pregunta |

## `frontend/app/lib/speech-dictation.ts`

```ts
export const DICTATION_LANG = "es-AR";
export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null;
export function isSpeechDictationSupported(): boolean;
export function dictationErrorMessage(code: string): string | null; // null para "aborted"
export function appendDictation(current: string, chunk: string): string;
export function useSpeechDictation(options: { onTranscript: (chunk: string) => void; disabled?: boolean }): {
  supported: boolean; status: "idle" | "listening" | "error"; interim: string; error: string | null; toggle(): void; stop(): void;
};
```
