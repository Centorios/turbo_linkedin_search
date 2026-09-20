# Contract: Generate CV

## Request

`POST /api/generate-cv`

Headers:

- `Authorization: Bearer <supabase-access-token>`
- `Content-Type: application/json`
- `Idempotency-Key: <request-uuid>`

Body:

```json
{
  "text": "Texto libre con biografía e historia laboral"
}
```

The authenticated user is derived from the validated token, never from a client-supplied `userId`.

## Credential boundary

- Backend-only secrets: Azure OpenAI key and endpoint, PostgreSQL connection string, and
  privileged Supabase keys or service-role credentials.
- Browser-safe values: public Supabase URL, public/anonymous Supabase key and the authenticated
  user's access token sent as a Bearer token.
- Azure credentials, database connection strings and privileged Supabase keys MUST never appear
  in browser bundles, API responses, prompts returned to users or logs.

## Success response

HTTP `200` with the JSON document described by [cv-schema.json](./cv-schema.json):

```json
{
  "personalInfo": {
    "fullName": "Ana García",
    "email": "ana@example.com",
    "phone": "",
    "location": "Madrid",
    "linkedin": "",
    "website": ""
  },
  "summary": "Product designer con experiencia en...",
  "experience": [],
  "education": [],
  "skills": { "hard": [], "soft": [] },
  "languages": [],
  "certifications": []
}
```

## Error responses

- `400`: texto ausente, vacío o request inválido.
- `401`: token ausente, inválido o expirado.
- `422`: respuesta del modelo no cumple `cv-schema.json`.
- `502`: proveedor de IA no disponible o respuesta no procesable.
- `500`: fallo inesperado de persistencia o servicio.

Every error response includes a stable error code and a user-safe message. Provider prompts,
access tokens and connection strings never appear in responses.

## Backend processing contract

1. Validate the Supabase token and obtain the authenticated `userId`.
2. Validate `text` and `Idempotency-Key`.
3. Return the existing result for the same `userId` and idempotency key when available.
4. Send the text to Azure OpenAI GPT-4o with a strict JSON-only System Prompt.
5. Validate the model response against `cv-schema.json`.
6. Persist the validated document in `resumes` with `userId` and request id.
7. Return the validated document with HTTP `200`.
