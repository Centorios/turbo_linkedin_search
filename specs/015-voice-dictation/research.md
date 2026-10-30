# Research: Dictado por voz

## R1. Motor de reconocimiento

**Decision**: Web Speech API del navegador (`window.SpeechRecognition ?? window.webkitSpeechRecognition`).

**Rationale**: sin dependencias, sin claves, sin backend; soportada en Chrome, Edge y Safari (con prefijo
`webkit`). Cumple "No instalar dependencias sin consultar" (AGENTS.md).

**Alternatives considered**:
- Azure AI Speech vía FastAPI: requiere SDK, secreto nuevo, endpoint para subir audio y enmienda de la constitución.
- `MediaRecorder` + transcripción en Azure OpenAI (Whisper): mismo costo de integración, más latencia y sin resultados provisorios.

## R2. Configuración del reconocedor

**Decision**: `lang = "es-AR"`, `continuous = true`, `interimResults = true`, `maxAlternatives = 1`.

**Rationale**: `continuous` permite dictar varias frases seguidas; `interimResults` da feedback inmediato
(se muestra en el estado, no en el campo, para no pisar lo que la persona edita). Solo los resultados
`isFinal` se agregan al texto.

## R3. Cómo se agrega el texto

**Decision**: `appendDictation(current, chunk)`: recorta `chunk`; si está vacío, no cambia nada; si
`current` está vacío o termina en espacio/salto de línea, concatena directo; si no, agrega un espacio.

**Rationale**: nunca reemplaza (FR-003), y el campo sigue siendo editable durante el dictado porque el
componente no guarda una copia del texto: el padre aplica un update funcional sobre su estado actual.

## R4. Ciclo de vida y liberación del micrófono

**Decision**: una sola instancia activa a la vez (variable de módulo); `stop()` al tocar de nuevo,
`abort()` al desmontar o al pasar `disabled`. Se ignoran eventos que llegan de una instancia vieja.

**Rationale**: replica la garantía de `camera-capture.tsx` ("la cámara se apaga siempre"). Enviar el
formulario deshabilita el botón (por `isGenerating`), lo que detiene el dictado (FR-007).

## R5. Detección de soporte

**Decision**: `isSpeechDictationSupported()` comprueba el constructor; se evalúa en `useEffect` después de
montar (igual que `isCameraSupported`) para evitar diferencias de hidratación. Sin soporte, el botón no se
renderiza.

## R6. Errores

**Decision**: mapear `event.error`:

| Código | Mensaje |
|--------|---------|
| `not-allowed`, `service-not-allowed` | No diste permiso para usar el micrófono. Podés habilitarlo en la configuración del navegador o seguir escribiendo. |
| `audio-capture` | No encontramos un micrófono en este dispositivo. |
| `network` | El dictado necesita conexión a internet. Revisá tu conexión y volvé a intentar. |
| `no-speech` | No escuchamos nada. Tocá el micrófono y volvé a intentar. |
| `language-not-supported` | Tu navegador no puede dictar en español. |
| `aborted` | (sin mensaje: lo canceló la app o la persona) |
| otro | No se pudo usar el dictado por voz. |

## R7. Accesibilidad

**Decision**: `<button aria-pressed>` con nombre accesible "Dictar por voz" / "Detener dictado" (más el nombre
del campo cuando hay varios) tomado del contenido del botón, no de `aria-label`, región `role="status"` con `aria-live="polite"` para "Escuchando…" y el texto
provisorio, y `role="alert"` para errores.

## R8. Pruebas E2E

**Decision**: inyectar con `page.addInitScript` un `webkitSpeechRecognition` falso que expone
`window.__speech.emit(text, isFinal)`; Chromium headless no tiene servicio de voz real. Autenticación y
API mockeadas como en `profile-photo.spec.ts`.
