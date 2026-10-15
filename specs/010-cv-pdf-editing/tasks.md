# Tasks: Edición de CV existente desde PDF con IA

**Input**: Design documents from `specs/010-cv-pdf-editing/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/cv-imports.openapi.yaml`, `quickstart.md`

**Tests**: Included because the constitution requires integration tests for persistence/provider contracts and behavioral tests for critical UI journeys.

**Organization**: Tasks are grouped by user story. Each task below follows the required checklist format and names its target file path.

## Phase 1: Setup

**Purpose**: Resolve the explicit dependency approval gate before implementing PDF parsing.

- [x] T001 Obtain explicit user approval to add `pypdf` to `backend/pyproject.toml`; do not implement PDF parsing or install dependencies unless approved.
- [x] T002 Restore backend dependencies after adding approved `pypdf>=6.0,<7.0` to `backend/pyproject.toml`.

---

## Phase 2: Foundational

**Purpose**: Create the shared persistence and data contracts required by all three stories.

- [x] T003 Create the private `cv-sources` bucket and `cv_sources` table, enable per-user access policies, and extend `resumes` with nullable source/version references and `ON DELETE CASCADE` for source-linked versions in `backend/supabase/migrations/009_cv_import_sources.sql`; enforce `file_size_bytes > 0 and <= 10485760`, `page_count between 1 and 20`, a unique `(user_id, request_id)`, and a storage path whose first segment equals `user_id`.
- [x] T004 Define strict source, import, edit-proposal, and saved-version Pydantic models in `backend/app/models/cv_import.py`; require `proposedCv` only when `status=ready` and `questions` only when `status=needs_input`.
- [x] T005 Define matching import, edit, source, and version request/response types in `frontend/app/types/cv-import.ts`.

**Checkpoint**: Persistence migration and shared contracts are ready before any user-story implementation.

---

## Phase 3: User Story 1 - Cargar un CV existente (Priority: P1)

**Goal**: Import a valid text-based PDF, preserve the original privately, and show its content as a structured CV.

**Independent Test**: Import a valid PDF and verify the returned `StructuredCv`, private source object, first history version, and clear errors for invalid, encrypted, oversized, or textless files.

### Tests for User Story 1

- [x] T006 [P] [US1] Add contract tests for successful PDF import, authentication, content type, size/page limits, encrypted/invalid PDFs, and non-extractable text in `tests/contract/test_cv_import.py`.
- [x] T007 [P] [US1] Add integration tests for validated import, per-user source isolation, private object storage, idempotent retry, failure cleanup, and at least 90% successful extraction of a deterministic corpus of ten synthetic valid PDFs in `tests/integration/test_cv_import.py`.
- [x] T008 [P] [US1] Add UI tests for upload progress, successful structured result, cancel/retry, and actionable errors in `frontend/tests/cv-import-editor.test.tsx`.

### Implementation for User Story 1

- [x] T009 [US1] Implement bounded PDF signature, encryption, page-count, and text extraction checks in `backend/app/services/cv_import.py`; reject files above 10 MiB, PDFs above 20 pages, and PDFs without usable text before sending extracted text to Azure OpenAI; decode and sanitize `X-Original-Filename` without using it in the storage key.
- [x] T010 [US1] Implement user-scoped source metadata, private `cv-sources` object storage, idempotent import persistence, and cleanup of partial failures in `backend/app/services/cv_import_repository.py`.
- [x] T011 [US1] Implement authenticated `POST /api/cv-imports` with a bounded request stream, required `X-Original-Filename` header, initial `StructuredCv` validation, source/first-version persistence, and explicit API errors in `backend/app/api/cv_imports.py`; register the router in `backend/app/main.py`.
- [x] T012 [US1] Implement authenticated PDF import using the session token, `application/pdf` body, URL-encoded `X-Original-Filename`, and `Idempotency-Key` in `frontend/app/lib/cv-import-client.ts`.
- [x] T013 [US1] Implement PDF selection, status/error handling, and structured result display in `frontend/app/components/cv-import-editor.tsx`; integrate the import flow into `frontend/app/generate/page.tsx`.

