# Implementation Plan: End-to-End CV Generation Flow

**Branch**: `001-cv-generation-flow` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-cv-generation-flow/spec.md`

## Summary

Construir un flujo sincrónico que autentique al usuario, reciba texto profesional, genere un CV
estructurado mediante Azure OpenAI, lo valide y persista asociado al usuario, y lo entregue a
dos plantillas de frontend para previsualización y descarga PDF en el navegador. El contrato
canónico será un objeto anidado con `personalInfo`, `summary`, `experience[]`, `education[]`,
`skills.hard[]`, `skills.soft[]`, `languages[]` y `certifications[]`.

## Technical Context

**Language/Version**: Python 3.11+ para FastAPI; TypeScript para React/Next.js

**Primary Dependencies**: FastAPI, Pydantic, Supabase Auth/PostgreSQL, Azure OpenAI GPT-4o,
React/Next.js y `@react-pdf/renderer`

**Storage**: Supabase PostgreSQL; tabla `resumes` con `user_id` y JSON validado

**Testing**: pytest para backend y contratos; Vitest para pruebas unitarias del frontend;
Playwright para el flujo de usuario; pruebas de integración para autenticación, generación,
persistencia y exportación

**Target Platform**: Navegadores modernos; backend Linux desplegable en Render; frontend
desplegable en Vercel

**Project Type**: Aplicación web full-stack con frontend Next.js y API FastAPI

**Performance Goals**: En una muestra de al menos 30 solicitudes válidas ejecutadas en el entorno
local configurado, el percentil 90 del tiempo entre $T_0$ (pulsación de "Generar CV") y $T_f$
(finalización de la recepción del JSON estructurado y renderizado de la previsualización interactiva)
debe ser de 60 segundos o menos; la interfaz debe mostrar carga inmediatamente después del envío

**Constraints**: Flujo sincrónico; JSON estricto validado antes de persistir o renderizar; secretos
de Azure, PostgreSQL y Supabase privilegiado solo en backend; navegador limitado a configuración
pública de Supabase y token de sesión; aislamiento por usuario; PDF generado exclusivamente en el
cliente; sin scraping, colas, embeddings ni matching laboral

**Scale/Scope**: MVP para un flujo principal, dos plantillas, un endpoint de generación, persistencia
idempotente del resultado actual y las secciones estructuradas definidas en el contrato; no incluye
vista ni consulta de historial de CVs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- PASS: El alcance se limita al MVP de generación de CV; se excluyen scraping, background jobs,
  `pgvector`, embeddings y matching.
- PASS: El contrato JSON se valida en FastAPI antes de persistirse o enviarse al frontend.
- PASS: El renderizado y PDF permanecen en React/Next.js mediante `@react-pdf/renderer`.
- PASS: Supabase Auth y `user_id` aíslan los CVs por usuario; los secretos no llegan al cliente.
- PASS: Se contemplan pruebas de integración para contratos, autenticación, persistencia y
  comunicación entre servicios, además de pruebas de comportamiento de la UI.
- PASS: La elección de Azure OpenAI GPT-4o cumple la constitución; Anthropic queda fuera del MVP
  para evitar introducir un proveedor alternativo sin enmienda.

## Project Structure

### Documentation (this feature)

```text
specs/001-cv-generation-flow/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── api/
│   ├── core/
│   ├── models/
│   └── services/
└── tests/

frontend/
├── app/
│   ├── auth/
│   ├── generate/
│   ├── components/
│   └── templates/
└── tests/

tests/
├── contract/
├── integration/
└── e2e/
```

**Structure Decision**: Se separan `backend/` y `frontend/` para mantener los límites de seguridad
y despliegue. `backend/app/services/` orquesta Azure OpenAI y Supabase; `backend/app/models/`
define los esquemas Pydantic; `frontend/app/templates/` contiene las variantes ATS y visual;
`backend/tests/` conserva pruebas propias del backend, `frontend/tests/` conserva pruebas unitarias
con Vitest, y `tests/` conserva pruebas contractuales, de integración y E2E compartidas.

## Complexity Tracking

> No existen violaciones constitucionales que requieran justificación.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Ninguna | N/A | El diseño respeta los límites y la simplicidad exigidos |
