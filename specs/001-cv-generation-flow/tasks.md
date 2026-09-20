---

description: "Task list for End-to-End CV Generation Flow"
---

# Tasks: End-to-End CV Generation Flow

**Input**: Design documents from `/specs/001-cv-generation-flow/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included because the plan and quickstart require contract, integration and E2E validation.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after its prerequisites.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses different files and has no unfinished dependency.
- **[Story]**: Maps the task to a user story from `spec.md`.
- Every task includes an exact repository path.

## Path Conventions

- Backend: `backend/app/` and `backend/tests/`
- Frontend: `frontend/app/` and `frontend/tests/`
- Shared tests: `tests/contract/`, `tests/integration/`, `tests/e2e/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the web application boundaries and local configuration without exposing secrets.

- [X] T001 Create the backend package structure in `backend/app/{api,core,models,services}` and `backend/tests/`.
- [X] T002 Create the frontend Next.js App Router structure in `frontend/app/{auth,generate,components,templates}` and `frontend/tests/`.
- [X] T003 [P] Add backend dependency and tooling configuration for Python 3.11+, FastAPI, Pydantic and pytest in `backend/pyproject.toml`.
- [X] T004 [P] Add frontend dependency and tooling configuration for Next.js, TypeScript, Supabase client, `@react-pdf/renderer`, Vitest and Playwright in `frontend/package.json`.
- [X] T005 [P] Add backend environment template with non-secret variable names for Azure OpenAI, PostgreSQL and Supabase in `backend/.env.example`.
- [X] T006 [P] Add frontend environment template containing only public Supabase configuration and backend base URL in `frontend/.env.example`.
- [X] T007 Add local development and test commands for backend and frontend in `README.md`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared contracts, security boundaries, persistence and test fixtures before user stories.

- [X] T008 Define the validated CV Pydantic models, including `personalInfo`, `summary`, `experience`, `education`, `skills`, `languages` and `certifications`, in `backend/app/models/cv.py`.
- [X] T009 Define date validation accepting exactly `MM-YYYY` or `YYYY` in `backend/app/models/cv.py`.
- [X] T010 Define conditional contact validation in `backend/app/models/cv.py`: `email` accepts `""` or a valid email, and `linkedin`/`website` accept `""` or valid `http`/`https` URLs.
- [X] T011 [P] Add the frontend TypeScript CV contract matching `contracts/cv-schema.json` in `frontend/app/types/cv.ts`.
- [X] T012 [P] Configure backend contract tests to load the single source of truth `specs/001-cv-generation-flow/contracts/cv-schema.json` without copying or duplicating it in `backend/tests/fixtures/`.
- [X] T013 Create Supabase client configuration with backend-only privileged access and explicit environment-variable checks in `backend/app/core/supabase.py`.
- [X] T014 Create frontend Supabase client configuration using only public URL/key variables in `frontend/app/lib/supabase.ts`.
- [X] T015 Implement bearer-token validation against Supabase and return the authenticated user ID in `backend/app/core/auth.py`.
- [X] T016 Create the `resumes` persistence adapter with `user_id`, `request_id`, validated JSON data and `created_at`, scoped to the authenticated user and without exposing a CV history query in the MVP, in `backend/app/services/resume_repository.py`.
- [X] T017 Add the unique `(user_id, request_id)` idempotency constraint and row-level isolation policy for `resumes`; do not create history query endpoints, in `backend/supabase/migrations/001_create_resumes.sql`.
- [X] T018 [P] Add backend contract tests for the CV schema, `MM-YYYY`/`YYYY` dates, empty-string fields, empty arrays and contact formats in `tests/contract/test_cv_schema.py`.
- [X] T019 [P] Add authentication and ownership integration fixtures with valid, expired and cross-user tokens in `tests/integration/conftest.py`.
- [X] T020 Add a frontend API client that sends `Authorization: Bearer <token>`, `Content-Type: application/json` and `Idempotency-Key` without sending `userId` in `frontend/app/lib/generate-cv-client.ts`.

