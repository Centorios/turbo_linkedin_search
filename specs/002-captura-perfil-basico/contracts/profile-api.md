# Contract: Basic Profile API and UI

## Authentication and common rules

- Every profile request uses `Authorization: Bearer <access_token>` from the active Supabase session.
- The backend resolves the owner with the existing bearer-token validation. Request and response bodies never accept or expose `user_id`.
- Profile payloads contain exactly `fullName`, `email`, `phone`, `location`, `linkedin`, and `website`; unexpected properties are rejected.
- All response errors use the existing safe error shape: `{"detail":{"code":"...","message":"..."}}`. No token, provider secret, connection string, raw database error, or profile belonging to another user is returned.

## `GET /api/profile`

Returns the authenticated user's saved basic profile.

### Responses

- `200 OK`, existing profile:

```json
{
  "fullName": "Ana García",
  "email": "ana.cv@example.com",
  "phone": "+34 600 000 000",
  "location": "Madrid",
  "linkedin": "https://www.linkedin.com/in/ana-garcia",
  "website": "https://ana.example.com"
}
```

- `200 OK`, no profile row:

```json
null
```

- `401 Unauthorized`: missing, invalid, or expired bearer token.
- `500 Internal Server Error`: profile storage could not be read; the frontend must show a recoverable error, not treat this as a missing profile.

## `PUT /api/profile`

Creates or replaces the authenticated user's complete basic profile. Repeating the same request has the same result. A partial profile is not saved.

### Request

```json
{
  "fullName": "Ana García",
  "email": "ana.cv@example.com",
  "phone": "+34 600 000 000",
  "location": "Madrid",
  "linkedin": "https://www.linkedin.com/in/ana-garcia",
  "website": "https://ana.example.com"
}
```

All six fields are present as strings. `fullName` must contain a non-whitespace character. `email` is `""` or a valid email address. `linkedin` and `website` are `""` or absolute `http`/`https` URLs. Other optional text fields use `""` when absent.

### Responses

- `200 OK`: returns the saved profile using the same shape as the GET response.
- `401 Unauthorized`: missing, invalid, or expired bearer token; nothing is saved.
- `422 Unprocessable Entity`: missing/extra property, blank name, invalid email, or invalid link; nothing is saved and the error identifies a safe field-level validation issue.
- `500 Internal Server Error`: persistence failed; the UI keeps entered values and offers retry without claiming success.

## CV generation integration

For an authenticated `POST /api/generate-cv`, the backend reads the user's profile before calling Azure OpenAI or resolving an idempotent result. If no profile exists, it preserves the existing generation behavior. If one exists, its non-empty personal fields override the same fields in generated `personalInfo`; empty profile fields fall back to the generated values. The combined CV is validated again, then the same combined document is persisted and returned. Other CV fields do not change. A profile read failure stops generation before provider/persistence work and returns a recoverable safe error.

## UI interaction contract

- The profile form is a modal dialog with accessible name `Completa tu perfil básico` and a labelled input for each of the six fields.
- Stable test identifiers: `basic-profile-modal`, `profile-full-name`, `profile-email`, `profile-phone`, `profile-location`, `profile-linkedin`, `profile-website`, `profile-save`, and `profile-defer`.
- The email input is prefilled from the authenticated session only when the profile has no saved email; this value is editable and is not written to Auth credentials.
- Save validates before sending PUT, exposes field errors accessibly, and prevents duplicate submission while saving.
- Defer closes the modal without calling PUT and leaves the account eligible for the prompt on its next sign-in if no name was saved.
- A profile lookup error is distinct from `null`; retry is available and the generation flow does not silently advance without resolving the lookup.
- When the session changes, data from the prior user is cleared before a lookup for the new session.
