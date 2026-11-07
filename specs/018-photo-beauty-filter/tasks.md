# Tasks: Filtro de belleza para foto de perfil

**Input**: Documentos de diseño en `/specs/018-photo-beauty-filter/`

**Prerequisitos**: `plan.md`, `spec.md`, `research.md`, `data-model.md` y `contracts/photo-selection-ui.md`.

**Pruebas**: Incluidas porque la constitución del proyecto exige pruebas de comportamiento para interfaces críticas.

**Organización**: Tareas agrupadas por historia de usuario para entregar y validar cada incremento de forma independiente.

## Phase 1: Setup

**Propósito**: Preparación de proyecto.

El frontend, las dependencias, MediaPipe y los recursos locales ya existen; no se requieren tareas de setup ni cambios de dependencias.

---

## Phase 2: Foundational

**Propósito**: Prerrequisitos compartidos que bloquean las historias.

No se requieren cambios fundacionales de backend, almacenamiento, APIs ni configuración compartida. Las capacidades específicas de procesamiento y revisión pertenecen a US1.

---

## Phase 3: User Story 1 - Comparar y elegir la foto embellecida (Priority: P1) 🎯 MVP

**Goal**: Después de tomar una foto, mostrar la original y una versión con suavizado sutil de piel, para que el usuario elija cuál continúa al flujo actual del perfil.

**Independent Test**: Capturar una foto, distinguir la original de la embellecida y confirmar cada alternativa en ejecuciones separadas; simular la falta de rostro, landmarks o soporte y verificar que la original sigue siendo seleccionable con un aviso.

### Tests for User Story 1

- [X] T001 [P] [US1] Agregar pruebas unitarias de `frontend/app/lib/skin-smoothing.ts` en `frontend/tests/skin-smoothing.test.ts` para verificar el uso de una máscara facial y la preservación de la imagen fuente.
- [X] T002 [P] [US1] Agregar pruebas de `CameraCapture` en `frontend/tests/camera-capture.test.tsx` para comparar versiones, identificar cada alternativa y comprobar que el callback recibe únicamente la versión confirmada.
- [X] T003 [US1] Agregar una prueba de integración en `frontend/tests/basic-profile-modal.test.tsx` que confirme que la vista previa del perfil y el archivo seleccionado corresponden a la alternativa elegida.

### Implementation for User Story 1

- [X] T004 [US1] Crear `frontend/app/lib/skin-smoothing.ts` para generar en Canvas 2D una versión JPEG con suavizado fijo y sutil dentro de la máscara facial, excluyendo ojos, cejas y boca, sin alterar la imagen original.
- [X] T005 [US1] Extender `frontend/app/lib/face-analyzer.ts` para obtener landmarks válidos de la imagen cuadrada capturada en el dispositivo usando el modelo y los recursos locales existentes; informar ausencia de un único rostro o de landmarks requeridos sin enviar la foto a un servicio.
- [X] T006 [US1] Extender `frontend/app/components/camera-capture.tsx` con los estados de procesamiento y comparación, etiquetas accesibles «Original» y «Embellecida», selección explícita de ambas versiones y fallback con aviso que permita elegir la original cuando el análisis, el Canvas o el filtro no estén disponibles.
- [X] T007 [US1] Integrar la confirmación de la foto elegida con el callback consumido por `frontend/app/components/basic-profile-modal.tsx`, asegurando que solo esa alternativa entra a la vista previa y al flujo existente de guardado.

**Checkpoint**: US1 funciona de forma independiente; se puede elegir cualquiera de las versiones y los fallos de procesamiento no bloquean la foto original.

---

## Phase 4: User Story 2 - Conservar el control de la captura (Priority: P2)

**Goal**: Permitir cancelar la revisión o repetir la captura sin confirmar ni conservar una versión pendiente.

**Independent Test**: Desde la comparación disponible o el fallback de solo original, cancelar o elegir «Tomar otra»; verificar que no se confirma ninguna imagen pendiente, la cámara se libera o vuelve a abrir según corresponda y las vistas temporales se descartan.

