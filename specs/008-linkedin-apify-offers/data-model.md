# Modelo de datos (008)

Migración: `backend/supabase/migrations/008_linkedin_source_runs.sql`. RLS `auth.uid() = user_id` en todo.

## job_searches (extendida)
- `sources text[]` (`jooble`, `linkedin`), `status` (`in_progress | complete | incomplete`), `updated_at`.

## job_search_source_runs (nueva)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| search_id | uuid FK → job_searches | on delete cascade |
| user_id | uuid | RLS |
| source | text | `jooble` / `linkedin` |
| status | text | `pending, running, succeeded, failed, timed_out` |
| apify_run_id | text | único cuando no es nulo |
| apify_dataset_id | text | |
| attempts | int | máx. 3 para reintentos manuales |
| offers_count | int | |
| cost_usd | numeric | uso reportado |
| error_code | text | sin detalles sensibles |
| started_at, finished_at | timestamptz | timeout 180 s |
Único: (search_id, source).

## job_search_offers (extendida)
- `description text` (completa o la disponible), `description_is_partial boolean`, `dedup_key text`, `sources text[]`, `alternate_urls jsonb` (`[{source,url}]`).
- Único nuevo: (search_id, dedup_key). `external_id` se conserva para Jooble/Apify.
- `snippet` sigue existiendo; el Match usa `description` si está.

## Transiciones
`pending → running → succeeded|failed|timed_out`; `failed|timed_out → pending` por reintento manual. Una fuente terminal no vuelve a `running` sin reintento. Estado de búsqueda derivado de sus fuentes.

## Validaciones
- 20 ofertas máximo por fuente; URL `https` obligatoria; texto truncado a límite razonable de descripción.
