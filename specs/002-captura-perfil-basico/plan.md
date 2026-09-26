# Implementation Plan: Captura de perfil básico tras iniciar sesión

**Branch**: `002-captura-perfil-basico` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-captura-perfil-basico/spec.md`

## Summary

Tras iniciar sesión, ofrecer un modal cuando el usuario aún no tenga nombre guardado; guardar sus datos personales de forma aislada por usuario y reutilizarlos en `personalInfo` al generar un CV. Se empleará una tabla Supabase `basic_profiles` con RLS, operaciones FastAPI autenticadas y una combinación determinista campo por campo antes de persistir y devolver el CV. El usuario podrá posponer el modal sin guardar estado parcial.

## Technical Context

**Language/Version**: Python 3.11+ para FastAPI; TypeScript para Next.js 15 y React 19.

**Primary Dependencies**: FastAPI, Pydantic 2, cliente Supabase Python existente, `@supabase/ssr` y `@supabase/supabase-js` existentes; no se añaden dependencias.

**Storage**: Supabase PostgreSQL, tabla `basic_profiles` con una fila por `user_id`, RLS y fecha de actualización.

**Testing**: pytest para contratos e integración; Vitest para lógica frontend pertinente; Playwright para modal, sesión, posponer, guardado y reutilización en el flujo de CV.

**Target Platform**: Navegadores modernos; FastAPI desplegado en Render y Next.js en Vercel.

**Project Type**: Aplicación web full-stack existente con frontend Next.js y backend FastAPI.

**Performance Goals**: El modal se ofrece después de restaurar sesión y determinar que falta el nombre, antes de continuar el flujo privado; las operaciones de perfil no añaden llamadas al modelo de IA. No se introduce un SLO nuevo distinto de los objetivos del MVP existentes.

**Constraints**: Reutilizar Supabase Auth y el bearer token actual; derivar el propietario exclusivamente de `require_user_id`; validar y filtrar por usuario en backend aunque se aplique RLS; nunca aceptar `user_id` desde el cliente; no cambiar las secciones profesionales del contrato CV; conservar el correo del CV separado del correo de acceso; no agregar dependencias ni proveedores.

**Scale/Scope**: Un perfil básico por usuario, seis campos personales, dos operaciones de perfil, modal de post-login y aplicación de datos a `personalInfo`; sin historial de CV, onboarding persistente al posponer ni modo conversacional de preguntas y respuestas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Estado | Justificación |
|---|---|---|
| MVP enfocado | PASS | La feature solo captura y reutiliza datos personales; no añade matching, embeddings, scraping ni jobs. |
| Contrato y validación | PASS | Un DTO Pydantic valida lectura/escritura; el CV sigue validándose con `StructuredCv` antes de guardar o devolver. |
| Separación frontend/backend | PASS | Next.js presenta el modal; FastAPI autentica, valida y persiste. El frontend solo conserva la sesión y llama al backend. |
| Aislamiento y secretos | PASS | El backend obtiene identidad del bearer, filtra cada operación por `user_id` y la tabla aplica RLS. La service-role key permanece en backend. |
| Integración y pruebas | PASS | Se prevén pruebas de contrato, aislamiento entre usuarios, idempotencia/generación y comportamiento UI mediante pytest, Vitest y Playwright existentes. |
| Stack aprobado | PASS | Se utilizan exclusivamente Next.js, FastAPI, Supabase/PostgreSQL y Azure OpenAI ya aprobados; no se incorporan servicios externos ni paquetes. |

### Re-evaluación post-diseño

| Gate | Estado | Evidencia de diseño |
|---|---|---|
| PII e identidad | PASS | El bearer determina al titular; el payload no acepta `user_id`; el backend filtra cada operación y la tabla exige RLS. |
| Fallos recuperables | PASS | La ausencia de fila se representa como `null`; un fallo de lectura es distinto y bloquea generación hasta reintentar; un fallo de escritura conserva el formulario sin confirmar persistencia. |
| Integridad del CV | PASS | El perfil solo prevalece campo por campo en `personalInfo`; el CV combinado se revalida y las otras secciones permanecen intactas. |
| Posponer y sesión | PASS | Posponer no persiste estado; se consulta de nuevo en otro inicio de sesión; al cambiar de usuario se limpia primero el perfil anterior. |
| Tecnologías y alcance | PASS | El diseño no requiere paquetes, proveedores o servicios nuevos y excluye el modo conversacional guiado. |

## Project Structure

### Documentation (this feature)

```text
specs/002-captura-perfil-basico/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/profile-api.md
```

### Source Code (repository root)

```text
backend/
├── app/api/profile.py
├── app/models/profile.py
├── app/services/profile_repository.py
└── supabase/migrations/002_create_basic_profiles.sql

frontend/
├── app/auth/session-provider.tsx
├── app/components/basic-profile-modal.tsx
├── app/generate/page.tsx
├── app/lib/basic-profile-client.ts
└── app/types/profile.ts

tests/
├── contract/test_profile.py
├── integration/test_profile.py
└── e2e/profile.spec.ts
```

**Structure Decision**: Se extiende la aplicación web existente. FastAPI define el contrato, valida el usuario y persiste con el cliente privilegiado y filtros explícitos por `user_id`; una migración dedicada establece unicidad y RLS. Next.js consulta el perfil al restaurar la sesión, presenta el modal y aplica el perfil al resultado validado en el flujo actual de generación. Las pruebas se ubican junto a las suites existentes de contrato, integración y navegador.

## Complexity Tracking

> No hay violaciones de la constitución que requieran justificación.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
