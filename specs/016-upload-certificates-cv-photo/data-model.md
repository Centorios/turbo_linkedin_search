# Modelo de datos: certificados del perfil y foto del CV

## `public.user_certificates` (nuevo)

Cada fila pertenece a un usuario autenticado y representa **un archivo original** y una credencial reutilizable. No pertenece a un CV.

| Campo | Tipo / regla | Uso |
|---|---|---|
| `id` | UUID, PK | Identidad estable para selección. |
| `user_id` | UUID, FK `auth.users`, obligatorio | Propietario; RLS y filtro explícito en backend. |
| `request_id` | UUID, obligatorio, único con `user_id` | Reintento idempotente de carga. |
| `storage_path` | texto, único, prefijo `{user_id}/` | Ruta en bucket privado `user-certificates`. |
| `original_filename` | texto saneado, 1–255 caracteres | Nombre de descarga. |
| `mime_type` | `application/pdf`, `image/jpeg` o `image/png` | Tipo comprobado por firma y cabecera. |
| `file_size_bytes` | 1–5 MiB | Límite también impuesto antes de leer todo el cuerpo. |
| `content_sha256` | hash hex de 64 caracteres, único por usuario | Detecta el mismo archivo en cargas repetidas. |
| `status` | `pending_review` o `ready` | Solo `ready` puede incluirse en un CV. |
| `name`, `issuer`, `issue_date`, `expiration_date`, `credential` | texto; fechas `YYYY`, `MM-YYYY` o vacío | Campos del `StructuredCv.certifications[]` existente. `name` requerido para `ready`. |
| `language_name`, `language_proficiency` | texto opcional | Alimenta `languages[]` solo si el archivo acredita esos datos. |
| `created_at`, `updated_at` | marcas temporales | Orden de biblioteca y auditoría operativa. |

**Relación**: `auth.users` 1:N `user_certificates`. Se crea la migración `backend/supabase/migrations/010_user_certificates.sql` con RLS (`auth.uid() = user_id`) y bucket privado `user-certificates` con políticas de Storage limitadas al primer segmento de ruta igual al usuario. La cuenta admin del backend también filtra `user_id` en cada operación. El archivo original se descarga solo por su propietario.

La biblioteca admite hasta 50 certificados por usuario. El alta número 51 devuelve un error de límite, sin subir ni conservar el archivo. Esto hace que «Seleccionar todos» abarque realmente todas las credenciales disponibles y acota el tamaño del CV.

**Identidad y duplicados**: primero `(user_id, content_sha256)` para archivo exacto; después comparación de referencia identificable o nombre+emisor normalizados con fecha compatible. La comparación semántica ocurre bajo serialización por usuario dentro de la operación de registro, no por título parecido. Un conflicto no sobreescribe campos no vacíos; se propone revisión. El registro retorna el certificado existente cuando es equivalente. `(user_id, request_id)` evita altas duplicadas por reintento.

**Estados**:

```text
archivo recibido → validación de firma/tamaño → extracción JSON validada
                                      ├─ datos suficientes → ready
                                      ├─ datos inciertos → pending_review → corrección/confirmación → ready
                                      └─ inválido/fallo → sin registro disponible, error y limpieza de archivo
```

`pending_review` conserva el archivo bajo la cuenta para que la persona corrija los datos. No aparece como seleccionable. Una subida repetida de un archivo en revisión devuelve ese registro. El usuario puede consultar sus datos y el archivo; la eliminación de certificados del perfil queda fuera de esta entrega.

## CV y certificaciones (existentes)

`public.resumes.data` mantiene `StructuredCv` con `certifications[]` (`name`, `issuer`, `issueDate`, `expirationDate`, `credential`) y `languages[]`. Al generar o guardar una versión, el backend copia a ese JSON los datos de los certificados `ready` seleccionados. No almacena ni replica bytes del archivo en el CV. Certificaciones inferidas del texto o ya presentes en el CV se conservan y se deduplican contra las elegidas. La referencia a la biblioteca es lógica por propietario e identidad de la credencial; el PDF contiene una instantánea de los datos, no un enlace dinámico al archivo. Cambios futuros al perfil no alteran versiones previas.

`source_id` y `parent_resume_id` de las versiones existentes siguen iguales. Guardar una edición inserta una fila nueva con `parent_resume_id` de la versión base; nunca actualiza la fila base. La clave `(user_id, request_id)` de `resumes` preserva idempotencia.

La misma migración añade a `resumes` dos campos opcionales: `request_fingerprint` (hash de la entrada relevante, incluidos IDs seleccionados, para detectar reutilización indebida de la clave) y `certificate_merge_report` (JSON validado con `addedIds`, `duplicateIds`, `pendingIds`). Las filas antiguas mantienen `null`. En reintentos nuevos, una huella distinta devuelve conflicto; la misma devuelve el snapshot y reporte originales.

## Foto del CV (existente)

`StructuredCv.personalInfo.photoPath` sigue como ruta opcional `{user_id}/{uuid}.{jpg|jpeg|png|webp}` del bucket privado `profile-photos`; `null` significa sin foto. Una foto nueva recibe ruta distinta e inmutable. El backend comprueba propietario, formato y existencia de una ruta nueva antes de guardar. El editor obtiene una URL firmada solo para previsualización; `photoUrl` nunca forma parte del JSON enviado al backend ni persistido.

Al reemplazar o quitar una foto, la versión anterior conserva su `photoPath` y el objeto referenciado. El cambio de foto del perfil deja de borrar objetos que puedan seguir referenciados por CVs. No se intenta restaurar objetos históricos que ya se hayan borrado antes de esta feature.

La migración ajusta la política de borrado de `profile-photos` para rechazar la eliminación de una ruta usada por cualquier CV del propietario. La UI del perfil deja de intentar borrar inmediatamente una foto previa al reemplazarla o quitarla. Las fotos sin referencias pueden limpiarse posteriormente; esa limpieza no forma parte de esta entrega.

## Reglas de validación

- La entrada de imagen admite JPEG/PNG; el PDF debe tener texto extraíble y hasta 5 páginas. Cada archivo mide como máximo 5 MiB y una operación admite hasta 10 archivos, procesados individualmente.
- No se publican datos de extracción sin validación del esquema. Los campos ausentes son vacíos y nunca se completan con invenciones.
- Solo certificados `ready` del usuario autenticado se aceptan en `selectedCertificateIds`. Una lista vacía es válida y no incorpora certificados del perfil.
- Un certificado nuevo cargado desde el flujo actual queda seleccionado en la UI cuando alcanza `ready`; el usuario puede desmarcarlo. Los certificados anteriores comienzan desmarcados.
- La selección no elimina certificaciones que ya estaban en una versión base. El servidor informa qué entradas añadió, cuáles omitió por duplicadas y cuáles requieren revisión.
