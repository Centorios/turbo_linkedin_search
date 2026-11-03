# Tasks: Verificación de expresión neutra en la foto de cámara

**Input**: Design documents from `/specs/017-neutral-expression-photo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: Incluidas. La constitución exige pruebas de comportamiento para la UI crítica y `data-testid` estables.

**Organization**: Tareas agrupadas por historia de usuario. Solo cambia el frontend (`frontend/`); E2E en `tests/e2e/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1, US2, US3 (según spec.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencia y assets de MediaPipe (aprobados por el usuario y ya aplicados)

- [X] T001 Instalar `@mediapipe/tasks-vision` con versión exacta `1.2.0` (sin `^`) en `frontend/package.json`
- [X] T002 [P] Descargar el modelo `face_landmarker.task` (float16) a `frontend/public/mediapipe/face_landmarker.task`
- [X] T003 [P] Copiar `node_modules/@mediapipe/tasks-vision/wasm/*` a `frontend/public/mediapipe/wasm/`
- [X] T004 [P] Crear `frontend/tests/mediapipe-assets.test.ts`: falla si los archivos de `public/mediapipe/wasm/` difieren por nombre o contenido (hash) de `node_modules/@mediapipe/tasks-vision/wasm/`, con un mensaje que indique recopiarlos

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: lógica de decisión, analizador y hook que usan las tres historias

**CRÍTICO**: ninguna historia puede empezar hasta completar esta fase

- [X] T005 Crear `frontend/app/lib/expression-check.ts` con los tipos de `data-model.md` (`FrameSample`, `ExpressionIssue`, `FrameAssessment`, `ExpressionVerdict`, `LiveStatus`), el objeto `EXPRESSION_THRESHOLDS` con los valores de `research.md` R2 (sonrisa > 0.30, `jawOpen` > 0.15, boca deformada > 0.30, cejas > 0.35, ceño > 0.55, ojos cerrados > 0.50, ojos muy abiertos > 0.40, yaw > ±15°, pitch > ±12°, roll > ±10°, rostro < 25 % o > 80 % del ancho, centro a más de 20 %), `evaluateFrame(sample)` (un motivo por prioridad: sin rostro > varios rostros > encuadre/orientación > ojos cerrados > boca abierta > sonrisa > cejas), `summarizeWindow(frames)` (mediana por señal; aceptar si ≥ 4 de 5 pasan; `not-evaluable` si ≥ 2 de 5 sin rostro) y `issueMessage(issue)` con los textos de `contracts/ui.md`
- [X] T006 [P] Crear `frontend/tests/expression-check.test.ts`: umbrales en el límite (sonrisa 0.30 acepta y 0.31 rechaza), sonrisa muy leve aceptada, ventana 4/5 (un parpadeo aislado no rechaza), `not-evaluable` con ≥ 2 de 5 sin rostro, prioridad de mensajes y textos en rioplatense
- [X] T007 [P] Crear `frontend/app/lib/face-analyzer.ts`: tipo `FaceAnalyzer { analyze(video, timestampMs): FrameSample; close(): void }` y `createFaceAnalyzer()` que hace `import("@mediapipe/tasks-vision")` dinámico, `FilesetResolver.forVisionTasks("/mediapipe/wasm")`, modelo `/mediapipe/face_landmarker.task`, `runningMode: "VIDEO"`, `numFaces: 2`, `outputFaceBlendshapes` y `outputFacialTransformationMatrixes`, delegado `GPU` con reintento en `CPU`; convierte blendshapes, matriz de transformación (yaw/pitch/roll) y bbox de landmarks (`cx`, `cy`, `width` normalizados) a `FrameSample`
- [X] T008 Crear `frontend/app/lib/use-expression-check.ts` (depende de T005 y T007): hook `useExpressionCheck(videoRef, { enabled, createAnalyzer })` que carga el analizador en paralelo (con tope de 8 s → `unavailable`), analiza cada 100 ms, guarda historial circular de 5 `FrameSample`, calcula `LiveStatus` con histéresis (`ready` tras 3 válidos seguidos; salir tras 2 inválidos seguidos), expone `status`, `message` y `check()` que devuelve `ExpressionVerdict` desde la ventana, y en el cleanup detiene el bucle y llama `analyzer.close()`

**Checkpoint**: la decisión de "neutra" está implementada y probada sin UI

---

## Phase 3: User Story 1 - Guía en vivo mientras me preparo (Priority: P1) MVP

**Goal**: mostrar un indicador en vivo del estado del rostro sin capturar nunca de forma automática

**Independent Test**: abrir la cámara con un analizador falso y comprobar que `camera-expression-status` cambia según la muestra y que `onCapture` no se llama sin tocar el botón

### Tests for User Story 1

- [X] T009 [P] [US1] Agregar a `frontend/tests/camera-capture.test.tsx` un analizador falso inyectable (prop `createAnalyzer`) y escenarios: sin rostro, varios rostros, sonrisa ("Relajá la sonrisa"), orientación y "Listo, expresión neutra" tras 3 fotogramas válidos; verificar que `onCapture` y `onClose` NO se llaman sin tocar "Tomar foto" aunque el estado sea `ready` (FR-002)
- [X] T010 [P] [US1] Crear `frontend/tests/use-expression-check.test.ts`: histéresis (3 válidos para `ready`, 2 inválidos para salir) y que el cleanup llama `analyzer.close()` y detiene el bucle

### Implementation for User Story 1

- [X] T011 [US1] En `frontend/app/components/camera-capture.tsx` agregar la prop opcional `createAnalyzer`, usar `useExpressionCheck` con el `videoRef` existente y renderizar `<p role="status" aria-live="polite" data-testid="camera-expression-status">` con ícono y texto del estado (no solo color), sin tocar la lógica de captura actual
- [X] T012 [P] [US1] Agregar un ícono de estado (OK / aviso) en `frontend/app/components/icons.tsx` solo si `AlertIcon` y `SpinnerIcon` no alcanzan para el estado "Listo" (no hizo falta: se reutiliza `CheckCircleIcon`)

**Checkpoint**: el indicador en vivo funciona y nunca captura solo

---

## Phase 4: User Story 2 - Aviso al tomar una foto que no es neutra (Priority: P1)

**Goal**: al tocar "Tomar foto", aceptar solo fotos neutras; si no, descartar, explicar qué mejorar y seguir en la cámara

**Independent Test**: con un analizador falso que emite sonrisa clara, tocar "Tomar foto" y comprobar que aparece `camera-expression-rejection`, que no se llamó `onCapture` y que la cámara sigue activa

### Tests for User Story 2

- [X] T013 [P] [US2] Agregar a `frontend/tests/camera-capture.test.tsx`: foto neutra → llama `onCapture` con el JPEG 640×640 y `onClose` (como hoy); sonrisa clara → rechazo con prefijo "La foto no quedó neutra. Sacala de nuevo: " + motivo, sin `onCapture` ni `onClose`, cámara activa; rostro no evaluable → rechazo con "Buscá más luz y mostralo completo."; sonrisa muy leve → aceptada
- [X] T014 [P] [US2] Agregar a `frontend/tests/camera-capture.test.tsx`: 5 rechazos seguidos nunca ofrecen usar la foto rechazada; toques repetidos y rápidos no generan capturas ni mensajes duplicados; la foto rechazada no se muestra; el mensaje desaparece cuando el estado vuelve a `ready`

### Implementation for User Story 2

- [X] T015 [US2] En `takePhoto()` de `frontend/app/components/camera-capture.tsx` llamar a `check()` antes de dibujar el canvas: si el veredicto es `rejected`, mostrar `<p role="alert" data-testid="camera-expression-rejection">` con el mensaje de `contracts/ui.md`, no llamar `onCapture` ni `onClose` y mantener la cámara activa; si es `neutral`, seguir el flujo actual de recorte y `onCapture`
- [X] T016 [US2] En `frontend/app/components/camera-capture.tsx` evitar capturas duplicadas por toques rápidos (bloquear mientras se evalúa, sin deshabilitar visualmente el botón más de un instante) y limpiar el mensaje de rechazo al volver a `ready` o al intentar de nuevo

**Checkpoint**: US1 y US2 funcionan; el flujo completo cumple el objetivo del usuario

---

## Phase 5: User Story 3 - Alternativa cuando no se puede verificar (Priority: P2)

**Goal**: no bloquear la foto de perfil si la verificación no está disponible

**Independent Test**: inyectar un `createAnalyzer` que rechaza y comprobar el aviso, que "Tomar foto" funciona y que "Buscar" sigue intacto

### Tests for User Story 3

- [X] T017 [P] [US3] Agregar a `frontend/tests/camera-capture.test.tsx`: `createAnalyzer` rechazado o que excede 8 s → `camera-expression-unavailable` con "No pudimos verificar la expresión; podés tomar la foto igual." y "Tomar foto" entrega el JPEG; al cancelar/desmontar se apagan las pistas y se llama `analyzer.close()` (FR-013)
- [X] T018 [P] [US3] Ajustar los tests existentes de `frontend/tests/camera-capture.test.tsx` (apertura, "Tomar foto", cancelar, desmontar) para inyectar un analizador `unavailable` y que no carguen MediaPipe real (hecho con `vi.mock` de `face-analyzer` también en `basic-profile-modal.test.tsx`)

### Implementation for User Story 3

- [X] T019 [US3] En `frontend/app/components/camera-capture.tsx` renderizar `<p role="status" data-testid="camera-expression-unavailable">` cuando el estado sea `unavailable` y permitir la captura sin verificar (`check()` devuelve `neutral` en ese estado); confirmar que `frontend/app/components/basic-profile-modal.tsx` y el camino de "Buscar" no cambian

**Checkpoint**: las tres historias funcionan de forma independiente

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 Actualizar `tests/e2e/profile-photo.spec.ts`: los E2E existentes que toman foto con la cámara falsa (sin rostro) deben bloquear `**/mediapipe/**` con `page.route(...).abort()` para simular "no disponible"; agregar un escenario con el modelo real y la cámara falsa que compruebe `camera-expression-rejection` por "sin rostro" y que la cámara sigue abierta
- [X] T021 [P] Verificar `docs/desarrollo.md` (sección "Verificación de expresión neutra") contra lo implementado: nombres de archivos, ruta de constantes y pasos de actualización de WASM
- [ ] T022 Ejecutar `npm test` y `npm run test:e2e` en `frontend/` y recorrer `specs/017-neutral-expression-photo/quickstart.md` con cámara real
- [ ] T023 Calibrar `EXPRESSION_THRESHOLDS` en `frontend/app/lib/expression-check.ts` con ~20 capturas reales (SC-003: ≥ 95 % de claramente no neutras rechazadas, ≥ 90 % de claramente neutras aceptadas) y registrar los valores finales en `specs/017-neutral-expression-photo/research.md`
- [ ] T024 [P] Medir con la cámara real que el indicador reacciona en < 1 s (SC-002) y que la apertura suma ≤ 3 s (SC-007) tras la primera carga

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T003 ya aplicados; T004 es independiente
- **Foundational (Phase 2)**: T005 antes de T006 y T008; T007 independiente; T008 depende de T005 y T007
- **US1 (Phase 3)**: depende de T008; es el MVP
- **US2 (Phase 4)**: depende de US1 (T011 monta el hook en el componente)
- **US3 (Phase 5)**: depende de US1; puede ir en paralelo con US2 salvo por el mismo archivo `camera-capture.tsx`
- **Polish (Phase 6)**: después de las historias; T023 al final

### Notas de archivo compartido

T011, T015, T016 y T019 editan `frontend/app/components/camera-capture.tsx` y T009, T013, T014, T017 y T018 editan `frontend/tests/camera-capture.test.tsx`: no se paralelizan entre sí.

## Parallel Example

```text
Foundational:  T006 (tests de expression-check) ‖ T007 (face-analyzer) tras T005
US1:           T009 (tests de cámara) ‖ T010 (tests del hook) ‖ T012 (ícono)
Polish:        T021 (docs) ‖ T024 (medición)
```

## Implementation Strategy

### MVP First (US1)

1. Phase 2 completa (T005–T008)
2. US1 (T009–T012): indicador en vivo sin captura automática
3. Validar con cámara real antes de seguir

### Incremental Delivery

1. US2 entrega el objetivo central (rechazo con feedback)
2. US3 asegura que nadie quede bloqueado
3. Polish: E2E, calibración y mediciones

## Notes

- Los tests existentes de cámara (T018) y los E2E de foto (T020) se rompen si no se aísla MediaPipe: hacerlo es obligatorio, no opcional.
- No se agregan dependencias nuevas fuera de `@mediapipe/tasks-vision`.
- Las vulnerabilidades de `npm audit` previas quedan fuera de alcance por decisión del usuario.
