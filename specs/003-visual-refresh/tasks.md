# Tasks: Identidad visual

**Input**: `specs/003-visual-refresh/` spec, plan, research, data-model y contracts.

## Phase 1: Setup
- [X] T001 Verificar dependencias e ignores existentes en frontend/package.json y .gitignore.

## Phase 2: Foundational
- [X] T002 Incorporar tokens y clases decorativas sin tintar documentos en frontend/app/globals.css.

## Phase 3: User Story 1 (P1)
**Goal**: Acceso con identidad. **Independent Test**: acceso móvil/escritorio, tabs y foco.
- [X] T003 [US1] Crear prueba de acceso responsive y navegación por teclado en tests/e2e/visual-refresh.spec.ts.
- [X] T004 [US1] Diseñar introducción y formulario en frontend/app/auth/page.tsx.

## Phase 4: User Story 2 (P2)
**Goal**: Generador con jerarquía. **Independent Test**: generación y documentos existentes.
- [X] T005 [US2] Diseñar bienvenida y paneles en frontend/app/generate/page.tsx.
- [X] T006 [US2] Aplicar estilo a cabecera en frontend/app/components/app-header.tsx.

## Phase 5: Polish
- [X] T007 Ejecutar validación y registrar resultados en specs/003-visual-refresh/validation-results.md.

## Dependencies and Parallel Opportunities
T001 → T002 → US1 → US2 → T007. T004 y T006 afectan archivos separados y podrían ejecutarse en paralelo tras T002; ejecución secuencial para simplificar. MVP: US1; entregar ambas historias en esta PR.

