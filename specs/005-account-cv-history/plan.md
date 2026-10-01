# Implementation Plan: Historial de cuenta
**Branch**: `codex/005-account-cv-history` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary
Exponer lecturas autenticadas de `resumes` ya persistidos, con paginación y snapshots originales. Crear `/history` con lista, detalle, selector y PDF reutilizados.

## Technical Context
**Language/Version**: Python 3.11+, TypeScript, React 19, Next.js 15.
**Primary Dependencies**: FastAPI, Pydantic, Supabase, React PDF y herramientas de test existentes.
**Storage**: PostgreSQL/Supabase tabla `resumes` existente; sin migración obligatoria.
**Testing**: pytest integración/contrato, Vitest comportamiento, Playwright sintético y PDF existente.
**Target Platform**: Navegador escritorio/móvil; FastAPI.
**Project Type**: Web full-stack.
**Performance Goals**: Páginas por defecto de 20, máximo 50 registros; no llamadas IA al recuperar.
**Constraints**: Propietario desde bearer validado, filtros explícitos por usar cliente admin; JSON validado antes de devolver.
**Scale/Scope**: Lista/detalle, navegación, snapshots y descarga. Sin borrado ni edición.

## Constitution Check
PASS antes/después: MVP, esquema validado, Supabase Auth y dueño en cada consulta. PDF exclusivamente cliente. Incluye integración y comportamiento crítico. Ninguna dependencia, proveedor o secreto nuevo.

## Project Structure
- backend/app/models/resume_history.py
- backend/app/api/resumes.py
- backend/app/services/resume_repository.py
- backend/app/main.py
- frontend/app/{history/page.tsx,lib/resume-history-client.ts,types/resume-history.ts}
- frontend/app/{auth/session-provider.tsx,components/app-header.tsx}
- tests/integration/test_resume_history.py
- frontend/tests/resume-history.test.tsx
- tests/e2e/resume-history.spec.ts
- specs/005-account-cv-history/: diseño y validación.

**Structure Decision**: Reutilizar persistencia, autenticación y renderizado existentes. Lecturas sin overlay de perfil.
