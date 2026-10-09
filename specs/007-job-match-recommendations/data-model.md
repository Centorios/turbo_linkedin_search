# Modelo de datos

Todas las tablas: `user_id uuid → auth.users on delete cascade`, RLS `auth.uid() = user_id`. Requiere `create extension vector`.

## job_searches
`id uuid pk`, `user_id`, `resume_id → resumes(id) on delete cascade`, `keywords`, `location`, `created_at`.

## job_search_offers
`id uuid pk`, `search_id → job_searches on delete cascade`, `user_id`, `position int`, `external_id`, `title`, `company`, `location`, `snippet`, `url`, `source`, `source_updated_at`, `content_hash`, `embedding vector(1536) null`.
Único: (`search_id`, `external_id`).

## resume_embeddings
`resume_id pk → resumes on delete cascade`, `user_id`, `content_hash`, `model`, `embedding vector(1536)`, `updated_at`.
Reutilización: si `content_hash` y `model` coinciden, no se llama a Azure.

## match_results
`id uuid pk`, `user_id`, `search_id → job_searches on delete cascade`, `resume_id → resumes on delete cascade`, `resume_content_hash`, `created_at` (momento del análisis).
Único (`search_id`, `resume_id`): un resultado vigente por búsqueda y CV.

## match_recommendations
`result_id → match_results on delete cascade`, `user_id`, `rank 1..3`, `offer_id → job_search_offers`, `affinity` (`Alta|Media`), `summary`, `matches jsonb`, `unmet_requirements jsonb`, `missing_info jsonb`.
Pk (`result_id`, `rank`).

## Funciones SQL
- `match_candidates(p_search_id, p_resume_id, p_k)`: top K por coseno, filtrado por usuario.
- `save_match_result(...)`: en una transacción reemplaza el resultado previo (upsert de `match_results` + borrado/inserción de recomendaciones). Si el análisis falla, no se invoca y el resultado previo se conserva.
- `try_lock_match(p_search_id, p_resume_id)`: lock advisory transaccional/de sesión para rechazar solicitudes simultáneas (409).

## Ciclo de vida
Sin estados persistidos de ejecución: el estado de carga vive en el cliente durante la petición. "Reintentar"/"Recalcular" repite la petición; el resultado previo se mantiene hasta que el nuevo se guarda (reemplazo atómico) y se conserva si falla.

## Aviso de CV cambiado
`resumeChanged = hash(CV actual) != match_results.resume_content_hash`.

## Validaciones
0–3 recomendaciones; `offer_id` debe pertenecer a `search_id`; afinidad baja nunca se persiste.
