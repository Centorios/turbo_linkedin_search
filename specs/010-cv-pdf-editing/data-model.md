# Data Model: Edición de CV existente desde PDF con IA

## Entidades persistidas

### CvSource

Representa el PDF original importado y su propietario.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | UUID | Clave primaria. |
| `user_id` | UUID | Obligatorio; debe corresponder al usuario autenticado. |
| `request_id` | UUID | Clave de idempotencia única por usuario para reintentos de importación. |
| `storage_path` | texto | Ruta privada inmutable; primer segmento igual a `user_id`. |
| `original_filename` | texto | Nombre saneado para presentación; no se usa para construir la ruta de almacenamiento. |
| `file_size_bytes` | entero | Mayor que cero y como máximo 10 MiB. |
| `page_count` | entero | Entre 1 y 20. |
| `created_at` | fecha/hora | Asignada al crear la fuente. |

El binario reside en el bucket privado `cv-sources`; los metadatos y la ruta se almacenan en PostgreSQL. El texto extraído se procesa para crear la primera CV estructurada, pero no se persiste por separado.

### Resume (extensión del historial existente)

Cada fila de `resumes` continúa representando un CV estructurado e incorpora relaciones opcionales para preservar compatibilidad con CVs ya existentes.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | UUID | Clave primaria existente. |
| `user_id` | UUID | Propietario; toda consulta debe filtrarlo. |
| `request_id` | UUID | Identificador de petición único por usuario, como ya exige el historial. |
| `data` | JSON | Debe validar contra `StructuredCv`. |
| `source_id` | UUID o nulo | Fuente PDF de la que deriva; nulo para CVs previos y generación de texto libre. |
| `parent_resume_id` | UUID o nulo | Versión estructurada anterior; nulo para la primera versión importada. |
| `created_at` | fecha/hora | Campo existente. |

La primera importación crea una versión base vinculada a la fuente. Cada cambio confirmado crea otra fila con el mismo `source_id` y el `parent_resume_id` correspondiente. El endpoint de edición debe comprobar que la fuente, la versión base y el usuario autenticado coinciden.

## Entidad temporal

### EditProposal

Solo existe durante la sesión de edición; no se persiste hasta que el usuario confirma.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `status` | `ready` o `needs_input` | Determina qué contenido de respuesta está presente. |
| `base_resume_id` | UUID | Versión propiedad del usuario y vinculada a la fuente. |
| `proposed_cv` | `StructuredCv` o nulo | Obligatoria cuando `status=ready`; validada antes de devolver. |
| `changed_sections` | lista de secciones | Calculada comparando CV base y propuesta; permite identificar las secciones que requieren revisión. |
| `questions` | lista de preguntas | Obligatoria cuando `status=needs_input`; no incluye propuesta persistible. |

## Relaciones y ciclo de vida

- Un usuario puede tener varias fuentes PDF; cada fuente pertenece a un único usuario.
- Una fuente puede asociarse a varias versiones de CV.
- Una versión puede derivar de una versión anterior de la misma fuente.
- Las filas históricas existentes conservan `source_id = NULL` y `parent_resume_id = NULL`.
- Las propuestas no confirmadas son efímeras y no aparecen en el historial.
- El objeto fuente no se sobrescribe al editar una CV.
- El usuario puede eliminar una fuente; esa operación elimina en cascada sus versiones y el objeto PDF privado. Si falla un paso, el sistema debe restaurar o completar la operación de forma consistente y reportar el error.
- Todo endpoint que lea, modifique o descargue una fuente/version debe comprobar `user_id` en backend; la ruta de almacenamiento no reemplaza esa autorización.

## Validación y errores

- Rechazar cuerpo mayor que 10 MiB antes de pasar datos al parser.
- Rechazar MIME incorrecto o ausencia de firma PDF; verificar además que el parser puede abrir el documento.
- Rechazar documentos cifrados, con cero páginas, con más de 20 páginas o sin texto extraíble.
- Validar `StructuredCv` antes de devolver el resultado de importación, propuesta de edición o versión confirmada.
- No permitir cambios de una versión que pertenezca a otro usuario o a otra fuente.
- No persistir propuestas ni marcar como guardada una respuesta de IA inválida.
- Al fallar almacenamiento o persistencia, devolver error explícito y limpiar el artefacto parcial cuando corresponda; registrar el fallo sin guardar contenido sensible en logs.
