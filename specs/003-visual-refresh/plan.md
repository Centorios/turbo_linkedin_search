# Implementation Plan: Identidad visual

**Branch**: `codex/003-visual-refresh` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary
Enriquecer acceso y generador con un lienzo índigo/verde, bienvenida, superficies con profundidad y estados legibles. Conservar controles, contratos y documentos.

## Technical Context
**Language/Version**: TypeScript, React 19, Next.js 15.
**Primary Dependencies**: Tailwind CSS 4 ya instalado; ninguna nueva dependencia.
**Storage**: Sin cambios.
**Testing**: TypeScript, Vitest y Playwright existentes.
**Target Platform**: Navegadores de escritorio y móvil.
**Project Type**: Aplicación web.
**Performance Goals**: Decoración CSS sin peticiones ni medios externos adicionales.
**Constraints**: Mantener foco, contraste, testids y fondo blanco del CV.
**Scale/Scope**: Acceso, generador, cabecera y estilos globales de la aplicación.

## Constitution Check
PASS antes/después del diseño: alcance MVP, separación de capas y contratos intactos. PDF en cliente. No secretos ni proveedores nuevos. Pruebas de comportamiento existentes y regresión PDF.

## Project Structure
```text
specs/003-visual-refresh/{spec,plan,research,data-model,quickstart,tasks}.md
specs/003-visual-refresh/contracts/ui.md
frontend/app/globals.css
frontend/app/auth/page.tsx
frontend/app/generate/page.tsx
frontend/app/components/app-header.tsx
tests/e2e/visual-refresh.spec.ts
```
**Structure Decision**: Componentes actuales con CSS de aplicación; plantillas de CV intactas.
