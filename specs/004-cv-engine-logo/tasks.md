# Tasks: Logo
**Input**: `specs/004-cv-engine-logo/` design artifacts.

## Phase 1: Setup
- [X] T001 Verificar consumidores de marca en frontend/app/auth/page.tsx y frontend/app/components/app-header.tsx.
## Phase 2: Foundational
- [X] T002 Definir geometría SVG y contrato en specs/004-cv-engine-logo/contracts/ui.md.
## Phase 3: User Story 1 (P1)
**Goal**: Marca hoja/motor. **Independent Test**: acceso y cabecera con nombre accesible.
- [X] T003 [US1] Actualizar símbolo y wordmark accesible en frontend/app/components/brand-logo.tsx.
## Phase 4: User Story 2 (P2)
**Goal**: Icono coherente. **Independent Test**: observar tamaños pequeños.
- [X] T004 [US2] Replicar símbolo sin wordmark en frontend/app/icon.svg.
## Phase 5: Polish
- [X] T005 Validar y registrar resultados en specs/004-cv-engine-logo/validation-results.md.

## Dependencies and Parallel Opportunities
T001 → T002 → T003 → T004 → T005. No beneficio de paralelismo: geometría compartida. MVP US1; entrega ambas historias.

