# Implementation Plan: Logo CV + motor

**Branch**: `codex/004-cv-engine-logo` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary
Extender el sistema SVG actual con hoja plegada, líneas de CV y bloque de motor. Reutilizar símbolo en componente e icono.

## Technical Context
**Language/Version**: TypeScript, React 19, Next.js 15, SVG.
**Primary Dependencies**: Existentes; ninguna nueva.
**Storage**: Sin cambios.
**Testing**: TypeScript, build y observación en navegador.
**Target Platform**: Navegadores móvil/escritorio.
**Project Type**: Aplicación web.
**Performance Goals**: Vector pequeño y sin peticiones externas.
**Constraints**: Nombre accesible, proporciones y sin IDs SVG duplicados.
**Scale/Scope**: Dos archivos de marca.

## Constitution Check
PASS antes/después: MVP, sin cambios de contratos o seguridad. PDF intacto y sin instalación.

## Project Structure
- frontend/app/components/brand-logo.tsx
- frontend/app/icon.svg
- specs/004-cv-engine-logo/: spec, plan, research, data-model, contracts/ui, quickstart, tasks.

**Structure Decision**: Extender vector existente; no raster ni proveedor nuevo.
