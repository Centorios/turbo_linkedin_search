# Research

- **Decision**: Reutilizar `resumes` y guardado exitoso de `CvGenerationService`.
  **Rationale**: Ya existe snapshot y unique(user_id, request_id); reintentos no duplican.
  **Alternatives considered**: Tabla de intentos nueva, innecesaria para CVs exitosos.
- **Decision**: Filtrar dueño en lista y detalle además de RLS.
  **Rationale**: `ResumeRepository` usa service role; RLS no sustituye autorización en API.
  **Alternatives considered**: Lectura directa desde navegador, rechazada para mantener validación y límites backend.
- **Decision**: Offset/limit con orden created_at DESC, id DESC, limit+1 para hasMore.
  **Rationale**: Navegación acotada sin conteo completo; suficiente para historial MVP. Un índice de usuario/fecha puede añadirse cuando volumen lo justifique.
  **Alternatives considered**: Cursor, mayor complejidad para este alcance; offset puede desplazar páginas si hay generaciones concurrentes.
- **Decision**: No aplicar perfil actual a snapshots. Fotos resueltas nuevamente, con fallback textual.
  **Rationale**: `photoPath` persiste; signed URLs caducan y fotos anteriores pueden eliminarse.
- **Decision**: Subárbol UI por ID de usuario y AbortController para lista/detalle.
  **Rationale**: Cambiar cuenta descarta contenido y solicitudes; clics rápidos no sobrescriben selección.
Investigación delegada por Speckit-plan basada en código local. Sin incógnitas ni hooks registrados.