**Checkpoint**: A user can import a supported PDF, review its structured CV, and still access the unchanged private source.

---

## Phase 4: User Story 2 - Solicitar cambios al CV con IA (Priority: P1)

**Goal**: Produce a validated, non-persisted proposal to add, edit, or remove sections and experiences, asking for missing facts rather than inventing them.

**Independent Test**: Submit edit requests against an owned source version and verify proposed changes, unchanged unrelated sections, clarification questions for missing facts, and no persistence before confirmation.

### Tests for User Story 2

- [x] T014 [P] [US2] Add contract tests for ready proposals, clarification responses, invalid model JSON, and request limits in `tests/contract/test_cv_import.py`.
- [x] T015 [P] [US2] Add integration tests for add/edit/delete requests, missing-fact clarification, no proposal persistence, and cross-user/source authorization in `tests/integration/test_cv_import.py`.

### Implementation for User Story 2

- [x] T016 [US2] Add a strict JSON edit prompt and provider method that accept the validated base CV, instruction, and up to three answers in `backend/app/services/azure_openai.py`; forbid unsupported factual claims and cap each answer at 2,000 characters.
- [x] T017 [US2] Implement edit orchestration in `backend/app/services/cv_import.py`; limit instructions to 4,000 characters, validate provider output as `StructuredCv`, derive changed sections from a base/proposal comparison, and return clarification questions without saving a proposal.
- [x] T018 [US2] Implement authenticated `POST /api/cv-imports/{source_id}/edits`, verifying that the base resume belongs to the authenticated user and requested source, in `backend/app/api/cv_imports.py`.
- [x] T019 [US2] Implement the edit-request client call and typed handling for `needs_input` and `ready` responses in `frontend/app/lib/cv-import-client.ts`.
- [x] T020 [US2] Implement natural-language instructions, clarification answers, changed-section review, and proposal discard in `frontend/app/components/cv-import-editor.tsx`.

**Checkpoint**: A user can request edits and inspect or discard a proposal without changing saved history.

---

## Phase 5: User Story 3 - Revisar y guardar el CV actualizado (Priority: P2)

**Goal**: Let the user correct and confirm a proposal, save it as a new version, and access both the new CV and unchanged PDF source.

**Independent Test**: Confirm one proposal, verify a new linked history record and PDF export, and verify the original version and source PDF are unchanged and inaccessible to another account.

### Tests for User Story 3

- [x] T021 [P] [US3] Add contract tests for confirmation, invalid `StructuredCv`, idempotent save, source-PDF download, and `DELETE /api/cv-imports/{source_id}` responses in `tests/contract/test_cv_import.py`.
- [x] T022 [P] [US3] Add integration tests for parent/source linkage, original-version preservation, file download authorization, save retries, and consistent deletion of source objects and all linked versions in `tests/integration/test_cv_import.py`.

### Implementation for User Story 3

- [x] T023 [US3] Implement creation/retrieval of version-linked `resumes` rows and atomic source deletion with compensation for partial storage/database failures, verifying ownership and preserving legacy null references, in `backend/app/services/cv_import_repository.py` and `backend/app/services/resume_repository.py`.
- [x] T024 [US3] Implement authenticated save-version, private source-download, and source-delete operations with `StructuredCv` validation and explicit storage/persistence errors in `backend/app/api/cv_imports.py`.
- [x] T025 [US3] Implement save-version, source-download, and source-delete client calls in `frontend/app/lib/cv-import-client.ts`; expose confirmation, saved-version state, source deletion confirmation, preview, and PDF export in `frontend/app/components/cv-import-editor.tsx` and `frontend/app/generate/page.tsx`.
- [x] T026 [US3] Add an end-to-end test covering PDF import, AI edit proposal, explicit confirmation, new version/PDF export, original-file preservation, source deletion, and cross-account denial in `tests/e2e/cv-import-edit.spec.ts`.

