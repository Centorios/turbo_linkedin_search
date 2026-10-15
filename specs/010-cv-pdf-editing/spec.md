# Feature Specification: Edición de CV existente desde PDF con IA

**Feature Branch**: `[010-cv-pdf-editing]`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Upload an already existing cv in pdf format and ask the AI in order to edit / add / delete sections and experiences"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cargar un CV existente (Priority: P1)

Como usuario autenticado, quiero cargar un CV existente en PDF para continuar trabajando sobre su contenido sin volver a ingresar mi trayectoria manualmente.

**Why this priority**: La carga del documento es el punto de entrada indispensable para reutilizar un CV existente.

**Independent Test**: Cargar un PDF válido con texto seleccionable y verificar que el sistema presenta su contenido como un CV editable.

**Acceptance Scenarios**:

1. **Given** que el usuario está autenticado y selecciona un PDF legible, **When** lo carga, **Then** el sistema extrae y muestra el contenido identificado en secciones editables.
2. **Given** que el usuario selecciona un archivo que no es un PDF válido o cuyo texto no se puede extraer, **When** intenta cargarlo, **Then** recibe un mensaje claro y puede seleccionar otro archivo sin perder su trabajo actual.

---

### User Story 2 - Solicitar cambios al CV con IA (Priority: P1)

Como usuario, quiero pedir en lenguaje natural que se editen, agreguen o eliminen secciones o experiencias para adaptar mi CV sin tener que reescribirlo manualmente.

**Why this priority**: La edición guiada por IA es el valor principal de la funcionalidad y permite modificar el contenido importado con instrucciones directas.

**Independent Test**: Dar una instrucción para modificar una sección y comprobar que el sistema propone cambios estructurados y conserva intacto el resto del CV.

**Acceptance Scenarios**:

1. **Given** que el CV cargado contiene experiencia y habilidades, **When** el usuario pide agregar una experiencia con los datos proporcionados, **Then** el sistema propone la nueva experiencia en la sección correspondiente.
2. **Given** que el usuario solicita editar o eliminar una experiencia existente, **When** la IA procesa la instrucción, **Then** presenta el cambio propuesto de forma identificable y mantiene sin cambios las demás secciones.
3. **Given** que la instrucción no incluye información suficiente para agregar un hecho profesional, **When** la IA procesa la solicitud, **Then** pide los datos faltantes o indica qué dato no pudo determinar, sin inventar información.

---

### User Story 3 - Revisar y guardar el CV actualizado (Priority: P2)

Como usuario, quiero revisar el resultado antes de guardarlo para confirmar que los cambios solicitados son correctos y conservar el PDF original.

**Why this priority**: La revisión evita cambios no deseados y permite que el usuario controle la versión final de su información profesional.

**Independent Test**: Aplicar una propuesta, revisar el CV resultante y guardar una nueva versión; comprobar que la versión de origen permanece disponible y sin cambios.

**Acceptance Scenarios**:

1. **Given** que la IA generó cambios, **When** el usuario revisa el CV, **Then** puede distinguir el contenido modificado y corregir o descartar la propuesta antes de guardarla.
2. **Given** que el usuario confirma el resultado, **When** guarda el CV, **Then** se conserva como una versión independiente de la fuente y puede previsualizarse y descargarse en PDF.
3. **Given** que el usuario descarta los cambios propuestos, **When** vuelve al CV de origen, **Then** el documento y el contenido originales siguen disponibles sin modificaciones.
4. **Given** que el usuario elimina una fuente de CV importada, **When** confirma la eliminación, **Then** se eliminan el PDF original y todas las versiones derivadas de esa fuente.

### Edge Cases

