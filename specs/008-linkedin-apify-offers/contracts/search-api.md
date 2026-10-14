# Contrato: búsqueda multi-fuente

Todos los endpoints exigen token de usuario y validan la propiedad del CV y de la búsqueda (404 si no es propia).

## POST /api/jobs/search
Body: `{ resumeId, keywords, location, sources: ["jooble"|"linkedin", ...] }` (mínimo 1; por defecto `["jooble"]` para compatibilidad).
200: `{ searchId, status, items: JobListing[], sources: SourceState[] }`. Jooble se resuelve en línea; LinkedIn queda `running`.
Errores: 404 CV, 422 validación, 503 fuente sin configurar solo si es la única seleccionada, 502 si fallan todas.

## GET /api/jobs/search/{searchId}/status
200: `{ searchId, status, sources: [{ source, status, offersCount, error? }], items, matchAvailable, canRecalculate }`.
Si LinkedIn está activo, consulta a Apify y persiste de forma idempotente; vencido el timeout pasa a `timed_out`.

## POST /api/jobs/search/{searchId}/sources/linkedin/retry
Solo si la fuente está `failed|timed_out` y `attempts < 3`. 202 `{ source }`; 409 si no aplica.

## POST /api/jobs/apify/webhook (opcional)
Cabecera `X-Webhook-Secret`. Ejecuta la misma finalización idempotente. 401 si el secreto no coincide.

## JobListing (ampliado)
`id, title, company, location, snippet, description, descriptionIsPartial, url, source, sources[], alternateUrls[], updatedAt`.
