# Implementation Plan: Búsqueda de empleos desde un CV

**Branch**: `codex/006-cv-job-search` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

## Summary

Incorporar una página privada que proponga una búsqueda desde un CV guardado y permita consultar, bajo acción explícita del usuario, hasta 20 ofertas argentinas mediante la API regional de Jooble. FastAPI autoriza el CV, valida parámetros, normaliza respuestas y devuelve solo datos aptos para mostrar. La primera entrega no asigna un porcentaje de afinidad ni guarda ofertas.

## Technical Context

**Language/Version**: Python 3.11+, TypeScript, React 19, Next.js 15.

**Primary Dependencies**: FastAPI, Pydantic, Supabase, `httpx`, Next.js y React existentes. Ninguna dependencia nueva.

**Storage**: Supabase `resumes` existente, solo lectura. Sin tabla de ofertas en esta entrega.

**Testing**: pytest con proveedor falso para contratos y aislamiento; Vitest para selección, búsqueda y estados de la UI.

**Target Platform**: FastAPI en Render y navegador en Vercel.

**Project Type**: Web full-stack.

**Performance Goals**: Una llamada al proveedor por búsqueda explícita, 20 resultados máximos, timeout de 10 s y caché temporal por proceso para búsquedas idénticas.

**Constraints**: Jooble Argentina requiere una clave regional y el plan gratuito documenta 500 llamadas de por vida. El secreto permanece en el backend; no se envía el CV al proveedor. Sin consultas automáticas ni scraping.

**Scale/Scope**: Primera página de búsqueda, selección entre los CVs recientes, listado y enlace a fuente. Favoritos, paginación, ingestión periódica y embeddings se tratarán por separado.

## Constitution Check

- PASS: La constitución 1.2.0 admite el inicio incremental de Etapa 2 y la API regional de Jooble.
- PASS: Datos de CV aislados por token y consulta de dueño; hacia Jooble salen únicamente términos y ubicación confirmados.
- PASS: No se alteran contrato, persistencia, plantillas ni descarga del CV.
- PASS: Fuente externa en backend con clave de entorno y pruebas de integración; sin dependencias nuevas.

## Project Structure

```text
backend/app/
├── api/jobs.py
├── models/jobs.py
├── services/job_search.py
├── services/jooble.py
├── core/settings.py
└── main.py
frontend/app/
├── jobs/page.tsx
├── lib/jobs-client.ts
├── types/jobs.ts
└── components/app-header.tsx
tests/contract/test_jobs_api.py
frontend/tests/jobs.test.tsx
specs/006-cv-job-search/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/jobs-api.md
├── quickstart.md
├── tasks.md
└── validation-results.md
```

**Structure Decision**: Reutilizar autenticación y repositorio de CV existentes. Mantener el conector regional detrás de un servicio sustituible para futuras fuentes.

## Complexity Tracking

No hay excepciones a la constitución. La caché temporal reduce consumo de la cuota sin introducir almacenamiento o workers antes de que el producto lo necesite.
