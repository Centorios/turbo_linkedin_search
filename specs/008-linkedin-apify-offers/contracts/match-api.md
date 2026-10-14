# Contrato: Match con ofertas de ambas fuentes

Se conservan `POST /api/jobs/match` y `GET /api/jobs/match/{searchId}` de la feature 007; cambios:

- Candidatas: todas las ofertas deduplicadas guardadas de la búsqueda, de cualquier fuente.
- Texto de embedding: título, empresa, ubicación y `description` (o `snippet`). Un cambio de `content_hash` fuerza nuevo embedding.
- Disponible con ≥1 oferta; la respuesta incluye `partial: true` si alguna fuente sigue en curso, falló o venció.
- `canRecalculate` en el estado: true cuando LinkedIn terminó tras un Match previo.
- Cada recomendación incluye `source`, `url`, `alternateUrls` y `descriptionIsPartial`.
- Errores y deadline sin cambios (404, 409 `match_in_progress`, 504 `match_timeout`, 502/503).