## Phase 3: User Story 1 - Crear cuenta e iniciar sesión (Priority: P1)

**Goal**: A user can register, sign in, retain a valid session and reach protected CV functionality.

**Independent Test**: Create an account, sign in, reload the app, sign out and confirm unauthenticated access to the private flow is denied.

- [X] T021 [P] [US1] Implement email/password registration and sign-in actions in `frontend/app/auth/actions.ts`.
- [X] T022 [P] [US1] Build the registration and sign-in form with accessible labels, validation messages and stable `data-testid` values in `frontend/app/auth/page.tsx`.
- [X] T023 [US1] Implement session restoration and protected-route handling for the generation flow in `frontend/app/auth/session-provider.tsx`.
- [X] T024 [US1] Add sign-out behavior and expired-session handling in `frontend/app/components/auth-controls.tsx`.
- [X] T025 [P] [US1] Add browser tests for registration, valid sign-in, invalid credentials, session restoration and sign-out in `tests/e2e/auth.spec.ts`.
- [X] T026 [US1] Add backend integration tests proving missing, invalid and expired bearer tokens cannot process protected requests in `tests/integration/test_auth.py`.

## Phase 4: User Story 2 - Generar y revisar un CV (Priority: P1)

**Goal**: An authenticated user submits non-empty professional text and receives a validated, persisted CV preview.

**Independent Test**: Submit representative text containing contact information, work, education, skills, language and certification; confirm the loading state, validated response, persistence ownership and recoverable failures.

- [X] T027 [P] [US2] Implement the strict JSON-only Azure OpenAI System Prompt with no invented data and the required CV sections in `backend/app/services/azure_openai.py`.
- [X] T028 [P] [US2] Implement Azure OpenAI configuration loading and provider-safe error mapping without logging keys, prompts or connection strings in `backend/app/core/settings.py`.
- [X] T029 [P] [US2] Implement request and response DTOs for non-empty text, UUID idempotency keys and validated CV output in `backend/app/models/generate_cv.py`.
- [X] T030 [US2] Implement the synchronous generation service: authenticate, check idempotency, call Azure OpenAI GPT-4o, validate the response and persist only valid JSON in `backend/app/services/cv_generation.py`.
- [X] T031 [US2] Implement `POST /api/generate-cv` with the documented 400, 401, 422, 502 and 500 error codes and user-safe messages in `backend/app/api/generate_cv.py`.
- [X] T032 [US2] Register the generation router and application health endpoint in `backend/app/main.py`.
- [X] T033 [P] [US2] Add contract tests for request headers, response shape, error codes, secret redaction and rejection of client-supplied `userId` in `tests/contract/test_generate_cv.py`.
- [X] T034 [P] [US2] Add integration tests for successful generation, invalid model JSON, provider failure, expired session, persistence ownership and repeated idempotency key in `tests/integration/test_generate_cv.py`.
- [X] T035 [P] [US2] Build the professional text input form with empty-input validation, loading state, retry message and stable `data-testid` values in `frontend/app/generate/page.tsx`.
- [X] T036 [P] [US2] Build the structured CV preview data adapter and empty-section handling in `frontend/app/components/cv-preview.tsx`.
- [X] T037 [P] [US2] Build the Minimalista ATS template consuming only the validated CV object in `frontend/app/templates/minimalista-ats.tsx`.
- [X] T038 [P] [US2] Build the Creativo PDF template consuming only the validated CV object in `frontend/app/templates/creativo-pdf.tsx`.
- [X] T039 [US2] Add template selection state that switches between ATS and visual views without transforming or losing contract fields in `frontend/app/components/template-selector.tsx`.
- [X] T040 [US2] Wire the authenticated form to `POST /api/generate-cv`, pass the session access token and idempotency key, and display success/error states in `frontend/app/generate/page.tsx`.
- [X] T041 [P] [US2] Add browser tests for empty input, loading state, successful structured preview, incomplete source data and recoverable generation errors in `tests/e2e/generate-cv.spec.ts`.

## Phase 5: User Story 3 - Descargar el CV en PDF (Priority: P2)

