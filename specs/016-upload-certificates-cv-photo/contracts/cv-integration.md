# Contrato: selección de certificados y foto por versión

Los contratos actuales `StructuredCv` y las plantillas no cambian de forma. `certifications[]` mantiene `{name, issuer, issueDate, expirationDate, credential}`; `personalInfo.photoPath` sigue siendo opcional. Los archivos de certificado viven en el perfil; `resumes.data` guarda datos de CV, no bytes. Los IDs se procesan solo en backend.

## Generación: `POST /api/generate-cv`

Conservar `Authorization` y `Idempotency-Key` existentes. Body ampliado:

```json
{
  "text": "Experiencia profesional...",
  "selectedCertificateIds": ["uuid-del-certificado"]
}
```

`selectedCertificateIds` es opcional y por defecto `[]`; máximo 50 IDs únicos, el tamaño máximo de la biblioteca. El backend resuelve cada ID `ready` con `user_id`; ID ajeno, inexistente o pendiente devuelve `422` sin generar CV. Después de validar el JSON de Azure, fusiona los seleccionados con certificaciones del texto mediante la regla de identidad, completa solo campos vacíos respaldados, y fusiona idiomas acreditados sin duplicarlos. Persistencia sincrónica en `resumes` y respuesta con campos actuales de CV más:

```json
{
  "certificateMergeReport": {
    "addedIds": ["uuid-del-certificado"],
    "duplicateIds": [],
    "pendingIds": []
  }
}
```

El fragmento ilustra solo el campo nuevo; la respuesta completa conserva `personalInfo`, `summary`, `experience`, `education`, `skills`, `languages` y `certifications`. El reporte se persiste separado de `resumes.data` para que un reintento devuelva el mismo CV y reporte. El backend guarda una huella de `text` e IDs seleccionados con la clave idempotente: misma clave y mismo contenido devuelve el resultado original; misma clave y contenido distinto devuelve `409 idempotency_conflict`. Una nueva selección requiere nueva clave. Los datos actuales del perfil no se vuelven a aplicar al leer un CV ya guardado.

## Edición: versiones de historial e importadas

Se conservan `POST /api/resumes/{resume_id}/versions` y `POST /api/cv-imports/{source_id}/versions` con `Idempotency-Key`. El body existente `data: StructuredCv` (y `baseResumeId` en importados) admite `selectedCertificateIds?: UUID[]`. La propuesta de IA y el control de foto usan el mismo `data`, sin una ruta de edición nueva.

Al guardar, el backend autoriza la versión base, verifica cada certificado seleccionado, aplica la fusión al `data` validado y guarda una **nueva** versión con `parent_resume_id` de la base. Devuelve `ResumeVersion` existente más `certificateMergeReport`. Si todos los certificados seleccionados ya están en el CV y no hay otro cambio efectivo, no crea versión y responde `409 no_changes`. La versión original queda intacta. Una selección que no existe o pertenece a otra cuenta devuelve `422` sin revelar datos del otro usuario.

La UI muestra certificados previos del perfil desmarcados; los que ya figuran en el CV permanecen en el documento base y seleccionarlos de nuevo solo genera `duplicateIds`. Un certificado recién subido y confirmado queda marcado para el CV actual. «Seleccionar todos» marca todos los `ready` de la biblioteca de la cuenta, no los `pending_review`; la paginación no debe limitar silenciosamente la acción. La persona puede desmarcar cualquiera antes de generar o guardar. La UI informa añadidos, duplicados y pendientes antes de descargar el CV generado o guardar la edición.

## Foto del CV

El editor muestra la foto actual resolviendo una URL firmada de `personalInfo.photoPath`; si es `null`, ofrece agregar. Reemplazar sube una foto nueva a `profile-photos` con ruta UUID inmutable; quitar pone `photoPath: null` en la propuesta. Cada operación actualiza la vista previa inmediatamente; guardar crea nueva versión. `photoUrl` es efímera y se elimina de cualquier body enviado al backend. La foto del perfil no se modifica.

Para `photoPath` nuevo o cambiado, el backend valida `{user_id}/{uuid}.{jpg|jpeg|png|webp}`, propiedad y existencia del objeto. Un `photoPath` de otra cuenta o inexistente devuelve `422 invalid_photo`. La edición del perfil no borra fotos que puedan aparecer en CVs guardados; una versión antigua mantiene su ruta. ATS conserva su comportamiento sin foto, y las plantillas visuales la incluyen. Mostrar un aviso cuando se elige ATS con foto.

## Pruebas contractuales mínimas

1. Generar sin IDs conserva comportamiento previo; con IDs propios añade solo credenciales ausentes; ID ajeno/pendiente se rechaza.
2. Reintentar misma clave devuelve el mismo snapshot; cambiar selección con la misma clave causa conflicto.
3. Editar un CV con certificados y foto crea nueva versión; base no cambia; selección duplicada sin otro cambio no crea versión.
4. Ruta de foto ajena/inexistente se rechaza; quitar foto solo afecta la versión nueva.
5. `photoUrl` no llega al backend y el PDF mostrado coincide con el descargado en ATS y plantilla visual.
