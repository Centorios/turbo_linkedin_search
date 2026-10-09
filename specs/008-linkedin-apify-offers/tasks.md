# Tasks: Ofertas de LinkedIn vía Apify (008)

**Input**: `specs/008-linkedin-apify-offers/` (plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md)
**Tests**: incluidos; el plan y la constitución exigen pruebas con proveedores simulados (`httpx.MockTransport`).
**Reglas**: no instalar dependencias sin consultar; no ejecutar Actors reales; secretos solo en variables de entorno.

## Formato: `- [ ] T### [P?] [US#?] Descripción con ruta`

---

## Phase 1: Setup

- [X] T001 [P] Agregar variables `APIFY_TOKEN`, `APIFY_LINKEDIN_ACTOR_ID`, `APIFY_MAX_CHARGE_USD` (0.10), `APIFY_RUN_TIMEOUT_SECONDS` (180), `APIFY_MAX_ITEMS` (20) y `APIFY_WEBHOOK_SECRET` (opcional) en `backend/app/core/settings.py` (sin valores secretos por defecto)
- [X] T002 [P] Documentar las mismas variables, sin valores reales, en `backend/.env.example`

---

## Phase 2: Foundational (bloquea todas las historias)

- [X] T003 Crear `backend/supabase/migrations/008_linkedin_source_runs.sql`: extender `job_searches` con `sources text[]` (`jooble`, `linkedin`), `status` (`in_progress | complete | incomplete`) y `updated_at`; crear `job_search_source_runs` (id uuid PK; search_id FK → job_searches on delete cascade; user_id; source `jooble`/`linkedin`; status `pending, running, succeeded, failed, timed_out`; apify_run_id único cuando no es nulo; apify_dataset_id; attempts int máx. 3; offers_count; cost_usd numeric; error_code sin detalles sensibles; started_at, finished_at) con único (search_id, source); extender `job_search_offers` con `description text`, `description_is_partial boolean`, `dedup_key text`, `sources text[]`, `alternate_urls jsonb` (`[{source,url}]`) y único (search_id, dedup_key); RLS `auth.uid() = user_id` en todo
- [X] T004 [P] Ampliar `backend/app/models/jobs.py`: enums de fuente y estados (por fuente y por búsqueda), `JobListing` con `description`, `descriptionIsPartial`, `source`, `sources[]`, `alternateUrls[]`; `sources[]` en la solicitud con default `["jooble"]`; máximo 20 ofertas por fuente, URL `https` obligatoria, descripción truncada a un límite razonable
- [X] T005 [P] Crear `backend/app/services/job_normalizer.py`: normalización común y `dedup_key` = hash de título + empresa + ubicación normalizados, más `content_hash`
- [X] T006 Extender `backend/app/services/job_search_repository.py`: CRUD de `job_search_source_runs` con transición condicional de estado, upsert de ofertas por (search_id, dedup_key) y filtrado por usuario
- [X] T007 [P] Crear fixtures y mocks compartidos (`httpx.MockTransport` para Apify y Jooble) en `tests/integration/conftest.py`

**Checkpoint**: base lista.

---

## Phase 3: US1 – Elegir fuentes y buscar con estado visible (P1) 🎯 MVP

**Meta**: buscar en Jooble, LinkedIn o ambas, ver el estado por fuente y seguir navegando.
**Prueba independiente**: elegir LinkedIn, buscar, navegar a otra pantalla y volver; el estado avanza hasta terminado con ofertas guardadas.

### Pruebas
- [X] T008 [P] [US1] Prueba de contrato de `POST /api/jobs/search`, `GET /api/jobs/search/{id}/status` y webhook en `tests/contract/test_jobs_search_sources.py`
- [X] T009 [P] [US1] Prueba de integración del proveedor con Apify simulado (start, get_run, fetch_items, abort, errores) en `tests/integration/test_apify_linkedin.py`
- [X] T010 [P] [US1] Prueba de frontend del selector de fuentes y estados por fuente en `frontend/tests/jobs.test.tsx`

### Implementación
- [X] T011 [US1] Crear `backend/app/services/apify_linkedin.py` con `start`, `get_run`, `fetch_items`, `abort`: solo HTTPS a `api.apify.com`, token por `Authorization: Bearer` sin registrarlo, errores `LinkedInSourceUnconfigured` y `LinkedInSourceError`, id de oferta `linkedin:<id>`, 20 ofertas y `maxTotalChargeUsd`
- [X] T012 [US1] Crear `backend/app/services/job_search_orchestrator.py`: inicia un run por fuente, idempotente por (search, source) y `apify_run_id`, polling perezoso que persiste el estado y los resultados
- [X] T013 [US1] Actualizar `backend/app/api/jobs.py`: `POST /search` con `sources[]`, `GET /search/{id}/status` y `POST /api/jobs/apify/webhook` con secreto; mantener Jooble intacto como valor por defecto
- [X] T014 [P] [US1] Ampliar `frontend/app/lib/jobs-client.ts` con fuentes, consulta de estado y polling acotado
- [X] T015 [US1] Actualizar `frontend/app/jobs/page.tsx`: selector de fuentes, aviso de servicio externo (FR-021), estado por fuente, navegación libre durante el procesamiento y `data-testid` (FR-020)