### Tests for User Story 2

- [X] T008 [US2] Agregar pruebas en `frontend/tests/camera-capture.test.tsx` para cancelar, repetir la captura desde comparación y fallback, descartar selecciones pendientes y liberar las URLs temporales y pistas de cámara.

### Implementation for User Story 2

- [X] T009 [US2] Implementar en `frontend/app/components/camera-capture.tsx` las acciones de cancelar y «Tomar otra», reiniciar la cámara al repetir y limpiar archivos, URLs temporales y pistas de cámara al cancelar, repetir, confirmar o desmontar.

**Checkpoint**: US2 puede cancelarse o repetirse sin que una selección anterior llegue al perfil.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validación transversal, accesibilidad, compatibilidad y cierre de documentación.

- [X] T010 Ejecutar las pruebas focalizadas y la validación de build del frontend descritas en `specs/018-photo-beauty-filter/quickstart.md`, ajustar el flujo si falla alguna comprobación y registrar el resultado verificado allí.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tiene dependencias; no requiere cambios en esta feature.
- **Foundational (Phase 2)**: No tiene tareas; no hay prerrequisitos compartidos adicionales.
- **User Stories (Phase 3+)**: US1 puede comenzar inmediatamente; US2 depende de que US1 haya creado el flujo de revisión de la foto.
- **Polish (Phase 5)**: Depende de US1 y US2.

### User Story Dependencies

- **US1 (P1)**: Sin dependencias con otras historias; entrega el flujo MVP de procesamiento local, comparación y elección.
- **US2 (P2)**: Depende de US1 porque el flujo de cancelar o repetir actúa sobre sus estados de revisión y sus recursos temporales.

### Within Each User Story

- Las pruebas de cada comportamiento se escriben antes de su implementación y deben fallar por la capacidad aún no implementada.
- Dentro de US1, T004 y T005 habilitan T006; T007 verifica el límite con el perfil una vez integrado T006.
- US2 se inicia después del checkpoint de US1; T008 precede a T009.
- T010 se ejecuta después de las dos historias.

### Parallel Opportunities

- **US1**: T001 y T002 se pueden preparar en paralelo porque cubren archivos de prueba distintos y no dependen de la implementación.
- **US1**: Tras fijar el contrato del helper, T004 y T005 pueden implementarse en paralelo porque modifican `skin-smoothing.ts` y `face-analyzer.ts`, respectivamente; T006 integra ambos.
- **US2**: T008 es una tarea de prueba previa a T009; no hay trabajo de implementación independiente dentro de esta historia.
- US1 y US2 no se deben paralelizar porque US2 depende del flujo de revisión de US1.

## Implementation Strategy

### MVP First (US1 Only)

1. Completar T001 y T002 y comprobar que las nuevas pruebas fallan por las capacidades aún no implementadas.
2. Implementar T004 y T005, y luego integrar la comparación y selección con T006 y T007.
3. **STOP AND VALIDATE**: ejecutar el test focalizado de cámara y la prueba de integración del perfil.
4. Se puede demostrar el MVP si se muestran ambas versiones y el usuario confirma explícitamente cuál usar; los fallos preservan el original.

### Incremental Delivery

1. Entregar US1 como comparación y selección utilizable.
2. Agregar US2 para cancelar o tomar otra foto limpiando por completo los recursos temporales.
3. Ejecutar T010 para validar el flujo completo y actualizar la guía con el resultado real.

## Notes

- `[P]` identifica tareas independientes, en archivos distintos y sin dependencia de tareas incompletas.
- `[US1]` y `[US2]` enlazan cada tarea con la historia correspondiente de `spec.md`.
- Las alternativas de imagen son temporales; no agregan persistencia ni llamadas al backend.
- La validación visual del carácter «sutil» requiere revisión en dispositivos móviles y de escritorio; los mocks de Canvas no verifican calidad píxel a píxel.
