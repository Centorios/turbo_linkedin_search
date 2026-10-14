# Feature Specification: Eliminar CVs del historial de la cuenta

**Feature Branch**: `codex/009-delete-cv-history`
**Created**: 2026-10-14
**Status**: Ready
**Input**: "Eliminar CVs (del historial de la cuenta)"

## User Scenarios & Testing

### User Story 1 - Eliminar una versión propia (Priority: P1)

Como usuario quiero eliminar un CV guardado que ya no necesito, para mantener mi historial ordenado y controlar mis datos.

**Why this priority**: El historial conserva versiones con información profesional y debe permitir a su titular administrar su contenido.

**Independent Test**: Abrir el historial con al menos dos CVs propios, iniciar la eliminación de uno, cancelarla y después confirmarla; verificar que solo el CV confirmado deja de aparecer y abrirse.

**Acceptance Scenarios**:

1. **Given** un CV propio en el historial, **When** elijo eliminarlo, **Then** veo una confirmación que identifica el CV e informa que la eliminación es permanente y que también se borrarán las búsquedas y resultados de matching asociados.
2. **Given** una confirmación abierta, **When** cancelo, **Then** el CV y sus datos asociados permanecen intactos.
3. **Given** que confirmo la eliminación de un CV propio, **When** la operación termina con éxito, **Then** el CV deja de aparecer en el historial y ya no puedo abrirlo desde la cuenta.
4. **Given** que el CV eliminado estaba abierto en la vista previa, **When** se confirma su eliminación, **Then** la vista previa se cierra y no vuelve a mostrar el contenido eliminado.

### User Story 2 - Proteger la propiedad y el resto del historial (Priority: P1)

Como usuario quiero que la eliminación solo afecte a mis propios CVs, para que otro usuario no pueda borrar ni inferir la existencia de mis datos.

**Why this priority**: Los CVs contienen información personal y profesional y la operación es destructiva.

**Independent Test**: Con dos cuentas, intentar eliminar desde una cuenta un identificador perteneciente a la otra y verificar que el CV de su titular permanece accesible solo para él.

**Acceptance Scenarios**:

1. **Given** una sesión autenticada, **When** se solicita eliminar un CV propio, **Then** la operación se autoriza usando la identidad autenticada y no una identidad elegida por el cliente.
2. **Given** un identificador inexistente o perteneciente a otra cuenta, **When** se solicita su eliminación, **Then** no se elimina ningún registro y la respuesta no permite distinguir ambos casos.
3. **Given** varios CVs propios, **When** elimino uno, **Then** los demás CVs y sus detalles permanecen disponibles.
4. **Given** una solicitud sin sesión válida, **When** se intenta eliminar un CV, **Then** la operación no modifica ningún dato.

### User Story 3 - Recuperarse de un fallo de eliminación (Priority: P2)

Como usuario quiero recibir un resultado claro si no se pudo eliminar un CV, para conservarlo y poder volver a intentarlo.

**Why this priority**: Una operación destructiva debe comunicar con precisión si se completó y evitar ocultar errores.

**Independent Test**: Simular un fallo de persistencia, intentar eliminar un CV y comprobar que sigue visible, que se informa el fallo y que se puede reintentar.

**Acceptance Scenarios**:

1. **Given** un fallo de red o almacenamiento, **When** la eliminación no se completa, **Then** el CV permanece en el historial y la interfaz informa que no se eliminó.
2. **Given** una eliminación en curso, **When** el usuario realiza varios clics, **Then** no se envían acciones destructivas concurrentes desde esa confirmación.
3. **Given** una eliminación fallida, **When** el usuario reintenta y la operación tiene éxito, **Then** el CV desaparece y se muestra el estado actualizado del historial.

### Edge Cases

- El usuario cancela la confirmación o la cierra sin confirmar.
- El CV desaparece antes de confirmar, ya fue eliminado o su identificador no es válido.
- El usuario elimina el único elemento de la página actual o el último elemento de una página intermedia.
- El usuario cambia de cuenta o cierra sesión mientras la eliminación está pendiente; la respuesta no debe mostrarse a la cuenta nueva aunque el servidor ya haya completado la petición.
- Una respuesta tardía de listado o detalle no debe volver a mostrar el CV eliminado.
- El CV tiene búsquedas o análisis de matching asociados que dependen de su existencia.
- Una imagen de perfil usada también por el perfil actual no debe borrarse por eliminar una versión del CV.

