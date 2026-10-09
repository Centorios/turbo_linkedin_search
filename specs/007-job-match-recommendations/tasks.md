# Tasks: Match de empleos con recomendaciones

**Input**: `specs/007-job-match-recommendations/` (plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md)
**DiseÃ±o**: sincrÃ³nico, sin cola ni worker. Sin dependencias nuevas (no instalar nada sin consultar).
**Tests**: incluidos (el plan exige integraciÃ³n + UI con `data-testid`).

Formato: `- [ ] Txxx [P?] [US?] DescripciÃ³n con ruta`. `[P]` = paralelizable (archivos distintos, sin dependencias pendientes).

## Phase 1: Setup

- [X] T001 Verificar que `backend/app/core/settings.py`, `backend/.env.example` y `render.yaml` ya contienen `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` y `AZURE_OPENAI_EMBEDDING_DIMENSIONS` (hecho); agregar a `settings.py` los timeouts `match_deadline_seconds=75`, `match_embeddings_timeout_seconds=20`, `match_llm_timeout_seconds=45`, `match_candidates_k=8` y documentarlos en `backend/.env.example`
- [X] T002 [P] Crear `backend/supabase/migrations/004_enable_pgvector.sql` con `create extension if not exists vector;`

## Phase 2: Foundational (bloquea todas las historias)

- [X] T003 Crear `backend/supabase/migrations/005_job_searches.sql`: tablas `job_searches` (`id uuid pk`, `user_id â†’ auth.users on delete cascade`, `resume_id â†’ resumes(id) on delete cascade`, `keywords`, `location`, `created_at`) y `job_search_offers` (`id uuid pk`, `search_id â†’ job_searches on delete cascade`, `user_id`, `position int`, `external_id`, `title`, `company`, `location`, `snippet`, `url`, `source`, `source_updated_at`, `content_hash`, `embedding vector(1536) null`; Ãºnico (`search_id`,`external_id`)); RLS `auth.uid() = user_id` en ambas
- [X] T004 Crear `backend/supabase/migrations/006_match_results.sql`: `resume_embeddings` (`resume_id pk â†’ resumes on delete cascade`, `user_id`, `content_hash`, `model`, `embedding vector(1536)`, `updated_at`), `match_results` (`id uuid pk`, `user_id`, `search_id â†’ job_searches on delete cascade`, `resume_id â†’ resumes on delete cascade`, `resume_content_hash`, `created_at`; Ãºnico (`search_id`,`resume_id`)) y `match_recommendations` (`result_id â†’ match_results on delete cascade`, `user_id`, `rank 1..3`, `offer_id â†’ job_search_offers`, `affinity` check (`Alta`|`Media`), `summary`, `matches jsonb`, `unmet_requirements jsonb`, `missing_info jsonb`; pk (`result_id`,`rank`)); RLS por usuario
- [X] T005 Crear `backend/supabase/migrations/007_match_functions.sql`: `match_candidates(p_search_id, p_resume_id, p_k)` (top K por coseno, filtrado por usuario), `save_match_result(...)` (transacciÃ³n: upsert de `match_results` + reemplazo de recomendaciones; valida que `offer_id` pertenezca a `search_id`) y `try_lock_match(p_search_id, p_resume_id)` (advisory lock para 409)
- [X] T006 [P] Crear `backend/app/models/match.py` con `StrictModel`: `LlmRecommendation` (`offerId`, `affinity` Literal `Alta|Media`, `summary`, `matches`, `unmetRequirements`, `missingInfo`), `LlmMatchOutput` (mÃ¡x. 3, sin campos extra, rechaza porcentajes/probabilidad de contrataciÃ³n), `MatchRequest` (`searchId`, `resumeId`, `recalculate=false`), `Recommendation`, `MatchResult` (`resumeChanged`, `completedAt`, `recommendations` 0â€“3) segÃºn `contracts/match-api.md`
- [X] T007 [P] Modificar `backend/app/models/jobs.py`: agregar `searchId: str | None` a la respuesta de bÃºsqueda (cambio aditivo)
- [X] T008 [P] Crear `backend/app/services/job_search_repository.py`: guardar bÃºsqueda + ofertas (con `content_hash`), leer bÃºsqueda del usuario (404 uniforme si es ajena), actualizar embeddings de ofertas
- [X] T009 [P] Crear `backend/app/services/match_repository.py`: leer/guardar `resume_embeddings`, llamar RPC `match_candidates`, `save_match_result`, `try_lock_match`, leer resultado guardado y calcular `resumeChanged`
- [X] T010 Modificar `backend/app/services/azure_openai.py`: agregar `embed_texts(list[str])` en una Ãºnica llamada en lote con el deployment `azure_openai_embedding_deployment` y `dimensions=azure_openai_embedding_dimensions`; agregar `analyze_match(resume, offers)` con el modelo de chat de CVs, tratando el contenido de ofertas como datos (FR-020) y devolviendo JSON validado con `LlmMatchOutput`

