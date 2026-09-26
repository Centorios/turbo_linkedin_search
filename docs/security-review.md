# Security Review Checklist

Use this checklist before a release and record evidence for each item. Do not paste
secret values, CV content, access tokens, or connection strings into the review record.

## Client Bundles

- [ ] Build the frontend and inspect emitted browser assets for backend-only configuration, including `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, and `AZURE_OPENAI_API_KEY`.
- [ ] Confirm the deployed frontend has only public `NEXT_PUBLIC_*` values; `NEXT_PUBLIC_BACKEND_URL` is optional when Vercel Services serves `/api/*` on the same domain.
- [ ] Confirm no access token or professional CV content is written to browser logs or persistent browser storage outside the Supabase-managed session.

## API Responses

- [ ] Verify unauthenticated, invalid-token, expired-token, provider-failure, and invalid-model responses contain only user-safe error messages.
- [ ] Verify responses never include provider credentials, prompts, raw provider errors, database connection strings, or another user's CV data.
- [ ] Verify the generation request rejects client-supplied `userId` and ownership comes only from the validated bearer token.

## Logs

- [ ] Verify request events contain only request ID, outcome code, HTTP status, and latency; confirm bearer tokens, CV text, prompts, and connection strings are absent.
- [ ] Exercise successful and failing requests and inspect logs without copying sensitive values into the review record.

## Repository and Deployment Configuration

- [ ] Verify no `.env` file, secret value, private key, or credential-bearing connection string is tracked by Git.
- [ ] Verify Render backend secrets are configured in the Render dashboard and are not committed as plaintext in `render.yaml`.
- [ ] Verify Vercel contains only public `NEXT_PUBLIC_*` browser configuration and no backend credentials.
- [ ] Verify Supabase row-level security and ownership constraints prevent cross-user resume access.
