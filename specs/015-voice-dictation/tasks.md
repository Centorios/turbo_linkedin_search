# Tasks: Dictado por voz con botón de micrófono

**Input**: Design documents from `/specs/015-voice-dictation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md

**Tests**: incluidas. La constitución (principio V) exige pruebas de comportamiento para interfaces de usuario críticas y este es el campo de ingreso principal.

**Organization**: por historia de usuario.

## Phase 1: Setup

- [x] T001 Crear el directorio de la feature y `.specify/feature.json` apuntando a `specs/015-voice-dictation`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 [P] Agregar `MicrophoneIcon` decorativo (`aria-hidden`) en `frontend/app/components/icons.tsx`
- [x] T003 Implementar `DICTATION_LANG = "es-AR"`, `getSpeechRecognitionConstructor`, `isSpeechDictationSupported`, `dictationErrorMessage` (tabla de research.md R6; `null` para `aborted`) y `appendDictation` (research.md R3) en `frontend/app/lib/speech-dictation.ts`
- [x] T004 Implementar `useSpeechDictation` en `frontend/app/lib/speech-dictation.ts`: `continuous`, `interimResults`, una sola instancia activa, solo `isFinal` llega a `onTranscript`, `interim` se vacía al confirmar/terminar, `abort()` al desmontar y con `disabled`, ignora eventos de instancias viejas (data-model.md)
- [x] T005 Implementar `VoiceInputField` en `frontend/app/components/voice-input-field.tsx` según contracts/ui.md (no renderiza sin soporte; `aria-pressed`; `data-testid` `voice-input-<id>`, `voice-input-status-<id>`, `voice-input-error-<id>`)
- [x] T006 [P] Agregar el estilo de "escuchando" (anillo pulsante que respeta `prefers-reduced-motion`) en `frontend/app/globals.css`
- [x] T007 [P] Pruebas unitarias de `appendDictation`, `dictationErrorMessage`, detección y del hook en `frontend/tests/speech-dictation.test.ts`
- [x] T008 [P] Pruebas de comportamiento de `VoiceInputField` (iniciar/detener, frases finales vs provisorias, errores, `disabled`, desmontaje, sin soporte) en `frontend/tests/voice-input-field.test.tsx`

**Checkpoint**: el botón funciona aislado.

---

## Phase 3: User Story 1 - Dictar la experiencia profesional (Priority: P1) 🎯 MVP

**Goal**: micrófono en "Biografía o experiencia profesional".

**Independent Test**: en `/generate`, dictar y ver el texto agregado al final; "Generar CV" detiene el dictado.

- [x] T009 [US1] Integrar `VoiceInputField` (`id="professional-text"`) junto a la etiqueta del campo en `frontend/app/generate/page.tsx`; agregar con `appendDictation` mediante update funcional que también reinicia la revisión del asistente (FR-009); `disabled={isGenerating}` (FR-007)
- [x] T010 [US1] E2E: dictado agrega al final, se detiene al tocar de nuevo y al generar; error de permiso; sin soporte no hay botón, en `tests/e2e/voice-dictation.spec.ts`

**Checkpoint**: US1 completa y verificable sola.

---

## Phase 4: User Story 2 - Responder por voz al asistente (Priority: P2)

**Goal**: micrófono por respuesta en el asistente de trayectoria.

**Independent Test**: abrir el asistente con preguntas mockeadas, dictar en una respuesta y ver el texto solo ahí.

- [x] T011 [US2] Integrar `VoiceInputField` (`id="trajectory-answer-<questionId>"`, `fieldLabel` con el texto de la pregunta) en cada respuesta de `frontend/app/components/trajectory-assistant.tsx`, con update funcional por `question.id`; desmontar al enviar/cerrar libera el micrófono
- [x] T012 [US2] E2E: dictar en una respuesta del asistente en `tests/e2e/voice-dictation.spec.ts`

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T013 [P] Documentar "Dictado por voz" (navegadores, permiso, privacidad, pruebas) en `docs/desarrollo.md`
- [x] T014 Ejecutar `npx tsc --noEmit`, `npm test -- --run` y las E2E de la feature; revisar textos con voseo y sin inglés a la vista

## Dependencies & Execution Order

- Setup → Foundational (T003 → T004 → T005; T002, T006, T007, T008 en paralelo) → US1 y US2 (independientes entre sí) → Polish.
- MVP sugerido: Phases 1–3.

## Parallel Opportunities

- T002, T006, T007, T008 tocan archivos distintos.
- US1 (T009) y US2 (T011) tocan archivos distintos y pueden hacerse en paralelo.
