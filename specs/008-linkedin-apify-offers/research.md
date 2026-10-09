# Investigación y decisiones: ofertas de LinkedIn (008)

## A. Actor (investigación previa)

Fuente: API pública y fichas de la Apify Store; no se ejecutó ningún Actor ni se usaron credenciales.

- **Elegido:** `bebity/linkedin-jobs-scraper` (aprobado). **Respaldo:** `valig/linkedin-jobs-scraper`.
- Sin cuenta ni cookies de LinkedIn. Entrada: `titles`, `locations`, `rows`. Salida: 42 campos (descripción, empresa, ubicación, enlace).
- Costo ≈ US$0,0015 por oferta; 20 ofertas ≈ US$0,03. Control con `rows=20` y `maxTotalChargeUsd`.
- Riesgos: Actor comunitario, términos de LinkedIn sobre scraping (decisión legal del responsable), descripciones parciales, cambios de precio.

## B. Decisiones de integración

### D1. Recuperación de resultados
- **Decisión:** polling perezoso. `POST /api/jobs/search` inicia el run de Apify (`POST /v2/acts/{id}/runs`) sin esperar; `GET /api/jobs/search/{id}/status` consulta el run (`GET /v2/actor-runs/{runId}`) mientras sigue activo y, si terminó, descarga el dataset y lo persiste. Webhook opcional (`POST /api/jobs/apify/webhook`, secreto compartido) que ejecuta la misma rutina idempotente.
- **Razón:** funciona en Render sin Celery/Redis ni dependencias nuevas, sin petición abierta, y no depende de que el webhook llegue.
- **Alternativas:** solo webhook (frágil ante reinicios, exige URL pública); Celery+Redis (infraestructura nueva, fuera de alcance); petición HTTP abierta (descartada).

### D2. Idempotencia
- Una fila por (búsqueda, fuente) con `apify_run_id` único. La finalización usa transición condicional (`running → succeeded`) y `upsert` de ofertas por clave natural: polling y webhook repetidos no duplican.

### D3. Límites, tiempo, costo y reintentos
- Tiempo: 180 s desde el inicio; vencido → `timed_out` y se aborta el run. Volumen: 20 ofertas (`rows=20`, recorte al persistir). Costo: `maxTotalChargeUsd` configurable (por defecto US$0,10).
- Sin reintento automático de la fuente; reintento manual `POST …/sources/linkedin/retry`, máximo 3 intentos por búsqueda. Errores transitorios al llamar a Apify (red, 5xx) se reintentan 2 veces con backoff corto dentro de la misma llamada.

### D4. Estados por fuente
`pending → running → succeeded | failed | timed_out`. Jooble corre en línea. Búsqueda `complete` si todas `succeeded`; `incomplete` si alguna falló; `in_progress` si alguna está activa.

### D5. Habilitación del Match
- Con ≥1 oferta guardada el Match está disponible aunque LinkedIn siga en curso (FR-014), marcado como parcial; al terminar LinkedIn se ofrece recalcular. Siempre sincrónico, con el deadline actual.

### D6. Normalización y deduplicación
- Modelo común con `source`, `url`, `description`, `description_is_partial`. `dedup_key` = hash de título + empresa + ubicación normalizados (minúsculas, sin acentos ni puntuación). Entre duplicados se conserva la descripción más larga y los enlaces de ambas fuentes. Un cambio de descripción actualiza `content_hash` y el embedding se recalcula.

### D7. Seguridad
- Token y Actor ID solo en variables de entorno; el CV no se envía a Apify; el webhook valida un secreto; lecturas filtradas por `user_id` y RLS.

### D8. Pruebas
- Proveedores simulados (`httpx.MockTransport`) para Apify y Jooble; sin llamadas reales ni costo en CI.