**Goal**: A user can switch templates and download the validated preview as a readable PDF generated in the browser.

**Independent Test**: Use a valid CV fixture, switch between both templates, download once, and confirm the PDF action remains safe during an in-progress download.

- [X] T042 [P] [US3] Create the shared PDF document mapping for the validated CV contract in `frontend/app/templates/cv-pdf-document.tsx`.
- [X] T043 [P] [US3] Implement browser-side PDF generation with `@react-pdf/renderer` and a disabled/in-progress state in `frontend/app/components/pdf-download.tsx`.
- [X] T044 [US3] Add the download action to the generation view and preserve the selected template and validated data in `frontend/app/generate/page.tsx`.
- [X] T045 [P] [US3] Add browser tests for PDF download, minimal content, both templates and duplicate-click protection in `tests/e2e/download-pdf.spec.ts`.
- [X] T046 [P] [US3] Add Vitest PDF document tests covering empty arrays, `""` fields, `MM-YYYY`/`YYYY` dates and certifications in `frontend/tests/cv-pdf-document.test.tsx`.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the integrated MVP, security boundary and operational readiness.

- [ ] T047 [P] Add end-to-end integration coverage for the quickstart authenticated generation scenario in `tests/integration/test_full_flow.py`.
- [ ] T048 [P] Add accessibility checks for auth, textarea, loading/error states, template selection and PDF action in `tests/e2e/accessibility.spec.ts`.
- [ ] T049 Add structured safe logging for request IDs, outcome codes and latency while excluding tokens, prompts, CV text and connection strings in `backend/app/core/logging.py`.
- [ ] T050 Add Render deployment configuration with backend-only secrets in `render.yaml`.
- [ ] T051 Add Vercel deployment configuration with only public frontend variables in `vercel.json` and `frontend/.env.example`.
- [ ] T052 Add a security review checklist for bundles, responses, logs and repository files in `docs/security-review.md`.
- [ ] T053 Run backend pytest contract/integration tests, frontend Vitest tests and Playwright scenarios documented in `specs/001-cv-generation-flow/quickstart.md`; execute at least 30 valid requests, calculate the $T_0$/$T_f$ p90, and record outcomes in `specs/001-cv-generation-flow/validation-results.md`.
- [ ] T054 Run `git diff --check` and verify all implementation tasks preserve the MVP exclusions in `specs/001-cv-generation-flow/plan.md`.

## Dependencies and Execution Order

### Dependency Graph

- Setup: T001-T007 must complete before foundational work.
- Foundational: T008-T020 must complete before user stories.
- US1: T021-T026 depends on T014-T015 and can complete independently after foundations.
- US2: T027-T041 depends on T008-T020 and requires US1 session behavior for the authenticated UI.
- US3: T042-T046 depends on the validated preview from US2, especially T036-T040.
- Polish: T047-T054 depends on the relevant completed story phases.

### Parallel Opportunities

- Setup: T003-T006 can run in parallel after T001-T002.
- Foundations: T011-T012, T018-T019 and T020 can run in parallel after the base structure; T013-T017 remain ordered around auth and persistence.
- US1: T021-T022 and T025-T026 can proceed in parallel after shared auth configuration; T023-T024 depend on the auth actions.
- US2: T027-T029, T033-T034 and T035-T038 can proceed in parallel after foundations; T030-T032 and T039-T040 integrate their outputs.
- US3: T042-T043 and T045-T046 can proceed in parallel; T044 integrates the download component.
- Polish: T047-T052 can proceed in parallel once their dependent stories are complete.

## Implementation Strategy

1. Complete Setup and Foundational phases to establish secure boundaries and the canonical contract.
2. Deliver US1 as the first independently testable increment for authentication and protected access.
3. Deliver US2 as the MVP value increment: strict JSON generation, persistence and preview.
4. Deliver US3 as the export increment: browser-side PDF for both templates.
5. Finish cross-cutting security, accessibility, observability and full-flow validation.

**Suggested MVP scope**: US1 plus US2. US3 is the next increment required for the complete PDF-export MVP.