**Checkpoint**: A user can confirm edits into a separate version, export that version, and retrieve the untouched original PDF.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete flow and ensure operational guidance matches the implementation.

- [ ] T027 Run the backend, frontend, and end-to-end scenarios from `specs/010-cv-pdf-editing/quickstart.md`; record PDF corpus success, request latency, user-test completion rate, and deletion verification for `SC-001`, `SC-002`, `SC-005`, and `SC-006`; resolve failures and update the guide if actual commands or outcomes differ.

**Verification status**: The live application was explored with accessibility snapshots, and both scenarios in `tests/e2e/cv-import-edit.spec.ts` passed. The full Playwright run reported 33 passed and 15 failed; the failures are in other existing E2E scenarios, including missing `E2E_*` credentials and unrelated UI expectations. Backend (24 tests), frontend (108 tests), TypeScript, and production build passed earlier in implementation. A representative external PDF corpus, request-latency measurements, and user-test completion rate have not been collected, so T027 remains open.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 requires explicit user approval; T002 is blocked until T001 is approved.
- **Foundational (Phase 2)**: Depends on T002; blocks all user-story phases.
- **User Story 1 (Phase 3)**: Depends on setup and foundation.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because edits require an imported source and saved base version.
- **User Story 3 (Phase 5)**: Depends on User Stories 1 and 2 because confirmation requires a proposal based on an imported version.
- **Polish (Phase 6)**: Depends on all three user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after foundational work; no dependency on another user story.
- **US2 (P1)**: Starts after US1; requires the imported CV and its ownership relationship.
- **US3 (P2)**: Starts after US1 and US2; saves and exports an approved proposal.

### Within Each User Story

- Write contract, integration, and UI tests before implementing their corresponding flow; verify tests fail for the missing behavior.
- Complete the shared data model before services, services before endpoints, and endpoints before frontend integration.
- Keep unrelated test files parallelizable; tasks that edit the same service, API, client, or test file remain sequential.
- The E2E task must follow `.github/instructions/playwright-tests.instructions.md` and take a page snapshot before authoring selectors.

### Parallel Opportunities

- After approval and foundational work, the US1 contract, integration, and UI test files can be authored in parallel.
- The US2 contract and integration tests can be authored in parallel.
- The US3 contract and integration tests can be authored in parallel.
- User stories remain sequential in this plan because US2 consumes the source created in US1 and US3 consumes the proposal created in US2.

## Parallel Example: User Story 1

```text
Task: T006 - contract tests in tests/contract/test_cv_import.py
Task: T007 - integration tests in tests/integration/test_cv_import.py
Task: T008 - UI tests in frontend/tests/cv-import-editor.test.tsx
```

## Parallel Example: User Story 2

```text
Task: T014 - contract tests in tests/contract/test_cv_import.py
Task: T015 - integration tests in tests/integration/test_cv_import.py
```

## Parallel Example: User Story 3

```text
Task: T021 - contract tests in tests/contract/test_cv_import.py
Task: T022 - integration tests in tests/integration/test_cv_import.py
```

## Implementation Strategy

### MVP First

1. Obtain explicit dependency approval; do not install or add `pypdf` before that approval.
2. Complete setup and foundational tasks.
3. Complete US1 to import and structure a PDF.
4. Complete US2 to propose truthful edits.
5. Include the minimum US3 confirmation and version save before treating the feature as usable; never ship an auto-save-only AI edit flow.

### Incremental Delivery

1. Deliver PDF import and original preservation (US1).
2. Add AI proposals and clarification handling (US2).
3. Add review, confirmation, version history, download, and export (US3).
4. Run the full quickstart scenarios and retain existing text-generated CV behavior.

## Notes

- `[P]` tasks edit separate files and can run concurrently; all story tasks have a story label.
- Existing CVs retain nullable source/version links and continue using the existing `StructuredCv` contract.
- If approval for `pypdf` is declined, stop before T002 and revise this plan rather than substituting an unapproved package.
