# Research: Verificación de expresión neutra

## R1. Librería de detección

- **Decision**: `@mediapipe/tasks-vision` (Face Landmarker) con `outputFaceBlendshapes` y `outputFacialTransformationMatrixes`, `runningMode: "VIDEO"`, `numFaces: 2`.
- **Rationale**: Pedida por el usuario; da 52 blendshapes (0–1) y pose de cabeza en un solo modelo local; Apache-2.0; sin backend.
- **Alternatives considered**: `@vladmandic/face-api` (descartada por el usuario, menos precisa); servicios en la nube (envían imágenes a terceros).

## R2. Valores de decisión (valores iniciales recomendados)

Constantes en un único objeto `EXPRESSION_THRESHOLDS`, a calibrar con fotos reales.

| Señal | Cálculo | Se rechaza si |
|-------|---------|---------------|
| Sonrisa | promedio `mouthSmileLeft/Right` | > 0.30 |
| Boca abierta | `jawOpen` | > 0.25 |
| Boca deformada | máx(`mouthFunnel`, `mouthPucker`) | > 0.45 |
| Cejas levantadas | máx(`browInnerUp`, prom. `browOuterUpLeft/Right`) | > 0.35 |
| Ceño | prom. `browDownLeft/Right` | > 0.35 |
| Ojos cerrados | prom. `eyeBlinkLeft/Right` | > 0.50 |
| Ojos muy abiertos | prom. `eyeWideLeft/Right` | > 0.40 |
| Giro (yaw) | matriz de transformación | > ±12° |
| Inclinación (pitch) | matriz de transformación | > ±10° |
| Ladeo (roll) | matriz de transformación | > ±8° |
| Tamaño del rostro | ancho del bbox de landmarks / ancho del cuadro | < 25 % o > 80 % |
| Centrado | centro del bbox vs. centro del cuadro | > 20 % |
| Rostros | `faceLandmarks.length` | 0 o ≥ 2 |

- **Rationale**: 0.30 deja pasar la sonrisa muy leve (clarificación Q2) y rechaza la clara; ángulos de 10–15° son tolerantes.
- **Calibración**: ~20 fotos (neutras, sonrisa leve/amplia, boca abierta, ojos cerrados) con distintas personas y luces; objetivo SC-003.

## R3. Ventana de fotogramas e histéresis

- **Decision**: análisis cada 100 ms; historial circular de 5 fotogramas (~500 ms). Veredicto al tocar el botón: aceptación si ≥ 4/5 fotogramas pasan (con menos fotogramas, el 80 % redondeado hacia arriba); si se rechaza, se informa el motivo más frecuente (empate: el de mayor prioridad); si ≥ 2/5 no tienen rostro → "no evaluable" (rechazo, clarificación Q3). Indicador en vivo: "Listo" tras 3 válidos seguidos; sale tras 2 inválidos seguidos.
- **Rationale**: tolera un parpadeo aislado (FR-011) y evita parpadeo del mensaje en vivo.
- **Alternatives considered**: evaluar solo el fotograma del toque (sensible a parpadeos); esperar 500 ms después del toque (la captura se siente lenta y la persona puede moverse).
- **Prioridad del mensaje**: sin rostro > varios rostros > encuadre/orientación > ojos cerrados > boca abierta > sonrisa > cejas.

## R4. Carga y servicio de assets

- **Decision**: `import("@mediapipe/tasks-vision")` dinámico dentro del cargador, solo al abrir la cámara y en paralelo al permiso de cámara. Modelo `face_landmarker.task` y WASM versionados en `frontend/public/mediapipe/` (los WASM en `wasm/`, copiados una vez desde `node_modules/@mediapipe/tasks-vision/wasm/`). Dependencia con versión exacta para que los WASM no se desfasen; al actualizarla hay que recopiar los WASM. La prueba `tests/mediapipe-assets.test.ts` compara los archivos de `public/mediapipe/wasm/` con los de `node_modules/@mediapipe/tasks-vision/wasm/` y falla si no coinciden, para no depender de acordarse. Delegado `GPU` con reintento en `CPU` si falla.
- **Rationale**: evita SSR y bundle inicial pesado; same-origin cumple FR-008; sin CDN externo.
- **Alternatives considered**: CDN de jsDelivr/Google Storage (video sigue local, pero depende de terceros y falla offline); script `postinstall` que copia los WASM (repo más liviano, pero falla con `--ignore-scripts` y agrega un paso oculto).

## R5. Degradación y fallos

- **Decision**: si la carga falla o excede 8 s, el hook queda en `unavailable`: aviso "No pudimos verificar la expresión; podés tomar la foto igual" y la captura funciona como hoy (FR-009). "Buscar" nunca pasa por la verificación (FR-010).
- **Rationale**: la verificación es una guía, no una barrera cuando no existe.

## R6. Estrategia de pruebas

- **Decision**: el hook recibe un analizador inyectable (`createAnalyzer`) con valor por defecto real. Vitest usa un analizador falso que emite muestras controladas; `expression-check.ts` se prueba como funciones puras. E2E con `--use-fake-device-for-media-stream` cubre la ruta real "sin rostro" (la cámara falsa no tiene rostro).
- **Rationale**: la cámara real y el modelo no son determinísticos en CI.

## R7. Instalación y aprobación

- Dependencia: `@mediapipe/tasks-vision` `1.2.0` (versión exacta, sin `^`) en `dependencies`.
- Modelo: descargar `face_landmarker.task` (float16) desde el repositorio oficial de MediaPipe a `frontend/public/mediapipe/`.
- WASM: copiar los archivos de `node_modules/@mediapipe/tasks-vision/wasm/` a `frontend/public/mediapipe/wasm/` y versionarlos (sin script).
- AGENTS.md exige consulta previa: **no se instala nada hasta tener aprobación** (ver resumen del plan).
