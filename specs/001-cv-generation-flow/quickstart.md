# Quickstart: End-to-End CV Generation Flow

## Prerequisites

- Python 3.11+ and a virtual environment with backend dependencies.
- Node.js LTS with frontend dependencies.
- Supabase project configured for Auth and PostgreSQL.
- Azure OpenAI GPT-4o deployment configured on the backend.
- Environment variables configured locally; no secret belongs in frontend code.

## Validation scenarios

### 1. Authenticated generation

1. Start the FastAPI backend and Next.js frontend using the project development commands.
2. Create a test account or sign in.
3. Paste a text containing contact details, one job, education, skills, language and certification.
4. Select "Generar CV".
5. Confirm the loading state appears immediately.
6. Confirm the response is HTTP 200 and matches [cv-schema.json](./contracts/cv-schema.json).
7. Confirm the idempotency record is associated with the authenticated user only; no history view is
	exposed in the MVP.
8. Confirm both "Minimalista ATS" and "Creativo PDF" render the same structured data.
9. Download the PDF and verify it opens and contains the visible sections.

Expected outcome: the user sees a validated CV preview and downloads a readable PDF.

For SC-002, execute at least 30 valid requests. Record $T_0$ when the user presses "Generar CV"
and $T_f$ when the frontend finishes receiving the structured JSON and renders the interactive
preview. Calculate the p90 of $T_f - T_0$; it MUST be at most 60 seconds.

### 2. Invalid and incomplete input

1. Submit an empty or whitespace-only textarea.
2. Confirm no generation request is sent and an actionable validation message appears.
3. Submit a short text with no education or certifications.
4. Confirm the response uses empty arrays and does not invent entries.

Expected outcome: incomplete source information produces a valid, honest document or a clear input
error, never malformed JSON.

### 3. Authorization and retry safety

1. Call `POST /api/generate-cv` without an Authorization header.
2. Repeat with an expired or invalid token.
3. Confirm both requests return `401` and create no `resumes` record.
4. Repeat a valid request with the same `Idempotency-Key`.
5. Confirm the second request returns the original result without creating a duplicate.

Expected outcome: unauthorized data cannot be processed and retries remain idempotent.

## Automated checks

- Validate the JSON contract with the backend schema tests.
- Run backend unit and integration tests with pytest.
- Run frontend unit tests with Vitest.
- Run the browser flow with Playwright using accessible locators and stable `data-testid` values.
- Run `git diff --check` before review.
