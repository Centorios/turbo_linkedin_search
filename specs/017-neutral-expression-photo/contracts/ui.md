# Contrato de UI: CameraCapture con verificación de expresión

Sin cambios de API ni de base de datos. `CameraCaptureProps` conserva `onCapture(file)` y `onClose()`; se agrega una prop opcional solo para pruebas.

```ts
type CameraCaptureProps = {
  onCapture: (file: File) => void; // JPEG 640×640, igual que hoy
  onClose: () => void;
  createAnalyzer?: () => Promise<FaceAnalyzer>; // inyectable en pruebas
};

type FaceAnalyzer = {
  analyze(video: HTMLVideoElement, timestampMs: number): FrameSample;
  close(): void;
};
```

## Comportamiento

- `onCapture` se llama solo si el veredicto es `neutral` o la verificación está `unavailable`.
- Con veredicto `rejected` no se llama a `onCapture` ni a `onClose`; la cámara sigue activa.
- Nunca hay captura sin que la persona toque "Tomar foto".
- Al desmontar: se detiene el bucle de análisis, se llama `analyzer.close()` y se apagan las pistas de la cámara.

## Elementos y `data-testid`

| `data-testid` | Elemento | Contenido |
|---------------|----------|-----------|
| `camera-expression-status` | `<p role="status" aria-live="polite">` | Mensaje del estado en vivo (ícono + texto, no solo color) |
| `camera-expression-rejection` | `<p role="alert">` | Mensaje de rechazo tras tocar "Tomar foto" (pide repetir e indica qué mejorar) |
| `camera-expression-unavailable` | `<p role="status">` | Aviso de que la expresión no se verificará |
| `camera-take-photo` | botón existente | Deshabilitado mientras la cámara no está lista o la verificación sigue cargando (`loading`); habilitado cuando hay un estado en vivo o la verificación no está disponible |

## Textos (rioplatense, voseo)

| Motivo | Mensaje en vivo / de rechazo |
|--------|------------------------------|
| `no-face` | "No te vemos. Ubicá tu rostro frente a la cámara." |
| `multiple-faces` | "Tiene que aparecer una sola persona." |
| `too-far` | "Acercate un poco a la cámara." |
| `too-close` | "Alejate un poco de la cámara." |
| `off-center` | "Centrá tu rostro en el círculo." |
| `head-turned` / `head-tilted` | "Mirá de frente y mantené la cabeza derecha." |
| `eyes-closed` | "Abrí bien los ojos." |
| `eyes-wide` | "Relajá la mirada, sin abrir tanto los ojos." |
| `mouth-open` | "Cerrá la boca." |
| `smiling` | "Relajá la sonrisa." |
| `brows-raised` / `frowning` | "Relajá las cejas." |
| `not-evaluable` | "No pudimos ver bien tu rostro. Buscá más luz y mostralo completo." |
| listo | "Listo, expresión neutra." |
| rechazo (prefijo) | "La foto no quedó neutra. Sacala de nuevo: " + mensaje del motivo |
| no disponible | "No pudimos verificar la expresión; podés tomar la foto igual." |
