---

description: "Task list for Basic Profile Capture After Sign-In"
---

# Tasks: Captura de perfil básico tras iniciar sesión

**Input**: Design documents from `/specs/002-captura-perfil-basico/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/profile-api.md, quickstart.md

**Tests**: Required by the project constitution for changes to persistence, authentication, service integration, and critical UI behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an incremental product slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses different files and has no unfinished dependency.
- **[Story]**: Maps a task to a user story from `spec.md`.
- Every task includes an exact repository path.

## Phase 1: Setup

**Purpose**: Reuse the existing stack and confirm no dependency additions are needed.

- [X] T001 Verify FastAPI/Pydantic and Supabase frontend dependencies already exist in `backend/pyproject.toml` and `frontend/package.json`; do not add packages or change dependency manifests.

## Phase 2: Foundational

**Purpose**: Establish shared profile schemas and per-user storage before implementing either story.

- [X] T002 Add profile DTO contract tests for the six string fields, required non-blank `fullName`, optional `email` as `""` or valid email, optional `linkedin`/`website` as `""` or absolute `http`/`https` URLs, extra-field rejection, and omission of client-owned `user_id` in `tests/contract/test_profile.py`.
- [X] T003 [P] Implement strict BasicProfile read/write Pydantic models matching `contracts/profile-api.md` in `backend/app/models/profile.py`.
- [X] T004 [P] Create `basic_profiles` migration with one row per `user_id`, FK cascade to `auth.users`, the six profile fields and `updated_at`, plus RLS `USING`/`WITH CHECK` for `auth.uid() = user_id` in `backend/supabase/migrations/002_create_basic_profiles.sql`.
- [X] T005 [P] Define the frontend `BasicProfile` type matching the six response fields and null-on-missing GET result in `frontend/app/types/profile.ts`.

## Phase 3: User Story 1 - Completar perfil básico después del acceso (Priority: P1)

**Goal**: An authenticated user can save or defer their personal profile after sign-in, with profile ownership enforced.

**Independent Test**: Sign in as a user with no saved name, verify the modal, save a valid profile, sign out and back in, and confirm the saved values remain private to that account. Also defer once and confirm no write occurs and the prompt returns on the next sign-in.

### Tests for User Story 1

- [X] T006 [P] [US1] Add API contract tests for `GET /api/profile` and `PUT /api/profile`, including null profile, save/read shape, missing/invalid/expired bearer, invalid fields, extra `userId`, and safe storage errors in `tests/contract/test_profile_api.py`.
- [X] T007 [P] [US1] Add integration tests for authenticated profile read/write, explicit owner scoping, cross-user denial, and storage failure behavior in `tests/integration/test_profile.py`.

### Implementation for User Story 1

- [X] T008 [P] [US1] Implement profile lookup and upsert with explicit `user_id` filters and no history/query surface in `backend/app/services/profile_repository.py`.
- [X] T009 [US1] Implement authenticated `GET /api/profile` and `PUT /api/profile`, deriving ownership only from `require_user_id` and mapping safe `401`, `422`, and `500` responses in `backend/app/api/profile.py`.
- [X] T010 [US1] Register the profile router without changing the existing `/health` or generation routes in `backend/app/main.py`.
- [X] T011 [P] [US1] Implement the browser profile client that sends the session bearer token and JSON body without `user_id` in `frontend/app/lib/basic-profile-client.ts`.
- [X] T012 [US1] Build the accessible profile dialog with six labelled fields, validation, pending/error states, session-email prefill, and a defer action that performs no write in `frontend/app/components/basic-profile-modal.tsx`.
- [X] T013 [US1] Load profile state for each authenticated session, distinguish `null` from lookup errors, and clear old-user data on sign-out/account change in `frontend/app/auth/session-provider.tsx`.
- [X] T014 [US1] Integrate the modal into the authenticated generation view; allow defer when profile is missing, but block generation after a profile lookup error until a successful retry in `frontend/app/generate/page.tsx`.
- [X] T015 [US1] Follow `.github/instructions/playwright-tests.instructions.md`; explore the running profile UI and capture a current accessibility snapshot before choosing locators, then add Spanish-titled browser tests for prompt, labelled fields, validation, save, defer/re-prompt, and account isolation in `tests/e2e/profile.spec.ts`.

**Checkpoint**: User Story 1 is independently testable; the user can save or defer without exposing another account's profile.

## Phase 4: User Story 2 - Reutilizar el perfil al preparar el CV (Priority: P1)

**Goal**: A saved profile supplies confirmed personal fields to generated CVs while all professional sections remain unchanged.

**Independent Test**: Save a profile, generate a CV from text with missing and conflicting personal details, and verify non-empty profile fields win, empty profile fields fall back to extracted values, and every non-personal section is preserved.

### Tests for User Story 2

- [X] T016 [P] [US2] Add generation integration tests for profile-field precedence, empty-field fallback, unchanged professional sections, profile-read failure before provider/persistence, and current-profile application to idempotent results in `tests/integration/test_generate_cv.py`.
- [X] T017 [P] [US2] Follow `.github/instructions/playwright-tests.instructions.md`; capture a current accessibility snapshot before choosing locators, then add a Spanish-titled browser test that generates and previews a CV using a saved profile and verifies personal fields and professional sections in `tests/e2e/profile-cv.spec.ts`.

### Implementation for User Story 2

- [X] T018 [US2] Read the authenticated profile before provider and idempotency handling, merge non-empty profile fields into `personalInfo`, revalidate with `StructuredCv`, then persist and return the combined result in `backend/app/services/cv_generation.py`.

**Checkpoint**: User Stories 1 and 2 work together; a profile lookup failure never creates a CV with silently omitted confirmed data.

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify the end-to-end design, isolation boundary, and MVP scope.

- [X] T019 [P] Run the profile contract/integration tests, existing generation tests, frontend Vitest, and the profile Playwright scenarios from `specs/002-captura-perfil-basico/quickstart.md`; record results and any environment blockers in `specs/002-captura-perfil-basico/validation-results.md`.
- [X] T020 Run `git diff --check`, verify the migration's RLS policy and owner-scoped repository operations, and confirm no new dependencies or guided conversational flow were added against `specs/002-captura-perfil-basico/plan.md`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Confirms existing dependencies and requires no package changes.
- **Foundational (Phase 2)**: T002 precedes its model implementation; T003-T005 can then proceed in parallel. These tasks block both stories.
- **User Story 1 (Phase 3)**: Contract and integration tests (T006-T007) precede implementation. Repository and frontend client work can proceed in parallel after foundations; session/modal integration follows the profile API/client. Browser test T015 follows UI integration and a real accessibility snapshot.
- **User Story 2 (Phase 4)**: Depends on User Story 1 profile persistence and authentication. Integration and browser tests T016-T017 precede the generation service change T018.
- **Polish (Phase 5)**: Depends on both stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after foundational tasks; no dependency on another story.
- **User Story 2 (P1)**: Starts after User Story 1 because generation requires a saved, authenticated profile; its empty-profile fallback remains covered.

### Parallel Opportunities

- **Foundational**: T003, T004, and T005 touch separate files and can run in parallel after T002.
- **User Story 1**: T006 and T007 use independent test files; after them, repository T008 and frontend client T011 can proceed in parallel. The modal (T012) depends on the API client; session integration (T013) depends on the API client and profile endpoint; page integration (T014) follows both; E2E T015 follows implementation and exploration.
- **User Story 2**: T016 and T017 use separate test files and can run in parallel; T018 follows both.

### Parallel Execution Examples

**User Story 1, after Phase 2**:

```text
T006 API contract tests
T007 Profile integration tests
```

After those tests are in place, repository and browser API client work can proceed independently:

```text
T008 Profile repository
T011 Frontend profile client
```

**User Story 2, after User Story 1**:

```text
T016 Generation integration tests
T017 CV preview browser test
```

Implement T018 after both tests are written and their expected failure is confirmed.

## Implementation Strategy

1. Reuse the current stack and complete the profile schema, migration, and frontend type.
2. Deliver User Story 1 first as the profile-capture increment, validating privacy, save, and defer behavior independently.
3. Deliver User Story 2 by applying the saved profile to validated CV output, preserving idempotency and all professional sections.
4. Run the quickstart checks and scope/security review; no new dependency or guided Q&A mode is part of this feature.

**Suggested MVP scope**: User Story 1. User Story 2 is the next increment that realizes profile reuse in the CV.
