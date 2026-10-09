# Investigación: Match de empleos

## R1. Modelo y API de embeddings
- **Decisión**: deployment Azure `text-embedding-3-small`, 1536 dimensiones, endpoint `/openai/deployments/{dep}/embeddings`, entrada en lote. Variables `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` y `AZURE_OPENAI_EMBEDDING_DIMENSIONS=1536`.
- **Razón**: separado del modelo de chat (requisito), barato, 1536 es la dimensión nativa y la misma para CV y ofertas.
- **Alternativas**: `text-embedding-3-large` (más caro, innecesario con ≤20 ofertas); reutilizar el deployment de chat (imposible).

## R2. Comparación vectorial
- **Decisión**: pgvector, distancia coseno (`<=>`) mediante función SQL (RPC) filtrada por `search_id` y `user_id`; se toman los top K=8 candidatos. Sin índice HNSW/IVFFlat.
- **Razón**: ≤20 vectores por búsqueda; el escaneo exacto es más preciso y simple.
- **Alternativas**: similitud en Python (incumple el requisito de pgvector); índice ANN (sin beneficio a esta escala).

## R3. Persistencia del conjunto de ofertas
- **Decisión**: `POST /api/jobs/search` guarda `job_searches` + `job_search_offers` (best-effort) y devuelve `searchId` opcional. Si falla guardar, `searchId` es null y Match queda deshabilitado; la búsqueda sigue funcionando.
- **Razón**: Match debe usar exactamente las ofertas encontradas, sin nueva búsqueda; el cambio es aditivo (SC-008).
- **Alternativas**: reenviar las ofertas desde el cliente (manipulable, rompe aislamiento); reconsultar Jooble (prohibido).

## R4. Reutilización de embeddings y lote
- **Decisión**: `content_hash` (SHA-256 del texto normalizado + modelo). CV: tabla `resume_embeddings`; ofertas: se reutiliza por hash dentro del mismo usuario. Los embeddings faltantes (CV y ofertas) se piden juntos en **una sola llamada en lote** (la API acepta una lista de inputs) y se guardan antes de continuar.
- **Razón**: evita llamadas repetidas a Azure al recalcular; si un reintento ocurre tras un timeout, los embeddings ya guardados se reutilizan y el reintento es más rápido.

## R5. Procesamiento sincrónico (sin cola ni worker)
- **Decisión**: `POST /api/jobs/match` ejecuta todo en la petición: cargar datos → reutilizar embeddings → lote de faltantes → RPC pgvector → LLM → validar → persistir con reemplazo atómico → 200 con el resultado.
- **Timeouts**: embeddings 20 s, RPC 5 s, chat 45 s, deadline total backend 75 s con `asyncio.timeout` (504 `match_timeout`); cliente `AbortController` 85 s.
- **Concurrencia**: lock advisory por (search_id, resume_id) en una RPC; una segunda solicitud simultánea recibe 409 `match_in_progress`. La UI deshabilita el botón.
- **Hosting**: llamada directa navegador→Render (sin límite de funciones de Vercel). Plan free con cold start de ~1 min tras 15 min de inactividad; el límite máximo de respuesta HTTP de Render no pudo confirmarse en documentación oficial (supuesto ~100 s). Mitigaciones: aviso en UI, calentamiento con `/health`, plan de pago si es necesario.
- **Razón**: decisión del usuario; menor complejidad, sin servicios nuevos. Constitución v1.3.0 compatible (background es MAY).
- **Descartado**: cola Postgres + worker, Celery + Redis, `BackgroundTasks` (podrían retomarse si el tiempo supera el límite).

## R6. Análisis con LLM
- **Decisión**: reutilizar el deployment de chat (`_request_json`, temperature 0, `json_object`), nuevo prompt de sistema; salida validada con Pydantic `StrictModel`. Se rechaza cualquier recomendación cuyo `offerId` no pertenezca a la búsqueda, y se recorta a 3. Afinidad cualitativa Alta/Media; sin porcentajes. El contenido de ofertas se delimita y se declara dato no confiable (FR-020).
- **Alternativas**: salida libre (viola Principio II).

## R7. Seguridad y RLS
- **Decisión**: RLS `auth.uid() = user_id` en todas las tablas nuevas, `on delete cascade` desde `resumes`. El backend usa service role pero filtra siempre por `user_id`; recursos ajenos devuelven 404 uniforme.
- **Alternativa**: confiar solo en el backend (sin defensa en profundidad).

## R8. Frontend
- **Decisión**: panel Match en `/jobs`, estado de carga "Analizando…" con botón deshabilitado, `AbortController` con timeout de 85 s, "Recalcular"/"Reintentar", aviso "El CV cambió desde este análisis" (hash del CV vs `resume_content_hash`), enlace a la oferta original en pestaña nueva, `data-testid` en todo. Sin polling.

## R9. Pruebas
- Contract (esquemas y endpoints), integration con proveedores falsos (aislamiento, 409 por concurrencia, 504 por timeout, reutilización y lote de embeddings, conservación del resultado previo ante falla), e2e Playwright (flujo, carga, timeout/error con reintento, enlace original) y regresión de búsqueda actual.