## Requirements

### Functional Requirements

- **FR-001**: El usuario MUST poder iniciar la eliminación de un CV guardado individual desde el historial de su cuenta.
- **FR-002**: Antes de eliminar, el sistema MUST pedir confirmación e identificar qué CV se eliminará.
- **FR-003**: La confirmación MUST indicar que la eliminación es permanente y que se eliminarán también las búsquedas y los resultados de matching asociados a ese CV.
- **FR-004**: Cancelar la confirmación MUST dejar intactos el CV y sus datos asociados.
- **FR-005**: Al confirmar, el sistema MUST eliminar permanentemente el CV seleccionado y los datos derivados que dependen exclusivamente de ese CV; MUST conservar los demás CVs, el perfil de cuenta y los recursos compartidos que no pertenezcan exclusivamente a esa versión.
- **FR-006**: Toda operación MUST requerir una sesión válida y autorizar el CV por su propietario autenticado; MUST ignorar cualquier identidad de usuario proporcionada por el cliente.
- **FR-007**: Un identificador ajeno o inexistente MUST producir el mismo resultado observable y MUST NOT modificar datos.
- **FR-008**: Después de una eliminación exitosa, la interfaz MUST retirar el CV del historial, cerrar su vista previa si estaba abierta y mantener una página válida del historial.
- **FR-009**: Si la eliminación falla, el sistema MUST informar el fallo, mantener el CV visible y permitir reintentar; MUST NOT presentar el fallo como éxito.
- **FR-010**: La interfaz MUST impedir solicitudes concurrentes repetidas para un mismo CV mientras haya una eliminación pendiente.
- **FR-011**: El cambio de cuenta o el cierre de sesión MUST retirar de inmediato los datos visibles de la cuenta anterior y descartar cualquier respuesta pendiente de eliminación para no aplicarla a la cuenta nueva; no se promete revertir una petición que el servidor ya haya recibido.
- **FR-012**: Las pruebas MUST cubrir confirmación y cancelación, eliminación persistente, aislamiento entre usuarios, errores, CV abierto y conservación de otros CVs.

### Key Entities

- **Versión de CV**: documento estructurado guardado, perteneciente a una cuenta e identificado individualmente en el historial.
- **Datos derivados del CV**: búsquedas de empleo, resultados y recomendaciones de matching que dependen de esa versión.
- **Solicitud de eliminación**: acción confirmada sobre una versión específica, autorizada por la sesión de su propietario.

## Success Criteria

### Measurable Outcomes

- **SC-001**: En todos los casos de prueba de eliminación confirmada, el CV seleccionado deja de aparecer en el historial y no puede volver a abrirse.
- **SC-002**: En todos los casos de prueba de cancelación, el CV y sus datos asociados permanecen disponibles sin cambios.
- **SC-003**: En todos los casos de prueba entre dos cuentas, ninguna puede eliminar ni confirmar la existencia de un CV ajeno.
- **SC-004**: Cuando una eliminación falla, el CV permanece visible y el usuario puede reintentar sin perder el resto de su historial.
- **SC-005**: Después de eliminar un CV, el usuario puede seguir usando el historial sin quedar en una página vacía inválida ni ver una vista previa obsoleta.

## Assumptions

- El usuario espera que “eliminar del historial” retire permanentemente la versión guardada, no que solo la oculte.
- La eliminación de un CV también elimina búsquedas y análisis de matching asociados, ya que esos resultados dependen de la versión eliminada y no deben quedar huérfanos.
- La operación no elimina el perfil actual de la cuenta ni archivos de imagen compartidos que puedan seguir siendo usados por el perfil u otras versiones.
- No se requiere papelera, recuperación, eliminación masiva ni borrado de toda la cuenta en esta entrega.
- Se reutilizan la autenticación y el historial existentes.
