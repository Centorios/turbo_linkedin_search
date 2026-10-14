# Tasks: Eliminar CVs del historial de la cuenta

**Input**: Artefactos de diseño en `specs/009-delete-cv-history/`.

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md` y `contracts/`.

**Organization**: Tareas por historia de usuario. Las pruebas se escriben antes de los cambios de implementación.

## Phase 1: Setup

**Purpose**: Confirmar que se reutilizan la autenticación, persistencia y pruebas existentes.

- [X] T001 Verificar el contrato actual de historial, las claves foráneas en cascada y los comandos de prueba en `backend/app/api/resumes.py`, `backend/app/services/resume_repository.py`, `backend/supabase/migrations/005_job_searches.sql`, `backend/supabase/migrations/006_match_results.sql`, `tests/integration/test_resume_history.py` y `frontend/tests/resume-history.test.tsx`.

## Phase 2: Foundational

**Purpose**: No se requieren cambios fundacionales: el backend ya valida la sesión, el historial ya filtra CVs por propietario y las relaciones dependientes ya tienen cascada.

**Checkpoint**: Comenzar las historias después de verificar T001; no agregar dependencias ni migraciones.

## Phase 3: User Story 1 - Eliminar una versión propia (Priority: P1) 🎯 MVP

**Goal**: Confirmar y eliminar de forma permanente un CV propio desde el historial, actualizando la página y cerrando su vista previa si estaba abierta.

**Independent Test**: Cancelar una eliminación sin cambios; confirmar otra y comprobar respuesta exitosa, ausencia posterior del CV en lista/detalle y conservación de los demás CVs.

### Tests for User Story 1

- [X] T002 [P] [US1] Agregar pruebas de integración de `DELETE /api/resumes/{resume_id}` para éxito `204`, respuesta vacía y ausencia posterior en lista/detalle en `tests/integration/test_resume_history.py`.
- [X] T003 [P] [US1] Agregar pruebas de historial para confirmar, cancelar, borrar un CV abierto y conservar los CVs restantes en `frontend/tests/resume-history.test.tsx`.

### Implementation for User Story 1

- [X] T004 [US1] Implementar borrado por `user_id` autenticado e ID, y exponer `DELETE /api/resumes/{resume_id}` con `204`, `404` indistinguible y error seguro en `backend/app/services/resume_repository.py` y `backend/app/api/resumes.py`.
- [X] T005 [US1] Agregar la petición autenticada de borrado y manejo de respuesta `204 No Content` en `frontend/app/lib/resume-history-client.ts`.
- [X] T006 [US1] Agregar acción por elemento y confirmación que identifique el CV e informe del borrado permanente de búsquedas/resultados asociados; retirar el elemento solo tras éxito, cerrar su detalle y ajustar la paginación en `frontend/app/history/page.tsx`.

**Checkpoint**: Una persona puede cancelar o confirmar el borrado de un CV propio sin perder otros documentos.

## Phase 4: User Story 2 - Proteger la propiedad y los datos relacionados (Priority: P1)

**Goal**: Evitar que una cuenta borre o confirme la existencia de CVs ajenos y comprobar que la cascada elimina únicamente datos dependientes del CV seleccionado.

**Independent Test**: Con dos cuentas, eliminar desde una cuenta un ID ajeno o inexistente; ambos deben producir el mismo resultado sin cambios en datos ajenos. Eliminar un CV propio no debe afectar otros CVs ni sus detalles.

### Tests for User Story 2

- [X] T007 [P] [US2] Probar ausencia de sesión, ID ajeno, ID inexistente, igualdad de respuestas y conservación de datos de otros usuarios en `tests/integration/test_resume_history.py`.
- [X] T008 [P] [US2] Probar que los datos de la cuenta anterior desaparecen al cambiar de sesión y que una eliminación tardía no modifica la vista de la cuenta nueva en `frontend/tests/resume-history.test.tsx`.

### Implementation for User Story 2

- [X] T009 [US2] Asociar la petición de eliminación a la cuenta que la inició y descartar su respuesta al cambiar/cerrar sesión, sin aplicarla a la cuenta nueva, en `frontend/app/lib/resume-history-client.ts` y `frontend/app/history/page.tsx`.

**Checkpoint**: Los casos de dos cuentas y los registros dependientes cumplen el contrato sin revelar CVs ajenos.

## Phase 5: User Story 3 - Recuperarse de un fallo (Priority: P2)

**Goal**: Mantener el CV cuando el borrado falla, informar el error y permitir reintentar sin duplicar solicitudes concurrentes.

**Independent Test**: Simular fallo de red o persistencia y comprobar que el CV permanece visible; reintentar y comprobar que desaparece al completarse.

### Tests for User Story 3

- [X] T010 [P] [US3] Agregar pruebas de fallo de borrado, estado pendiente, reintento y prevención de solicitudes repetidas en `frontend/tests/resume-history.test.tsx`.
- [X] T011 [P] [US3] Agregar prueba de que el error de persistencia no expone datos privados y no se presenta como borrado exitoso en `tests/integration/test_resume_history.py`.

### Implementation for User Story 3

- [X] T012 [US3] Implementar estado pendiente/error, conservar el CV ante fallo, permitir reintento y evitar clics repetidos en `frontend/app/history/page.tsx`.
- [X] T013 [US3] Traducir fallos de persistencia a un error genérico y registrar solo el tipo de excepción en `backend/app/api/resumes.py`.

**Checkpoint**: Los errores son visibles, seguros y recuperables, sin retirar contenido que siga persistido.

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 Actualizar la guía de desarrollo con el flujo de eliminación y sus límites en `docs/desarrollo.md`.
- [X] T015 Ejecutar pruebas de integración y UI, `tsc --noEmit` y `git diff --check`; registrar resultados en `specs/009-delete-cv-history/validation-results.md`.

## Dependencies and Execution Order

T001 → T002/T003 → T004 → T005 → T006 → T007/T008 → T009 → T010/T011 → T012/T013 → T014 → T015.

- T002 y T003 pueden desarrollarse en paralelo porque modifican suites distintas; ambos deben preceder a su implementación.
- T007 y T008 pueden desarrollarse en paralelo una vez que el flujo básico de US1 existe.
- T010 y T011 pueden desarrollarse en paralelo antes de la corrección de errores de US3.
- Las tareas que tocan `frontend/app/history/page.tsx` o `tests/integration/test_resume_history.py` se mantienen secuenciales dentro de su fase.

## Implementation Strategy

1. Verificar la persistencia actual y escribir pruebas de la ruta y de la interacción de confirmación.
2. Entregar un flujo mínimo completo para eliminar un CV propio con autorización obligatoria.
3. Validar explícitamente los casos ajenos/inexistentes, las dependencias en cascada y el cambio de cuenta.
4. Cubrir fallos y reintentos, luego actualizar documentación y ejecutar validación final.

**Suggested MVP**: User Story 1, incluyendo siempre autorización del propietario y pruebas backend/frontend asociadas. US2 y US3 completan la privacidad, consistencia y recuperación antes de considerar la feature terminada.
