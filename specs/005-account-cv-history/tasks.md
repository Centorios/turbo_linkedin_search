# Tasks: Historial de cuenta
**Input**: `specs/005-account-cv-history/` design artifacts.

## Phase 1: Setup
- [X] T001 Verificar persistencia y herramientas existentes en backend/supabase/migrations/001_create_resumes.sql y frontend/package.json.
## Phase 2: Foundational
- [X] T002 Definir respuestas con "UUID requerido", "offset: entero, mínimo 0, máximo 100000", "limit: entero, mínimo 1, máximo 50, defecto 20" en backend/app/models/resume_history.py y frontend/app/types/resume-history.ts.
## Phase 3: User Story 1 (P1)
**Goal**: Listar CVs propios. **Independent Test**: orden, páginas, vacío y reintento.
- [X] T003 [US1] Escribir integración de persistencia y lista en tests/integration/test_resume_history.py.
- [X] T004 [US1] Agregar lista ordenada y paginada en backend/app/services/resume_repository.py.
- [X] T005 [US1] Exponer lista validada y registrar router en backend/app/api/resumes.py y backend/app/main.py.
- [X] T006 [US1] Agregar cliente con bearer y cancelación en frontend/app/lib/resume-history-client.ts.
- [X] T007 [US1] Crear lista y navegación de cuenta en frontend/app/history/page.tsx y frontend/app/components/app-header.tsx.
## Phase 4: User Story 3 (P1)
**Goal**: Aislamiento de cuenta. **Independent Test**: dos usuarios, 401 y cambio de cuenta.
- [X] T008 [US3] Probar filtros de dueño e IDs ajenos en tests/integration/test_resume_history.py.
- [X] T009 [US3] Proteger /history y descartar datos al cambiar usuario en frontend/app/auth/session-provider.tsx y frontend/app/history/page.tsx.
## Phase 5: User Story 2 (P2)
**Goal**: Abrir y descargar snapshot original. **Independent Test**: perfil modificado, plantillas y PDF.
- [X] T010 [US2] Agregar detalle filtrado y validado en backend/app/services/resume_repository.py y backend/app/api/resumes.py.
- [X] T011 [US2] Integrar preview, selector, PDF y fallback de foto en frontend/app/history/page.tsx.
- [X] T012 [US2] Verificar estados, selección rápida y cuenta en frontend/tests/resume-history.test.tsx y flujo PDF en tests/e2e/resume-history.spec.ts.
## Phase 6: Polish
- [X] T013 Documentar historial en docs/desarrollo.md y validar resultados en specs/005-account-cv-history/validation-results.md.

## Dependencies and Parallel Opportunities
T001 → T002 → US1 → US3 → US2 → T013. US3 comparte API/UI y se ejecuta secuencial. T003 y T006 serían paralelizables en archivos separados tras T002. MVP lista propia US1; entregar las tres historias con privacidad antes de publicación.
