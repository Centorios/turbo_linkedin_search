---

description: "Task list for Evidence-Based Career and Competency Assistance"
---

# Tasks: Enriquecimiento de trayectoria y competencias

**Input**: Design documents from `/specs/002-enriquecimiento-trayectoria/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/trajectory-assistance.md, quickstart.md

**Tests**: Required by the project constitution for AI contracts, integration boundaries, and critical UI behavior.

**Organization**: Tasks are grouped by user story; shared schemas/provider foundations precede both stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable work in separate files with no unfinished dependency.
- **[Story]**: User story label from `spec.md`; setup/foundational/polish tasks have no story label.
- Every task includes an exact repository path.

## Phase 1: Setup

**Purpose**: Confirm use of approved technologies and avoid unnecessary dependencies.

- [X] T001 Verify the existing Azure OpenAI, FastAPI/Pydantic, Next.js and Supabase dependencies in `backend/pyproject.toml` and `frontend/package.json`; do not add packages or change dependency manifests.

## Phase 2: Foundational

**Purpose**: Define and validate the shared assistance response contract and Azure provider boundary.

- [X] T002 [P] Add Pydantic contract tests for `sourceText`, ordered `answers`, strict `needs_input`/`ready` variants, proposal kinds, evidence arrays and development recommendation shape in `tests/contract/test_trajectory_assistance.py`.
- [X] T003 Implement strict assistance request/response DTOs with forbidden extra fields and discriminated `state` in `backend/app/models/trajectory_assistance.py`.
- [X] T004 [P] Add Azure provider contract tests for JSON-only assistance output, safe provider failures and no request to a browser-facing URL in `tests/contract/test_trajectory_provider.py`.
- [X] T005 Extend the existing Azure OpenAI provider with a structured assistance-turn method and explicit factuality/evidence prompt in `backend/app/services/azure_openai.py`.

## Phase 3: User Story 1 - Mejorar la descripción de la trayectoria profesional (Priority: P1)

**Goal**: The user can clarify missing career facts, review factual rewrites, and choose what to include in the CV.

**Independent Test**: Submit a source with an unquantified outcome, receive a relevant follow-up question, state that the metric is unknown, then review and edit/accept a grounded achievement. Verify no unsupported metric is introduced and rejected/pending proposals are excluded from CV generation.

### Tests for User Story 1

- [X] T006 [P] [US1] Add integration tests for turn sequencing, non-empty literal evidence validation, invalid evidence rejection, unanswered questions, safe Azure failure, and authenticated ownership in `tests/integration/test_trajectory_assistance.py`.
- [X] T007 [P] [US1] Add API contract tests for `POST /api/trajectory-assistance/turn`, bearer errors, empty input, strict JSON responses and privacy-safe validation/provider errors in `tests/contract/test_trajectory_assistance_api.py`.

### Implementation for User Story 1

- [X] T008 [US1] Implement the stateless turn service that sends source text and previous answers to Azure, validates each evidence quote against those inputs, and maps invalid model output to a safe error in `backend/app/services/trajectory_assistance.py`.
- [X] T009 [US1] Implement authenticated `POST /api/trajectory-assistance/turn` with safe `401`, `422`, `502`, and `500` responses in `backend/app/api/trajectory_assistance.py`.
- [X] T010 [US1] Register the trajectory assistance router without changing the existing health or CV generation routes in `backend/app/main.py`.
- [X] T011 [P] [US1] Define TypeScript request, `needs_input`/`ready` response, proposal, evidence and decision-state types in `frontend/app/types/trajectory-assistance.ts`.
- [X] T012 [P] [US1] Implement the authenticated turn client that sends the bearer, source text and prior answers without `user_id` in `frontend/app/lib/trajectory-assistance-client.ts`.
- [X] T013 [US1] Build the accessible trajectory assistant UI for follow-up questions and factual proposals with editable text plus accept/reject actions in `frontend/app/components/trajectory-assistant.tsx`.
- [X] T014 [US1] Integrate the assistant into the generation view, preserve temporary turns in memory, discard them on session change/exit, and append only accepted/edited factual proposals to the existing generation text in `frontend/app/generate/page.tsx`.
- [X] T015 [US1] Follow `.github/instructions/playwright-tests.instructions.md`; explore the running trajectory assistant and capture a current accessibility snapshot before choosing locators, then add Spanish-titled question, unknown-answer, accept/edit/reject, and final-generation tests in `tests/e2e/trajectory-assistance.spec.ts`.

**Checkpoint**: User Story 1 is independently usable; facts are clarified or omitted and the user controls which grounded rewrite reaches the CV.

## Phase 4: User Story 2 - Identificar y desarrollar competencias (Priority: P1)

**Goal**: The user can review evidence-backed competency proposals and receive separate actions for competencies to develop.

**Independent Test**: Provide responsibilities and outcomes, verify each demonstrated competency includes a matching evidence quote, then accept one, reject another and review development actions. Confirm rejected proposals and recommendations are not added to the CV skills.

### Tests for User Story 2

- [X] T016 [P] [US2] Add integration tests proving demonstrated competencies have evidence, development recommendations remain separate, and invalid/unsubstantiated competencies are not returned as demonstrated in `tests/integration/test_competency_development.py`.
- [X] T017 [P] [US2] Follow `.github/instructions/playwright-tests.instructions.md`; capture a current accessibility snapshot before choosing locators, then add Spanish-titled tests that distinguish demonstrated competencies from development recommendations and verify accept/reject behavior in `tests/e2e/competency-development.spec.ts`.

### Implementation for User Story 2

- [X] T018 [US2] Extend the assistance service to classify evidence-backed competencies separately from learning recommendations and reject demonstrated skills without valid evidence in `backend/app/services/trajectory_assistance.py`.
- [X] T019 [US2] Extend the assistant UI to label competency state/evidence and present development actions without adding them to generated `skills` in `frontend/app/components/trajectory-assistant.tsx`.

**Checkpoint**: User Stories 1 and 2 work together; factual achievements/skills are user-approved and development ideas remain recommendations.

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validate factual integrity, authentication boundaries and the approved MVP scope.

- [X] T020 Run the focused pytest, Vitest and Playwright scenarios from `specs/002-enriquecimiento-trayectoria/quickstart.md`, record outcomes or environment blockers in `specs/002-enriquecimiento-trayectoria/validation-results.md`, run `git diff --check`, and confirm no conversation storage, new dependencies, or fictional profile claims were added against `specs/002-enriquecimiento-trayectoria/plan.md`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Confirms current packages and requires no dependency changes.
- **Foundational (Phase 2)**: T002 precedes DTO implementation T003; T004 precedes provider change T005. Both shared foundations block user stories.
- **User Story 1 (Phase 3)**: Tests T006-T007 precede the API/service implementation. Service T008 follows model/provider foundations; route T009 follows the service; UI/client integration follows the API contract. E2E T015 follows UI and real accessibility exploration.
- **User Story 2 (Phase 4)**: Depends on the assistant/API/UI established by US1. Tests T016-T017 precede competency behavior changes T018-T019.
- **Polish (Phase 5)**: Depends on both stories.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after foundational tasks and has no dependency on another story.
- **User Story 2 (P1)**: Extends US1's proposal/review flow, so it starts after US1's shared turn and UI contracts are complete.

### Parallel Opportunities

- **Foundational**: T002 model tests and T004 provider tests can be prepared in parallel in separate files; T003 follows T002 and T005 follows T004.
- **User Story 1**: T006 service integration tests and T007 API contract tests use separate files; T011 frontend types and T012 client can be implemented in parallel after the shared response contract. UI T013 depends on types/client; page integration T014 follows UI/client; E2E T015 follows implementation and snapshots.
- **User Story 2**: T016 integration and T017 E2E tests are independent files and may be prepared in parallel after US1; T018 service and T019 UI behavior follow their tests and touch separate files.

### Parallel Execution Examples

**User Story 1, after Phase 2**:

```text
T006 Trajectory assistance integration tests
T007 Assistance API contract tests
```

After the contract is fixed, independent frontend scaffolding can proceed together:

```text
T011 Frontend assistance types
T012 Authenticated turn client
```

**User Story 2, after User Story 1**:

```text
T016 Competency evidence integration tests
T017 Competency/development E2E tests
```

Implement service classification T018 and UI separation T019 only after their expected test failures are observed.

## Implementation Strategy

1. Reuse existing dependencies; establish strict DTOs and Azure response handling.
2. Deliver User Story 1 as the MVP increment for factual trajectory clarification and reviewed rewrites.
3. Deliver User Story 2 as a separate increment for evidence-backed competencies and clearly distinct development actions.
4. Run quickstart checks and security/factual-integrity review; do not persist conversation state or introduce fictional professional claims.

**Suggested MVP scope**: User Story 1. User Story 2 is the next increment after the question/review flow is stable.