- El PDF está protegido por contraseña, dañado, vacío, compuesto por páginas escaneadas o no contiene texto extraíble.
- El documento supera el límite de tamaño o cantidad de páginas admitido; el límite se comunica antes de iniciar el procesamiento.
- El CV contiene secciones repetidas, orden inusual, tablas, columnas u otros elementos cuya extracción pueda alterar el orden del contenido.
- La instrucción solicita cambios contradictorios, ambiguos o que requieren información que el usuario no proporcionó.
- La IA falla o devuelve una propuesta incompleta o inválida; el CV original permanece intacto y el usuario recibe un mensaje accionable.
- El usuario cancela la carga o abandona la edición antes de guardar.
- Un usuario intenta ver o modificar un CV perteneciente a otra cuenta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a un usuario autenticado seleccionar y cargar un documento PDF como fuente de un CV.
- **FR-002**: El sistema MUST validar el tipo, la legibilidad y los límites admitidos del archivo antes de procesarlo, y MUST explicar los motivos por los que no se puede continuar.
- **FR-003**: El sistema MUST extraer el contenido reconocible del documento y presentarlo en secciones de CV revisables y editables.
- **FR-004**: El sistema MUST informar cuando no pueda extraer texto del PDF y MUST permitir que el usuario conserve el documento fuente y el contenido de trabajo actual.
- **FR-005**: El usuario MUST poder solicitar en lenguaje natural la edición, adición o eliminación de secciones y experiencias profesionales.
- **FR-006**: La IA MUST devolver propuestas que respeten la estructura del CV y que no modifiquen contenido ajeno a la instrucción, salvo cuando el usuario apruebe expresamente esos cambios.
- **FR-007**: La IA MUST abstenerse de inventar experiencia, fechas, logros, habilidades u otros datos profesionales; MUST solicitar información faltante o señalar la incertidumbre.
- **FR-008**: El sistema MUST mostrar y permitir revisar, corregir, aceptar o descartar cada resultado antes de guardarlo.
- **FR-009**: El sistema MUST conservar el PDF fuente sin cambios y guardar el CV actualizado como una versión diferenciada, solo después de la confirmación del usuario.
- **FR-010**: El usuario MUST poder previsualizar y descargar en PDF la versión guardada.
- **FR-011**: El sistema MUST asociar el PDF fuente, el contenido extraído y las versiones editadas con el usuario autenticado, e impedir el acceso de otros usuarios.
- **FR-012**: Ante errores de extracción, generación o guardado, el sistema MUST informar el fallo sin presentar cambios no confirmados como guardados ni borrar el original.
- **FR-013**: El usuario MUST poder eliminar una fuente de CV importada y todas sus versiones derivadas; el sistema MUST eliminar también el PDF almacenado y MUST informar si la eliminación no puede completarse.

### Key Entities *(include if feature involves data)*

- **PDF fuente**: Documento cargado por el usuario, con nombre, estado de procesamiento y contenido original preservado.
- **CV estructurado**: Representación revisable del contenido extraído y organizado en secciones y experiencias.
- **Instrucción de edición**: Solicitud en lenguaje natural asociada a un CV y a los cambios que se desean.
- **Propuesta de cambios**: Resultado pendiente de revisión, con elementos agregados, editados o eliminados e información que requiere confirmación.
- **Versión de CV**: Estado confirmado del CV, relacionado con su fuente y con las propuestas que el usuario aceptó.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al menos el 90% de los PDFs de texto válidos dentro de los límites publicados se convierten en un CV revisable sin intervención de soporte.
- **SC-002**: Al menos el 90% de las instrucciones válidas para agregar, editar o eliminar contenido producen una propuesta visible para revisión en menos de 60 segundos.
- **SC-003**: En pruebas de aceptación, el 100% de las propuestas de edición preservan intacto el PDF fuente y no se guardan como versión final antes de la confirmación del usuario.
- **SC-004**: En pruebas de aceptación, el 100% de las solicitudes que carecen de datos para afirmar un hecho profesional solicitan aclaración o señalan la falta de información, en lugar de inventarla.
- **SC-005**: Al menos el 90% de los usuarios de prueba pueden cargar un PDF compatible, solicitar un cambio y revisar la propuesta sin asistencia.
- **SC-006**: En pruebas de aceptación, el 100% de las eliminaciones confirmadas retiran el PDF fuente y todas las versiones asociadas, y no permiten volver a acceder a esos datos.

## Assumptions

- La funcionalidad está destinada a usuarios autenticados y reutiliza la identidad y el aislamiento de datos existentes.
- La primera versión admite PDFs legibles con texto extraíble; los documentos escaneados que requieran reconocimiento de imagen pueden rechazarse con una explicación clara.
- El usuario puede revisar y corregir el contenido estructurado si el orden o la división de secciones del PDF no se interpretan correctamente.
- Una solicitud de edición produce una propuesta; no modifica ni guarda el CV automáticamente.
- Guardar cambios crea una versión nueva y no sustituye el PDF original.
- Los límites de tamaño y cantidad de páginas se definirán de acuerdo con las capacidades operativas y se comunicarán al usuario antes del procesamiento.
