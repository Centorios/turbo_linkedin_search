# Validation Results: End-to-End CV Generation Flow

## Automated Checks

| Check | Result | Notes |
|---|---|---|
| Backend contract and integration tests | PASS: 17 passed | Includes authenticated full-flow ownership and safe-logging regression tests. Two existing Starlette deprecation warnings were reported. |
| Frontend Vitest | PASS: 21 passed | Executed from `frontend/`. |
| Frontend production build | PASS | `next build` compiled, linted, type-checked, and generated all routes. |
| Browser bundle scan | PASS | No backend-only key names found in 34 files under `frontend/.next/static/`. |
| Tracked environment-file check | PASS | Only `backend/.env.example` and `frontend/.env.example` are tracked. |
| Render Blueprint | PASS | YAML parses; backend service and dashboard-only runtime variables verified. |
| Vercel configuration | PASS | JSON parses; build targets `frontend/`; sample environment contains only `NEXT_PUBLIC_*` variables. |
| `git diff --check` and MVP scope | PASS | No whitespace errors; scraping, queues, embeddings, matching, and CV history remain excluded. |

## Browser and Performance Validation

| Check | Result | Notes |
|---|---|---|
| Playwright suite | BLOCKED | `npx playwright test --reporter=list` could not load `@playwright/test` from `frontend/node_modules`; no dependency was installed. E2E credentials `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SIGNUP_EMAIL`, and `E2E_SIGNUP_PASSWORD` are also unset. |
| Accessibility exploration for T048 | BLOCKED | The required exploration URL `http://localhost:5173` did not respond before any accessibility spec was written. No selectors were inferred and no test file was added. |
| 30 valid requests and $T_0$/$T_f$ p90 | NOT RUN | A valid authenticated account and consent for 30 Azure calls and Supabase writes are required. No latency sample or p90 is claimed. |

## Outstanding Validation

- Run the Playwright scenarios after `@playwright/test` and the required E2E account variables are available.
- Explore the running application at the required URL, then add and run the accessibility checks from real accessibility snapshots.
- With an authorized test account and configured services, execute at least 30 valid generation requests; measure $T_0$ at the Generate CV action and $T_f$ when the validated preview renders, calculate p90, and append the measurements here.