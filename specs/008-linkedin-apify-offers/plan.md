# Implementation Plan: Ofertas de LinkedIn vía Apify (008)

**Branch**: `008-linkedin-apify-offers` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

## Summary

Agregar LinkedIn como segunda fuente de ofertas junto a Jooble. FastAPI invoca directamente la API de Apify
(`bebity/linkedin-jobs-scraper`, 20 ofertas, tope de gasto por ejecución) mediante un proveedor propio, guarda el
run id y su estado por fuente en Supabase y el frontend consulta el progreso. Los resultados se recuperan por
**polling perezoso** en el endpoint de estado (idempotente por run id), con webhook opcional como mejora. Las
ofertas se normalizan, se deduplican entre fuentes y se asocian a búsqueda y CV. El Match reutiliza embeddings,
pgvector y el modelo actual, sincrónico, y puede ejecutarse con lo ya guardado y recalcularse al terminar LinkedIn.

## Technical Context

**Language/Version**: Python 3.12 (FastAPI), TypeScript / Next.js (frontend)
**Primary Dependencies**: FastAPI, pydantic-settings, httpx, supabase-py (todas ya instaladas; **sin dependencias nuevas**)
**Storage**: Supabase PostgreSQL + pgvector, migración versionada `008`
**Testing**: pytest (`tests/contract`, `tests/integration`) con proveedores simulados; Vitest/Playwright en `frontend/tests` y `tests/e2e`
**Target Platform**: Render (API), Vercel (web), Supabase
**Project Type**: Web (frontend + backend)
**Performance Goals**: inicio de búsqueda < 3 s con Jooble disponible; LinkedIn no bloquea la UI; Match sincrónico dentro del deadline actual (75 s)
**Constraints**: LinkedIn falla tras 180 s sin reintento automático; 20 ofertas por fuente; `maxTotalChargeUsd` por ejecución; secretos solo en backend
**Scale/Scope**: sin tope de búsquedas por persona; costo ≈ US$0,03 por búsqueda con LinkedIn

Sin `NEEDS CLARIFICATION` pendientes (resueltos en [research.md](./research.md)).

## Constitution Check

| Principio (v1.3.0) | Estado |
|---|---|
| Apify/scraping admitidos y proveedor adicional con términos revisados | Cumple: enmienda 1.3.0; riesgo de términos de LinkedIn documentado y a cargo del responsable |
| Secretos solo en el servidor | Cumple: `APIFY_TOKEN`, `APIFY_LINKEDIN_ACTOR_ID` en variables del backend |
| Búsquedas externas envían solo términos/ubicación revisados | Cumple: el CV nunca se envía a Apify; aviso FR-021 |
| Aislamiento por usuario (RLS, endpoints autorizados) | Cumple: RLS en tablas nuevas y validación de token/propiedad |
| Pruebas de integración para persistencia y servicios | Cumple: proveedores simulados de Jooble y Apify |
| Match en background permitido, CV sincrónico | Cumple: Match sigue sincrónico |
| Sin dependencias sin consultar | Cumple: solo httpx |

Resultado: **PASA**, sin violaciones. Re-evaluado tras el diseño: sin cambios.

## Project Structure

### Documentation

```text
specs/008-linkedin-apify-offers/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/ (search-api.md, linkedin-provider.md, match-api.md)
└── checklists/requirements.md
```

### Source Code

```text
backend/
├── app/
│   ├── api/jobs.py                       # search async, estado, reintento, webhook
│   ├── core/settings.py                  # variables Apify
│   ├── models/jobs.py                    # fuentes, estados, descripción parcial
│   └── services/
│       ├── apify_linkedin.py             # NUEVO: proveedor LinkedIn (httpx)
│       ├── job_search_orchestrator.py    # NUEVO: runs por fuente, merge, dedup
│       ├── job_search_repository.py      # offers + source runs
│       └── match_service.py              # ofertas de ambas fuentes, descripción completa
├── supabase/migrations/008_linkedin_source_runs.sql
└── .env.example
frontend/app/jobs/ (page.tsx, MatchPanel.tsx) y app/lib/jobs-client.ts
tests/ (contract, integration) y frontend/tests/jobs.test.tsx
docs/ (variables, operación, costos)
```

**Structure Decision**: estructura web existente; el proveedor LinkedIn es un módulo separado de `jooble.py`.

## Complexity Tracking

Sin violaciones que justificar.
