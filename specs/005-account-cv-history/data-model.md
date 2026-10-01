# Data Model

## Resume (existente)
`id`: UUID requerido. `user_id`: dueño desde sesión; nunca aceptado del cliente. `request_id`: UUID, único por usuario. `created_at`: timestamp requerido. `data`: StructuredCv validado, snapshot original; no overlay del perfil ni signed URLs persistentes.

## ResumeSummary
`id`: UUID requerido. `createdAt`: fecha/hora requerida. `fullName`: texto, fallback de presentación si vacío. `summary`: texto original; la UI lo trunca visualmente.

## ResumeHistoryPage
`items`: máximo limit resúmenes. `offset`: entero, mínimo 0, máximo 100000. `limit`: entero, mínimo 1, máximo 50, defecto 20. `hasMore`: booleano.

## ResumeDetail
`id`: UUID requerido. `createdAt`: fecha/hora requerida. `data`: StructuredCv validado.

## UI transitions
Session loading → own history loading → empty/list/error. Selection → detail loading → preview/error. Account change → unmount own history, abort requests and clear all data. Template switch only changes rendering.
