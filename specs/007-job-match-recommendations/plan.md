# Plan de implementación: Match de empleos con recomendaciones

**Rama**: `007-job-match-recommendations` | **Fecha**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

## Resumen

Agregar un botón **Match** a la pantalla `/jobs`. Con el CV elegido y solo las ofertas de la búsqueda que lo originó, el backend genera embeddings (Azure `text-embedding-3-small`, 1536 dim), los compara con pgvector en Supabase, y el modelo de chat ya usado para los CVs analiza los candidatos y devuelve hasta 3 recomendaciones en JSON validado con Pydantic. El análisis es **sincrónico** (una sola petición, sin cola ni worker), con estado de carga, deadline total, manejo de timeout/errores, reutilización de embeddings y generación en lote de los faltantes. Se conserva la búsqueda actual con Jooble; el cambio en `POST /api/jobs/search` es aditivo.

## Technical Context

**Lenguaje/Versión**: Python 3.11 (backend), TypeScript / Next.js + React (frontend)
**Dependencias principales**: FastAPI, Pydantic, httpx, supabase-py (ya presentes). **Sin dependencias nuevas** en la opción recomendada.
**Almacenamiento**: Supabase PostgreSQL + extensión `pgvector` (`vector(1536)`), RLS por usuario
**Pruebas**: pytest (contract, integration con proveedores falsos), Playwright (e2e)
**Plataforma**: Render (FastAPI, plan free actual), Vercel (frontend), Supabase, Azure OpenAI
**Tipo de proyecto**: Aplicación web (frontend + backend)
**Rendimiento**: búsqueda ≤20 ofertas; Match típico 15–40 s; deadline total backend 75 s (504 `match_timeout`); timeout cliente 85 s; ver "Presupuesto de tiempo y hosting"
**Restricciones**: generación de CV sigue sincrónica; secretos solo en servidor; el contenido de ofertas es dato, no instrucción; nunca presentar afinidad como probabilidad de contratación
**Escala**: ≤20 ofertas por búsqueda → escaneo exacto por coseno, sin índice ANN
**Decisión tomada**: procesamiento sincrónico, sin cola, worker, Celery ni Redis (ver [research.md](./research.md) R5)

## Constitution Check

Constitución v1.3.0.

| Principio | Evaluación | Estado |
|---|---|---|
| I. Etapas / alcance (Match, background permitidos) | Match explícitamente permitido; CV sincrónico intacto | ✅ |
| II. JSON estricto validado | Salida del LLM validada con Pydantic; ids de oferta verificados | ✅ |
| III. Render solo en cliente | No toca plantillas ni PDF | ✅ |
| IV. Seguridad y privacidad | RLS + filtro por `user_id`; secretos en servidor; solo CV y datos públicos de ofertas a Azure del proyecto | ✅ |
| V. Pruebas y simplicidad | Integración + UI con `data-testid`; flujo sincrónico, sin infraestructura nueva | ✅ |

Re-evaluación posdiseño: sin violaciones. El background queda permitido (MAY) pero no se usa.

## Presupuesto de tiempo y hosting

| Etapa | Estimado | Timeout |
|---|---|---|
| Embeddings en lote (CV + ofertas faltantes, 1 llamada) | 1–3 s | 20 s |
| Búsqueda pgvector (RPC) | < 1 s | 5 s |
| Análisis LLM (chat, 1 llamada) | 10–30 s | 45 s |
| Persistencia | < 1 s | — |
| **Deadline total backend** (`asyncio.timeout`) | 15–40 s típico | **75 s** → 504 |
| Timeout cliente (`AbortController`) | — | 85 s |

- El navegador llama **directo** al backend en Render (`frontend/app/lib/jobs-client.ts`); no hay proxy Next/Vercel, por lo que no aplica el límite de funciones de Vercel.
- Render plan free: el servicio se duerme tras 15 min sin tráfico y tarda ~1 min en reactivarse; la primera petición puede consumir el presupuesto. Mitigaciones: aviso en la UI, `GET /health` de calentamiento al abrir `/jobs` y/o plan de pago.
- **Supuesto no verificado**: el límite máximo de respuesta HTTP de Render (~100 s de memoria; la documentación oficial no pudo confirmarse). El deadline de 75 s deja margen.
- Render puede reiniciar el servicio durante una petición: el cliente ve un error y reintenta; los embeddings ya guardados se reutilizan.

## Estructura del proyecto

### Documentación

```text
specs/007-job-match-recommendations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── match-api.md
│   └── match-ui.md
└── tasks.md   # lo genera /speckit-tasks
```

### Código fuente (rutas reales)

```text
backend/
├── app/
│   ├── api/jobs.py                  # modificar: persistir búsqueda, searchId; nuevos endpoints match
│   ├── models/jobs.py               # modificar: searchId opcional
│   ├── models/match.py              # nuevo: esquemas de Match
│   ├── core/settings.py             # modificar: variables de embeddings y timeouts
│   ├── services/azure_openai.py     # modificar: embeddings + análisis de Match
│   ├── services/job_search_repository.py   # nuevo
│   ├── services/match_repository.py        # nuevo
│   └── services/match_service.py           # nuevo: orquestación sincrónica con deadline
├── supabase/migrations/             # 004_enable_pgvector, 005_job_searches, 006_match_results, 007_match_functions
└── .env.example                     # modificar
frontend/app/
├── jobs/page.tsx                    # modificar: botón Match
├── jobs/MatchPanel.tsx              # nuevo
├── lib/match-client.ts              # nuevo
└── types/match.ts                   # nuevo
tests/
├── contract/test_match_api.py
├── integration/test_match_*.py
└── e2e/job-match.spec.ts
render.yaml, docs/desarrollo.md      # modificar
```

**Decisión de estructura**: aplicación web existente; se extiende sin crear proyectos nuevos.

## Complexity Tracking

| Elemento | Por qué | Alternativa descartada |
|---|---|---|
| Ninguno | Flujo sincrónico sin cola ni worker | — |
