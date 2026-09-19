# Data Model: End-to-End CV Generation Flow

## Usuario

Representa la identidad autenticada y propietaria de los datos.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | Obligatorio; identidad emitida por Supabase Auth |
| `email` | string | Obligatorio; formato de correo válido |

## Perfil profesional de entrada

Texto libre que inicia una generación. Se procesa durante la solicitud y no se expone a otros
usuarios.

| Campo | Tipo | Reglas |
|---|---|---|
| `text` | string | Obligatorio; no puede estar vacío tras recortar espacios |
| `requestId` | UUID | Obligatorio por solicitud; permite reintentos idempotentes |
| `userId` | UUID | Obligatorio; debe coincidir con la sesión autenticada |

## CV estructurado

Documento persistido en `resumes` y asociado a un único usuario.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | Identificador del documento |
| `userId` | UUID | Obligatorio; relación con Usuario |
| `requestId` | UUID | Obligatorio; único por usuario y solicitud |
| `data` | JSON | Obligatorio; debe cumplir `contracts/cv-schema.json` |
| `createdAt` | datetime | Obligatorio; generado por el servicio |

### Forma de `data`

- `personalInfo`: objeto con identidad y datos de contacto disponibles. `email` debe ser un
	correo válido cuando tenga valor; `linkedin` y `website` deben ser URLs `http` o `https` válidas cuando tengan
	valor; los tres usan `""` cuando faltan.
- `summary`: resumen profesional; puede ser cadena vacía si no hay información suficiente.
- `experience`: lista de cargos, empresas, fechas, ubicaciones y logros. Sus fechas usan `MM-YYYY`
	o `YYYY`.
- `education`: lista de instituciones, programas, fechas y descripciones. Sus fechas usan
	`MM-YYYY` o `YYYY`.
- `skills.hard`: lista de habilidades técnicas.
- `skills.soft`: lista de habilidades interpersonales.
- `languages`: lista de idiomas y nivel cuando esté disponible.
- `certifications`: lista de certificaciones, emisores, fechas y referencias. Sus fechas usan
	`MM-YYYY` o `YYYY`.

Todas las listas se conservan como arrays, incluso cuando no haya elementos. El modelo no debe
inventar entidades; los campos no disponibles se representan como cadenas vacías o listas vacías
según el contrato.

## Sesión

Estado autenticado usado para autorizar la operación. Una sesión inválida o expirada impide
procesar y persistir la solicitud.

## Estados de solicitud

1. `idle`: formulario listo.
2. `loading`: solicitud enviada y generación en curso.
3. `success`: JSON validado y persistido; previsualización disponible.
4. `error`: fallo de validación, autenticación, proveedor o red; se permite reintento sin duplicar.

## Relaciones y aislamiento

- Un Usuario puede tener muchos resultados de generación, sin exposición de historial en el MVP.
- Cada resultado pertenece a un único Usuario.
- `requestId` es idempotente dentro del ámbito de un Usuario.
- Consultas y escrituras de `resumes` siempre filtran por el usuario autenticado.