**Checkpoint**: US1 funcional.

---

## Phase 4: US2 – Match sobre ofertas de ambas fuentes (P1)

**Meta**: el Match usa ofertas de todas las fuentes de la búsqueda, de forma sincrónica.
**Prueba independiente**: con ofertas de ambas fuentes guardadas, ejecutar Match y obtener recomendaciones con fuente y enlace.

- [X] T016 [P] [US2] Prueba de contrato de Match (`partial`, `canRecalculate`, 404, 409 `match_in_progress`, 504 `match_timeout`) en `tests/contract/test_match_multi_source.py`
- [X] T017 [P] [US2] Prueba de integración del Match con ofertas de ambas fuentes y deadline de 75 s en `tests/integration/test_match_multi_source.py`
- [X] T018 [P] [US2] Prueba de frontend de MatchPanel (habilitación, recálculo) en `frontend/tests/match-panel.test.tsx`
- [X] T019 [US2] Actualizar `backend/app/services/match_service.py`: candidatas de todas las fuentes, reutilizando embeddings, pgvector y el modelo actuales, usando `description` completa y `content_hash` para re-embeber, deadline de 75 s
- [X] T020 [US2] Actualizar `backend/app/api/jobs.py` (Match): habilitar cuando las fuentes terminaron o fallaron, devolver `partial`, `canRecalculate`, y `source`, `url`, `alternateUrls`, `descriptionIsPartial` por recomendación
- [X] T021 [US2] Actualizar `frontend/app/jobs/MatchPanel.tsx`: mostrar fuente por recomendación, botón de recalcular y `data-testid`

---

## Phase 5: US3 – Tolerancia a fallos y descripciones parciales (P2)

**Meta**: si una fuente falla se conservan los resultados de la otra y se informa.
**Prueba independiente**: simular fallo de LinkedIn; Jooble sigue disponible y se muestra el aviso de búsqueda incompleta.

- [ ] T022 [P] [US3] Pruebas de timeout (180 s con aborto del run), reintentos con backoff, tope de 3 intentos e idempotencia en `tests/integration/test_source_failures.py`
- [ ] T023 [US3] Implementar timeout, 2 reintentos transitorios con backoff y estado `incomplete` en `backend/app/services/job_search_orchestrator.py`
- [ ] T024 [US3] Agregar `POST /api/jobs/search/{id}/sources/linkedin/retry` (máx. 3 intentos) en `backend/app/api/jobs.py`
- [ ] T025 [US3] UI en `frontend/app/jobs/page.tsx`: aviso de búsqueda incompleta, botón de reintento, marca de descripción parcial y enlace a la oferta original, con `data-testid`
- [ ] T026 [P] [US3] Prueba de frontend de fallo parcial y descripción parcial en `frontend/tests/jobs.test.tsx`

---

## Phase 6: US4 – Sin duplicados entre fuentes (P2)

**Meta**: una misma oferta no aparece dos veces.
**Prueba independiente**: dos ofertas equivalentes de fuentes distintas resultan en una con ambos enlaces.

- [ ] T027 [P] [US4] Prueba de deduplicación entre fuentes en `tests/integration/test_dedup_sources.py`
- [ ] T028 [US4] Implementar la fusión en `backend/app/services/job_normalizer.py` y el upsert en `job_search_repository.py`: conservar la descripción más larga, `sources[]` y `alternate_urls` de ambas fuentes (FR-007)

---

## Phase 7: US5 – Investigación del Actor (P1)

- [x] T029 [US5] Investigación y decisión del Actor documentadas en `specs/008-linkedin-apify-offers/research.md` (ya completada)

---

## Phase 8: Polish

- [ ] T030 [P] Documentar la integración, variables y límites de costo en `README.md` y `specs/008-linkedin-apify-offers/quickstart.md`
- [ ] T031 [P] Prueba E2E de búsqueda con ambas fuentes simuladas en `tests/e2e/`
- [ ] T032 Verificar que la búsqueda solo con Jooble sigue funcionando y que RLS aísla por usuario
- [ ] T033 Ejecutar los escenarios de `quickstart.md`

---

## Dependencias

- Setup → Foundational → US1 → US2 (US2 requiere ofertas guardadas de US1)
- US3 y US4 dependen de US1 y son independientes entre sí; US5 ya cumplida
- Polish al final

## Paralelismo

- T001/T002; T004/T005/T007; pruebas T008–T010; T016–T018

## Estrategia

- MVP: Phases 1–4 (US1 + US2). Luego US3 y US4, y finalmente Polish.
