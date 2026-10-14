# Contrato: proveedor LinkedIn (Apify)

Módulo `backend/app/services/apify_linkedin.py`, separado de `jooble.py`.

## Configuración (backend)
`APIFY_TOKEN`, `APIFY_LINKEDIN_ACTOR_ID` (`bebity/linkedin-jobs-scraper`), `APIFY_MAX_CHARGE_USD` (0,10), `APIFY_RUN_TIMEOUT_SECONDS` (180), `APIFY_MAX_ITEMS` (20), `APIFY_WEBHOOK_SECRET` (opcional). Sin token o Actor → `LinkedInSourceUnconfigured`.

## Interfaz
- `start(keywords, location) -> RunHandle{runId, datasetId}`: `POST https://api.apify.com/v2/acts/{actor}/runs` con `{titles:[keywords], locations:[location], rows:20}` y `maxTotalChargeUsd`.
- `get_run(runId) -> RunStatus{status, datasetId, costUsd}`.
- `fetch_items(datasetId, limit=20) -> list[JobListing]` normalizado: id `linkedin:<id>`, descripción disponible, `descriptionIsPartial` si falta o está truncada, URL original `https`.
- `abort(runId)`.

## Reglas
Solo HTTPS a `api.apify.com`; token en cabecera `Authorization: Bearer`; nunca se registra el token; entrada limitada a términos y ubicación; errores mapeados a `LinkedInSourceError`.
