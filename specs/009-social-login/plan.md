# Implementation Plan: Acceso con Google y Microsoft

**Branch**: `feature_GoogleLogin` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/009-social-login/spec.md`

## Summary

Añadir botones Google y Microsoft a `/auth`, usando el cliente Supabase existente
con PKCE y un Route Handler `/auth/callback` que intercambia el código y escribe
las cookies de sesión en la respuesta antes de redirigir a `/generate`.
Preservar correo/contraseña, SessionProvider y autorización del backend.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19, Next.js 15.
**Primary Dependencies**: `@supabase/ssr` 0.5 y `@supabase/supabase-js` existentes.
**Storage**: Cookies Supabase existentes; sin tablas ni migraciones nuevas.
**Testing**: Vitest/Testing Library, Route Handler con cliente simulado, Playwright.
**Target Platform**: Navegadores web, Next.js en Vercel.
**Project Type**: Aplicación full-stack; esta entrega cambia solo autenticación frontend.
**Performance Goals**: Un clic inicia el proveedor; una sola operación pendiente; sin llamadas nuevas al backend.
**Constraints**: Sin dependencias nuevas, secretos solo en Supabase, sin destinos externos configurables.
**Scale/Scope**: Dos proveedores, una pantalla existente y un callback.

## Constitution Check

- I: PASS. Entrega acotada F1, sin alterar generación ni matching.
- II: PASS. No cambia contratos de CV ni IA.
- III: PASS. No cambia renderizado ni PDF.
- IV: PASS. Supabase Auth sigue siendo el gestor; claves privadas de proveedores solo en su dashboard.
  El backend sigue validando los mismos bearer tokens y propietarios de recursos.
- V: PASS. Pruebas de acciones, UI y callback; regresión de sesión; E2E con transporte simulado.
- Post-design: PASS. Ninguna excepción o modificación de constitución necesaria.

## Project Structure

### Documentation (this feature)

```text
specs/009-social-login/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/auth.md
  tasks.md
```

### Source Code (repository root)

```text
frontend/
  app/auth/actions.ts
  app/auth/page.tsx
  app/auth/callback/route.ts
  app/auth/session-provider.tsx  # reutilizado
  app/lib/supabase.ts           # cliente PKCE existente
  tests/
tests/e2e/social-login.spec.ts
docs/desarrollo.md
```

**Structure Decision**: Mantener acciones junto a la página y añadir solo el Route
Handler requerido. No añadir un servicio OAuth ni duplicar almacenamiento de identidad.

## Complexity Tracking

Sin violaciones.
