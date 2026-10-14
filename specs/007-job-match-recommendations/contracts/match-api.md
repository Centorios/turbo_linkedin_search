# Contrato API de Match

Auth: `Authorization: Bearer <token>` (`require_user_id`). Errores: `{"detail": {"code", "message"}}`. Recursos ajenos o inexistentes → 404 uniforme.

## Cambio aditivo: `POST /api/jobs/search`
Respuesta existente `{ items: JobListing[] }` + `searchId: string | null`. Sin otros cambios.

## `POST /api/jobs/match`
Body: `{ "searchId": uuid, "resumeId": uuid, "recalculate": false }`
Sincrónico: la respuesta llega cuando termina el análisis (deadline backend 75 s).
- 200: `MatchResult` completo (calculado ahora, o el guardado si existe y `recalculate=false`).
- 404 `search_not_found` / `resume_not_found`; 422 validación.
- 409 `match_in_progress`: ya hay un análisis simultáneo para esa búsqueda y CV.
- 502/503 `match_unavailable`: falla de Azure o Supabase; el resultado previo se conserva.
- 504 `match_timeout`: se superó el deadline; los embeddings ya generados quedan guardados.

## `GET /api/jobs/match/{searchId}?resumeId=uuid`
200 → `MatchResult` guardado (puede tener 0 recomendaciones). 404 si no existe o no es del usuario.

## MatchResult
```json
{
  "resumeChanged": false,
  "completedAt": "iso",
  "recommendations": [
    {
      "rank": 1,
      "offerId": "uuid",
      "title": "", "company": "", "location": "", "url": "https://...",
      "affinity": "Alta|Media",
      "summary": "",
      "matches": ["..."],
      "unmetRequirements": ["..."],
      "missingInfo": ["..."]
    }
  ]
}
```
`recommendations` puede tener 0–3 elementos.

## Salida del LLM (validada con Pydantic, `StrictModel`)
`{ "recommendations": [ { "offerId", "affinity", "summary", "matches", "unmetRequirements", "missingInfo" } ] }` — máx. 3; `offerId` debe estar entre los candidatos enviados; sin campos extra; sin porcentajes ni probabilidad de contratación.