**Checkpoint**: esquema, modelos y servicios base listos.

## Phase 3: User Story 1 - Pedir recomendaciones sobre una bÃºsqueda (P1) ðŸŽ¯ MVP

**Objetivo**: botÃ³n Match que, sin nueva bÃºsqueda, devuelve hasta 3 recomendaciones del CV y ofertas de esa bÃºsqueda.
**Prueba independiente**: tras una bÃºsqueda con resultados, pulsar Match muestra hasta 3 recomendaciones sin invocar Jooble de nuevo.

### Tests US1

- [X] T011 [P] [US1] Test de contrato `tests/contract/test_match_api.py`: `POST /api/jobs/match` 200/404/409/422, `searchId` en `POST /api/jobs/search`, auth requerida
- [X] T012 [P] [US1] Test de integraciÃ³n `tests/integration/test_match_flow.py` con proveedores falsos: reutilizaciÃ³n de embeddings por hash, un solo lote para faltantes, no se llama a Jooble, salida con `offerId` ajeno rechazada, 0 recomendaciones aceptable

### ImplementaciÃ³n US1

- [X] T013 [US1] Crear `backend/app/services/match_service.py`: orquesta (lock â†’ embeddings en lote reutilizando existentes â†’ `match_candidates` K=8 â†’ `analyze_match` â†’ validar â†’ `save_match_result`) bajo `asyncio.timeout(match_deadline_seconds)`
- [X] T014 [US1] Modificar `backend/app/api/jobs.py`: persistir bÃºsqueda y devolver `searchId` en `POST /api/jobs/search` (fallo de persistencia no rompe la bÃºsqueda); agregar `POST /api/jobs/match`
- [X] T015 [P] [US1] Crear `frontend/app/types/match.ts` y `frontend/app/lib/match-client.ts` (peticiÃ³n Ãºnica con `AbortController` 85 s)
- [X] T016 [US1] Crear `frontend/app/jobs/MatchPanel.tsx` con `match-button`, `match-description` (texto exacto de FR-001) y tarjetas `match-recommendation-{rank}`; integrar en `frontend/app/jobs/page.tsx` sin cambiar la bÃºsqueda actual

## Phase 4: User Story 2 - Entender por quÃ© encaja y quÃ© falta (P1)

**Objetivo**: cada recomendaciÃ³n explica coincidencias, requisitos no acreditados e informaciÃ³n faltante; afinidad cualitativa.
**Prueba independiente**: una recomendaciÃ³n muestra Alta/Media, coincidencias, `unmetRequirements` y `missingInfo`, sin porcentajes.

- [X] T017 [P] [US2] Test de integraciÃ³n `tests/integration/test_match_analysis.py`: prompt sin inventar experiencia, afinidad baja nunca persistida, ordenaciÃ³n por afinidad, rechazo de porcentajes/probabilidad
- [X] T018 [US2] Ajustar el prompt y la validaciÃ³n en `backend/app/services/azure_openai.py` y `backend/app/models/match.py` para FR-007â€“FR-011 (indicar explÃ­citamente informaciÃ³n faltante)
- [X] T019 [US2] Mostrar en `frontend/app/jobs/MatchPanel.tsx` coincidencias, requisitos no acreditados, informaciÃ³n faltante y `match-affinity-{rank}`; `match-empty` para 0 recomendaciones

## Phase 5: User Story 3 - Estado de carga, timeouts y errores (P2)

