# Research: Eliminar CVs del historial de la cuenta

## R1. Eliminar mediante la ruta de CVs existente

**Decisión**: Exponer `DELETE /api/resumes/{resume_id}` y responder `204 No Content` al completar la operación.

**Rationale**: El historial ya usa `/api/resumes` para listar y abrir versiones. El recurso tiene un identificador estable y la operación HTTP DELETE expresa su eliminación sin introducir una ruta o modelo separado.

**Alternativas consideradas**:
- Crear una ruta nueva de historial: duplicaría el recurso y el patrón API existente.
- Ocultar el CV sin borrarlo: no satisface la expectativa de eliminación permanente.

## R2. Autorizar siempre con la identidad autenticada

**Decisión**: Reutilizar `require_user_id` y filtrar la eliminación por `user_id` autenticado e `id` solicitado. Si no se elimina una fila, responder como recurso no encontrado.

**Rationale**: Las rutas actuales de lista y detalle ya aíslan por usuario. La constitución exige autorización en backend; igualar CV inexistente y ajeno impide confirmar la existencia de datos de otra cuenta.

**Alternativas consideradas**:
- Aceptar `user_id` desde el cuerpo o query: permitiría suplantar identidad.
- Devolver permisos denegados para IDs ajenos y no encontrado para IDs inexistentes: filtraría información privada.

## R3. Reutilizar la cascada de persistencia existente

**Decisión**: Eliminar la fila de `resumes` y dejar que las claves foráneas existentes borren búsquedas, embeddings, resultados y recomendaciones que dependan de esa versión.

**Rationale**: `005_job_searches.sql` y `006_match_results.sql` declaran `ON DELETE CASCADE` hacia el CV; las recomendaciones dependen del resultado. Las fotos no se borran porque pueden pertenecer al perfil u otras versiones.

**Alternativas consideradas**:
- Crear un borrado manual duplicado de dependencias: aumentaría el riesgo de estados parciales y divergencia respecto a las relaciones declaradas.
- Mantener los resultados de matching: dejaría datos derivados vinculados a un CV eliminado y no permitiría recuperar su contexto.

## R4. Confirmación explícita sin dependencia nueva

**Decisión**: Antes de la petición, presentar una confirmación nativa del navegador con el nombre del CV, el carácter permanente de la acción y el aviso de borrado de búsquedas y resultados asociados.

**Rationale**: El proyecto no tiene un componente compartido de diálogo de confirmación. La confirmación nativa evita introducir dependencias o un patrón visual nuevo en una operación destructiva.

**Alternativas consideradas**:
- Instalar una librería de diálogos: contradice la simplicidad y no es necesaria para una única operación.
- Borrar directamente con un clic: no cumple la confirmación requerida para una operación irreversible.

## R5. Actualizar el estado solo después de confirmar el éxito

**Decisión**: Mantener el CV en pantalla mientras la petición está pendiente y ante un error; al recibir éxito, cerrar la vista previa correspondiente, retirar el registro y ajustar la página si quedó vacía.

**Rationale**: Evita una representación de éxito cuando el backend no eliminó el registro y conserva un estado recuperable para reintentar. Las señales de aborto y el control de cuenta existente evitan aplicar respuestas tardías a otra sesión.

**Alternativas consideradas**:
- Retirar el CV de forma optimista y restaurarlo en caso de error: complica la paginación y crea una ventana en que el historial parece borrado aunque la persistencia haya fallado.
