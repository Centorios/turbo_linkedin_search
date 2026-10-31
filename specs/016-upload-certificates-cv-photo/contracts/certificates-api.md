# Contrato HTTP: biblioteca de certificados del perfil

Todas las rutas usan `Authorization: Bearer <Supabase access token>`; el backend deriva `user_id` del token y no acepta un ID de propietario en el body. Errores siguen el patrón `{ "detail": { "code": "...", "message": "..." } }` de las APIs actuales. Los mensajes visibles usan español rioplatense.

## `GET /api/profile/certificates?offset=0&limit=20`

Respuesta `200`:

```json
{
  "items": [
    {
      "id": "uuid",
      "originalFilename": "certificado.pdf",
      "mimeType": "application/pdf",
      "fileSizeBytes": 12345,
      "status": "ready",
      "certification": {
        "name": "Curso de análisis de datos",
        "issuer": "Institución",
        "issueDate": "2025",
        "expirationDate": "",
        "credential": "ABC-123"
      },
      "language": null,
      "createdAt": "2026-10-31T12:00:00Z"
    }
  ],
  "offset": 0,
  "limit": 20,
  "hasMore": false
}
```

`status` puede ser `pending_review` o `ready`. En revisión, `certification` contiene los campos detectados que se pueden corregir; no es seleccionable hasta confirmación. `limit` 1–50. La lista incluye solo certificados propios.

## `POST /api/profile/certificates`

Misma convención de archivo binario de `POST /api/cv-imports`: body con bytes, `Content-Type` PDF/JPEG/PNG, `X-Original-Filename` percent-encoded UTF-8, `Idempotency-Key` UUID. No se utiliza multipart. Tamaño máximo 5 MiB por solicitud y PDF máximo 5 páginas. El selector de UI puede procesar hasta 10 archivos consecutivamente, cada uno con su clave.

Respuesta `201`: un certificado nuevo `ready` o `pending_review` con la forma de `items[]` anterior. Respuesta `200`: mismo certificado propio ya existente por clave idempotente, archivo o identidad de credencial; añade `duplicate: true` y no crea objeto nuevo. `pending_review` pide confirmar/corregir, sin incluir el certificado en un CV. La UI selecciona automáticamente un nuevo certificado cuando queda `ready`; un duplicado previo mantiene su selección anterior.

Errores: `400` cabeceras/clave inválidas; `401` sesión ausente/expirada; `409 certificate_limit_reached` al llegar a 50 certificados del perfil; `413` tamaño excedido; `415` tipo no admitido; `422` archivo ilegible, vacío, protegido, PDF sin texto o respuesta de extracción inválida; `502` Azure no disponible; `500` error de persistencia. Un archivo inválido no se muestra como disponible en el perfil. Los datos identificables pero inciertos se guardan como `pending_review`.

## `PATCH /api/profile/certificates/{certificate_id}`

Solo permite confirmar/corregir un registro propio `pending_review`:

```json
{
  "certification": {
    "name": "Curso de análisis de datos",
    "issuer": "Institución",
    "issueDate": "2025",
    "expirationDate": "",
    "credential": "ABC-123"
  },
  "language": null
}
```

Respuesta `200`: certificado `ready`. El backend valida fechas, nombre, autoría y duplicados de perfil antes de pasar de estado. `404` para ID inexistente o ajeno; `409` si la corrección coincide con otro certificado propio (respuesta incluye ID existente para poder seleccionarlo); `422` si los datos siguen incompletos o inconsistentes.

## `GET /api/profile/certificates/{certificate_id}/file`

Descarga autenticada del archivo original, con tipo y nombre saneado. `404` tanto para recurso inexistente como ajeno. El bucket no es público; no se devuelve una ruta libre para descargar archivos de otro usuario.

## Límites de contrato y seguridad

- Validar `Content-Type` **y** firma real antes de extracción; detener streaming al superar 5 MiB. PDF sin texto extraíble se rechaza, aunque tenga páginas escaneadas.
- La extracción usa un prompt acotado a una credencial, sin instrucciones tomadas del archivo; la salida JSON pasa por Pydantic. Nunca guardar respuestas libres o claves de proveedor en logs.
- Cada consulta de tabla/Storage lleva filtro `user_id` en el backend, además de RLS y políticas por carpeta. La idempotencia se limita a `(user_id, request_id)`.
- La deduplicación por identidad se serializa por propietario para evitar dos altas simultáneas; si se detecta equivalencia se reutiliza el registro existente.