**Objetivo**: UI utilizable durante el anÃ¡lisis; timeouts y errores comprensibles con reintento.
**Prueba independiente**: simular lentitud/error y verificar "Analizandoâ€¦", mensaje claro y "Reintentar" conservando el resultado previo.

- [X] T020 [P] [US3] Test de integraciÃ³n `tests/integration/test_match_errors.py`: 504 `match_timeout` (embeddings ya guardados se conservan), 502/503 `match_unavailable`, 409 `match_in_progress`, resultado previo conservado, logs sin datos personales
- [X] T021 [US3] Implementar en `backend/app/api/jobs.py` y `match_service.py` el mapeo de errores a 409/502/503/504 con `{"detail":{"code","message"}}` y logging seguro (FR-019)
- [X] T022 [US3] Implementar en `frontend/app/jobs/MatchPanel.tsx` `match-status` (Analizandoâ€¦/Completado/Error), botÃ³n deshabilitado durante la carga, `match-retry`, timeout de 85 s y aviso de arranque en frÃ­o de Render; agregar llamada `GET /health` de calentamiento al abrir `/jobs`

## Phase 6: User Story 4 - Recuperar recomendaciones y abrir la oferta (P2)

**Objetivo**: ver recomendaciones guardadas, recalcular, aviso de CV cambiado y abrir oferta original.
**Prueba independiente**: recargar `/jobs` muestra las recomendaciones guardadas; "Recalcular" las reemplaza; el enlace abre la oferta en pestaÃ±a nueva.

- [X] T023 [P] [US4] Test de integraciÃ³n `tests/integration/test_match_persistence.py`: `GET /api/jobs/match/{searchId}?resumeId=` devuelve lo guardado, `recalculate=true` reemplaza, `resumeChanged` tras editar el CV, eliminaciÃ³n en cascada al borrar el CV, aislamiento entre usuarios (404 uniforme)
- [X] T024 [US4] Agregar `GET /api/jobs/match/{searchId}` en `backend/app/api/jobs.py` y lÃ³gica de `recalculate`/`resumeChanged` en `match_service.py`
- [X] T025 [US4] En `frontend/app/jobs/MatchPanel.tsx` cargar el resultado guardado, `match-recalculate`, `match-resume-changed` y `match-link-{rank}` con `target="_blank"` y `rel="noopener noreferrer"`
- [X] T026 [P] [US4] Prueba E2E `tests/e2e/job-match.spec.ts` (tÃ­tulos en espaÃ±ol, locators accesibles/`data-testid` segÃºn `.github/instructions/playwright-tests.instructions.md`): Match, estado de carga, recomendaciones, error con reintento, guardado tras recarga, enlace a oferta

## Phase 7: Polish

- [X] T027 [P] Documentar el flujo, variables y migraciones 004â€“007 en `docs/desarrollo.md` y alinear `backend/.env.example`/`render.yaml`
- [X] T028 [P] Ejecutar la validaciÃ³n de `specs/007-job-match-recommendations/quickstart.md` y `pytest` completo; confirmar que la bÃºsqueda actual (`tests/contract/test_jobs_api.py`) sigue verde
- [X] T029 Resolver `TODO(RATIFICATION_DATE)` en `.specify/memory/constitution.md` si el usuario da la fecha

## Dependencias

- Setup â†’ Foundational â†’ US1 (MVP) â†’ US2, US3, US4 (todas dependen de US1; entre sÃ­ son casi independientes, aunque US2/US3/US4 editan `MatchPanel.tsx` y `jobs.py`, por lo que conviene secuenciarlas).
- T005 depende de T003â€“T004; T013 de T006, T008â€“T010; T014 de T013; T016 de T015.
- Las migraciones deben aplicarse en Supabase antes de ejecutar pruebas de integraciÃ³n reales.

## Paralelismo

- Foundational: T006, T007, T008, T009 en paralelo (tras T003â€“T005 si usan el esquema).
- US1: T011, T012 y T015 en paralelo.
- Tests de US2/US3/US4 (T017, T020, T023) en paralelo entre sÃ­.

## Estrategia

MVP = Phase 1â€“3 (US1): Match funcional extremo a extremo. Luego US2 (calidad del anÃ¡lisis), US3 (robustez) y US4 (persistencia/UX). Implementar un cambio por vez, con OK del usuario.
