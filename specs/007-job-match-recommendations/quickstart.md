# Quickstart: validar Match

## Prerrequisitos
- Deployment Azure `text-embedding-3-small` creado (1536 dim).
- Variables nuevas en `backend/.env` (ver `backend/.env.example`): `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`, `AZURE_OPENAI_EMBEDDING_DIMENSIONS=1536`. Replicar en Render (`render.yaml`).
- Migraciones 004+ aplicadas en Supabase (pgvector habilitado).
- Al menos un CV y `JOOBLE_AR_API_KEY` configurada.

## Ejecución
1. Backend: `uvicorn app.main:app --reload` (desde `backend`). Sin worker ni servicios adicionales.
2. Frontend: `npm run dev` (desde `frontend`).

## Escenarios
1. **Camino feliz**: en `/jobs` buscar, pulsar Match → "Analizando…" (botón deshabilitado) → hasta 3 recomendaciones con enlace a la oferta original.
2. **Reutilización de embeddings**: repetir Match sin cambios; no se generan embeddings nuevos y responde más rápido. Con ofertas/CV nuevos, se piden en un único lote.
3. **Recalcular y CV cambiado**: editar/duplicar CV, aparece el aviso; "Recalcular" reemplaza el resultado.
4. **Timeout**: simular demora de Azure > deadline; mensaje de tiempo agotado + "Reintentar"; resultado previo conservado y reintento más rápido.
5. **Error**: simular falla de Azure; mensaje de error + "Reintentar", resultado previo conservado.
6. **Doble clic / concurrencia**: segunda solicitud simultánea → 409 `match_in_progress`.
7. **Aislamiento**: otro usuario recibe 404 al consultar `searchId`.
8. **Regresión**: la búsqueda funciona igual sin Match (SC-008).
9. **Cold start (Render free)**: tras inactividad, la primera petición puede tardar ~1 min; verificar el aviso en la UI.

## Pruebas
- `pytest tests/contract tests/integration` (con proveedores falsos).
- `npx playwright test tests/e2e/job-match.spec.ts`.
