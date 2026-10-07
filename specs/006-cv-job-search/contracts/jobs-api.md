# Jobs API contract

Todas las rutas exigen `Authorization: Bearer <token de Supabase>`. FastAPI valida el token y filtra el CV por dueño. Ninguna respuesta contiene datos personales del CV.

## GET `/api/jobs/search-profile/{resume_id}`

200:

```json
{"resumeId":"00000000-0000-0000-0000-000000000001","suggestedKeywords":"Desarrollador backend","suggestedLocation":"Buenos Aires, Argentina","skills":["Python","FastAPI"]}
```

`404 resume_not_found` para CV inexistente o ajeno; `401` sin sesión; `500 resume_read_failed` ante error de almacenamiento.

## POST `/api/jobs/search`

Solicitud:

```json
{"resumeId":"00000000-0000-0000-0000-000000000001","keywords":"Desarrollador backend","location":"Buenos Aires"}
```

200:

```json
{"items":[{"id":"jooble:123","title":"Desarrollador backend","company":"Empresa","location":"Buenos Aires","snippet":"Desarrollo de servicios...","url":"https://ar.jooble.org/jdp/123","source":"Jooble","updatedAt":"2026-10-07T12:00:00Z"}]}
```

`404 resume_not_found`, `422` por entrada inválida, `503 jobs_not_configured` sin clave regional, `502 jobs_source_failed` cuando falla la fuente, `401` sin sesión. Los errores con código usan `{"detail":{"code":"...","message":"..."}}`.
