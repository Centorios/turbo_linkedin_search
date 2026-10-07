# Tasks: Búsqueda de empleos desde un CV

**Input**: `specs/006-cv-job-search/` design artifacts.

## Phase 1: Setup

- [X] T001 Verificar contratos de CV, autenticación, repositorio, configuración y dependencias existentes en `backend/app/models/cv.py`, `backend/app/services/resume_repository.py`, `backend/pyproject.toml` y `frontend/package.json`.

## Phase 2: Foundational

- [X] T002 Definir modelos estrictos de sugerencia, solicitud, oferta y respuesta en `backend/app/models/jobs.py` y espejo TypeScript en `frontend/app/types/jobs.ts`.
- [X] T003 Agregar clave regional opcional al backend en `backend/app/core/settings.py` y `backend/.env.example`.

## Phase 3: User Story 1 - Preparar búsqueda desde un CV (P1)

**Goal**: Elegir CV propio y editar sugerencias.
**Independent Test**: CV con puesto, CV solo con skills y CV ajeno.

- [X] T004 [US1] Probar sugerencias y aislamiento en `tests/contract/test_jobs_api.py`.
- [X] T005 [US1] Derivar puesto, skills y ubicación solo del CV validado en `backend/app/services/job_search.py`.
- [X] T006 [US1] Exponer perfil de búsqueda autenticado en `backend/app/api/jobs.py` y registrar router en `backend/app/main.py`.
- [X] T007 [US1] Crear cliente autenticado y selección de CV reciente en `frontend/app/lib/jobs-client.ts` y `frontend/app/jobs/page.tsx`.

## Phase 4: User Story 2 - Buscar y revisar ofertas argentinas (P1)

**Goal**: Buscar bajo acción explícita y mostrar ofertas normalizadas.
**Independent Test**: proveedor falso devuelve duplicados, campos incompletos, vacío y fallo; UI permite reintento.

- [X] T008 [US2] Probar contrato de búsqueda, sanitización, duplicados y errores en `tests/contract/test_jobs_api.py`.
- [X] T009 [US2] Implementar cliente Jooble regional con timeout y caché temporal en `backend/app/services/jooble.py`.
- [X] T010 [US2] Autorizar CV y exponer búsqueda en `backend/app/api/jobs.py`.
- [X] T011 [US2] Mostrar formulario, resultados y estados en `frontend/app/jobs/page.tsx` y navegación en `frontend/app/components/app-header.tsx`.
- [X] T012 [US2] Verificar interacción de búsqueda y cambio de cuenta en `frontend/tests/jobs.test.tsx`.

## Phase 5: Polish

- [X] T013 Documentar configuración y limitaciones en `README.md` y `specs/006-cv-job-search/validation-results.md`; ejecutar pruebas relevantes, compilación y `git diff --check`.

## Dependencies and Execution Order

T001 → T002/T003 → T004-T007 → T008-T012 → T013. Los modelos backend y TypeScript de T002 pueden prepararse en paralelo; el trabajo actual se ejecuta secuencialmente para mantener coherencia de contratos. La primera entrega funcional requiere ambas historias: sugerir sin listar ofertas no cumple la solicitud.
