# Validation Results: Captura de perfil básico

## Automated Checks

| Check | Result | Notes |
|---|---|---|
| Profile model and API contract tests | PASS: 17 passed | Included in the backend total below; covers validation, safe 422, authentication, and storage errors. |
| Backend contract and integration suites | PASS: 51 passed | `pytest tests/contract tests/integration`; two existing Starlette deprecation warnings. |
| Frontend Vitest | PASS: 21 passed | Existing PDF document tests; Vite reports its existing CJS API deprecation warning. |
| Frontend TypeScript | PASS | `npx tsc --noEmit`. |
| Frontend production build | PASS | `next build` compiled, linted, type-checked, and generated all routes. |
| RLS and ownership review | PASS, static | Migration enables RLS with `auth.uid() = user_id`; repository reads filter by the authenticated ID and upserts use it as conflict key. A live Supabase migration/RLS session was not run. |
| Frontend secret scan | PASS, static | No `SUPABASE_SERVICE_ROLE_KEY` reference found in frontend application sources. |
| `git diff --check` | PASS | No whitespace errors. |
| Playwright test discovery | PASS: 20 tests in 5 files | `npx playwright test --list` loaded existing and new specs. |

## Browser Validation and Blockers

- **Manual browser exploration**: PASS with a synthetic Supabase cookie and intercepted local APIs. Snapshots were captured for the profile modal, read-error state, generation view, and CV preview. Locators in the new profile specs come from those snapshots; no real account or external profile data was used.
- **Playwright execution**: BLOCKED before test bodies. All 19 discovered test launches failed because Chromium's `chrome-headless-shell` executable is absent at the Playwright cache path. No assertion failures were observed because the browser did not launch; no browser binary was installed.
- **Live backend and Supabase RLS**: NOT RUN. FastAPI was not listening on `127.0.0.1:8000` during browser exploration. Backend behavior was validated with dependency-injected auth and repository fakes; the migration's RLS policy was statically reviewed.

## Scope Check

- No package dependency was added or changed.
- No guided conversational Q&A mode, CV history, or matching functionality was added.
- Existing CV sections are preserved when profile values are merged into `personalInfo`.