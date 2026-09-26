# Data Model: Captura de perfil básico tras iniciar sesión

## BasicProfile

Representa los datos personales confirmados por un usuario autenticado para reutilizarlos en sus CVs.

| Campo | Tipo lógico | Obligatorio | Regla |
|---|---|---:|---|
| `user_id` | UUID | Sí | Identidad del usuario autenticado; clave primaria y referencia a `auth.users`. No se acepta desde el cuerpo del cliente. |
| `fullName` | string | Sí | Debe contener al menos un carácter no blanco tras quitar espacios exteriores. |
| `email` | string | No | `""` o correo válido. Es el correo de contacto del CV y no modifica el correo de inicio de sesión. |
| `phone` | string | No | Cadena; usar `""` cuando no se aporta. |
| `location` | string | No | Cadena; usar `""` cuando no se aporta. |
| `linkedin` | string | No | `""` o URL absoluta `http`/`https`. |
| `website` | string | No | `""` o URL absoluta `http`/`https`. |
| `updated_at` | timestamp | Sí | Se actualiza en cada guardado válido. |

Existe como máximo un perfil por usuario. La fila se elimina si se elimina la cuenta titular. La tabla tiene RLS habilitado y permite operaciones solo cuando `auth.uid() = user_id`. El servicio backend debe, además, derivar el titular de `require_user_id` y filtrar cada consulta/escritura explícitamente por ese ID porque el cliente administrativo omite RLS.

## CV personal information mapping

`BasicProfile` no reemplaza el contrato del CV. Al combinar un perfil guardado con un `StructuredCv` ya validado, se resuelven independientemente `fullName`, `email`, `phone`, `location`, `linkedin` y `website`:

- Si el valor del perfil no es vacío, se usa el valor confirmado en el perfil.
- Si el valor del perfil es vacío, se conserva el valor que devolvió el modelo en el campo correspondiente de `personalInfo`.
- `summary`, `experience`, `education`, `skills`, `languages` y `certifications` no se modifican.
- El CV combinado vuelve a validarse con `StructuredCv` antes de persistirse o devolverse.

La misma combinación se aplica a una respuesta recuperada por `request_id`, consultando el perfil vigente. Si no existe perfil, se usa el CV validado sin cambios. Si la consulta del perfil falla, no se llama al proveedor ni se devuelve un resultado idempotente potencialmente obsoleto; se responde con error recuperable y no se persiste otro resultado.

## State model

| Estado | Significado | Transición |
|---|---|---|
| `missing` | No hay fila o el perfil existente carece de nombre no blanco. | Al autenticar, ofrecer el modal. Un guardado válido crea o actualiza `saved`; posponer conserva `missing`. |
| `saved` | Existe perfil con nombre no blanco y todos los campos definidos. | Al autenticar, no ofrecer el modal automáticamente. Un PUT válido actualiza el perfil y `updated_at`. |
| `loading` | La interfaz está recuperando perfil para la sesión actual. | Con perfil: `saved`; sin fila/nombre: `missing`; error: mostrar recuperación y no confundirlo con `missing`. |
| `saving` | El usuario envió el formulario válido. | Éxito: `saved`; error: conserva valores en el formulario y permite reintento. |
| `deferred` | El usuario cerró o pospuso durante la sesión actual. | Ocultar el modal sin escribir; al siguiente inicio de sesión volver a consultar y ofrecer si sigue `missing`. |

## Ownership and lifecycle

- Un token bearer válido identifica exactamente el `user_id` titular.
- Un cambio de sesión invalida el perfil en memoria antes de cargar el perfil de la nueva cuenta.
- Cerrar sesión limpia el estado del perfil y el formulario temporal.
- Posponer no crea fila, marca de servidor ni valores parciales.
- Los errores 401 limpian el estado autenticado; los errores de red/5xx mantienen el formulario para reintentar mientras la sesión sea válida.
