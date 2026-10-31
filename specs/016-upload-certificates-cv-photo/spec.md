# Feature Specification: Certificados y foto al generar y editar CV

**Feature Branch**: `master` (feature directory: `016-upload-certificates-cv-photo`)

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "El usuario puede subir certificados al generar un CV o a CVs existentes; se agregan automáticamente si aún no figuran en el CV. Los certificados pertenecen al perfil del usuario y, al generar un CV, puede subir nuevos o seleccionar los ya asociados. Al editar un CV sin foto puede agregarla; si ya tiene foto puede gestionarla."

## Clarifications

### Session 2026-10-31

- Q: Si el CV ya tiene foto, ¿qué debería permitir la opción «Editar CV»? → A: Mostrar la foto actual y permitir reemplazarla o quitarla.
- Q: Después de extraer los datos de un certificado, ¿debe conservarse el archivo original en la cuenta del usuario? → A: Sí; los certificados y sus archivos se asocian al perfil del usuario, no a cada CV, para reutilizarlos al generar otros CVs.
- Q: Al generar un CV nuevo, ¿deben venir seleccionados todos los certificados del perfil o debe elegirlos el usuario? → A: Ningún certificado existente viene seleccionado; el usuario puede elegirlos individualmente o pulsar «Seleccionar todos».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agregar certificados durante la generación (Priority: P1)

Como usuario autenticado, quiero subir certificados de idiomas, cursos u otras credenciales a mi perfil y elegir cuáles incluir mientras preparo mi CV, para reutilizarlos sin volver a cargarlos.

**Why this priority**: Resuelve el flujo principal de creación y evita omitir credenciales relevantes.

**Independent Test**: Subir un certificado legible al perfil desde la generación, seleccionarlo junto a otro certificado ya asociado y verificar que ambos aparecen una sola vez en la vista previa y en el PDF.

**Acceptance Scenarios**:

1. **Given** un formulario de generación con datos profesionales válidos, **When** subo un certificado legible, **Then** se incorpora a mi perfil y puedo seleccionarlo para el CV en preparación.
2. **Given** certificados ya asociados a mi perfil, **When** abro la generación de un CV, **Then** los veo sin seleccionar y puedo elegirlos individualmente o pulsar «Seleccionar todos», sin subirlos de nuevo.
3. **Given** que el texto de entrada ya menciona un certificado seleccionado, **When** genero el CV, **Then** la certificación figura una sola vez y conserva los datos más completos respaldados por la entrada.
4. **Given** varios certificados seleccionados, **When** genero el CV, **Then** cada credencial distinta se incorpora una sola vez sin reemplazar otras secciones.
5. **Given** certificados existentes que no seleccioné, **When** genero el CV, **Then** esas credenciales no se agregan por el solo hecho de estar en mi perfil.

---

### User Story 2 - Incorporar certificados a un CV existente (Priority: P1)

Como usuario autenticado, quiero seleccionar certificados de mi perfil o subir otros desde "Editar CV" para completar una versión guardada sin describir cada credencial en una instrucción de texto.

**Why this priority**: Permite actualizar CVs existentes y reutilizar el historial.

**Independent Test**: Abrir una versión del historial, seleccionar un certificado del perfil ausente en el CV y guardar; verificar que la versión nueva lo incluye y que la original no cambió.

**Acceptance Scenarios**:

1. **Given** un CV propio sin una credencial de mi perfil, **When** la selecciono o subo un nuevo certificado al perfil desde el editor, **Then** la certificación se agrega automáticamente a la propuesta y puedo revisarla antes de guardar una versión nueva.
2. **Given** un CV que ya contiene la misma credencial, **When** la selecciono o vuelvo a subir su archivo, **Then** se me informa que ya figura en el CV y no se crea una segunda entrada ni una versión sin cambios.
3. **Given** un lote que contiene credenciales nuevas y repetidas, **When** se procesa, **Then** se agregan solo las nuevas al perfil y a la propuesta del CV, y se informa cuáles se omitieron por duplicadas.

---

### User Story 3 - Agregar o gestionar la foto al editar (Priority: P1)

Como usuario autenticado, quiero agregar una foto a un CV que generé sin ella y poder reemplazar o quitar una foto existente para mantener actualizada cada versión.

**Why this priority**: El usuario no debe quedar limitado por la decisión tomada durante la generación inicial.

**Independent Test**: Abrir un CV sin foto, agregar una imagen, revisar la vista previa y guardar una nueva versión; repetir con un CV con foto para reemplazarla o quitarla.

**Acceptance Scenarios**:

1. **Given** un CV propio sin foto, **When** presiono "Editar CV", **Then** encuentro una acción para agregar foto y la imagen elegida aparece en la vista previa donde la plantilla admite fotos.
2. **Given** un CV propio con foto, **When** presiono "Editar CV", **Then** veo la foto actual y opciones para reemplazarla o quitarla.
3. **Given** un cambio de foto revisado, **When** lo guardo, **Then** se crea una versión nueva con ese estado de foto y la versión original conserva su imagen o ausencia de ella.
4. **Given** una plantilla que no muestra fotos, **When** agrego o cambio la foto, **Then** se conserva en la versión y se me indica que esa plantilla no la incluye en el documento exportado.

### Edge Cases

- Archivo de certificado vacío, ilegible, protegido, dañado, de tipo no admitido o fuera de los límites publicados: se explica el motivo y el CV en edición permanece intacto.
- Certificado con nombre similar pero distinta entidad emisora o distinta credencial: no se elimina como duplicado por la coincidencia parcial del título.
- Datos contradictorios o identidad de una credencial incierta: se pide revisión antes de incorporar esa entrada; no se inventan emisor, fecha, nivel ni identificador.
- Carga repetida por reintento o doble pulsación: una credencial no aparece dos veces.
- Certificado ya presente en el perfil: se reutiliza el registro existente y no se crea otro archivo o credencial por volver a subirlo.
- Imagen inválida o carga fallida: se conserva la foto anterior y los demás cambios pendientes.
- Sesión expirada o intento de acceder a un CV o archivo de otro usuario: no se muestra ni modifica el contenido privado.
- Abandono de la edición sin guardar: la versión persistida permanece intacta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir subir uno o varios certificados al perfil del usuario desde la generación y desde la edición de un CV propio.
- **FR-002**: El sistema MUST admitir documentos PDF con texto legible e imágenes JPEG o PNG legibles; MUST mostrar los tipos y límites de tamaño admitidos antes de la carga y validar el contenido recibido.
- **FR-003**: El sistema MUST extraer únicamente los datos de certificación respaldados por el archivo: nombre, entidad emisora, fecha de obtención, vencimiento e identificador o referencia cuando estén disponibles; para certificados de idioma, MUST conservar idioma y nivel cuando consten en el documento.
- **FR-004**: El sistema MUST adaptar los datos extraídos a la estructura válida de certificaciones del CV y MUST verificar su validez antes de mostrarlos, guardarlos o incluirlos en la exportación.
- **FR-005**: El sistema MUST comparar cada certificado nuevo con los ya asociados al perfil, con las certificaciones presentes en el CV y con otros archivos de la misma carga; MUST considerar equivalentes los que comparten una credencial o referencia identificable, o el mismo nombre y emisor con fecha de obtención compatible, ignorando diferencias de mayúsculas, acentos y espacios.
- **FR-006**: El sistema MUST evitar duplicados en el perfil y el CV; MUST conservar los datos existentes y solo completar campos vacíos con información respaldada y no contradictoria.
- **FR-007**: Durante la generación y la edición, el sistema MUST mostrar los certificados asociados al perfil sin seleccionarlos por defecto, permitir elegirlos individualmente y ofrecer la acción «Seleccionar todos»; las certificaciones seleccionadas que aún no figuran en el CV MUST agregarse automáticamente a la propuesta.
- **FR-008**: Si no puede determinar con suficiente certeza la identidad o algún dato de un certificado, el sistema MUST pedir corrección o confirmación de ese dato antes de incorporarlo, sin inventar información.
- **FR-009**: El sistema MUST permitir agregar una foto durante la edición de un CV sin foto y MUST permitir visualizar, reemplazar o quitar la foto de un CV que ya la tenga.
- **FR-010**: El sistema MUST validar tipo y tamaño de la foto, mostrar una vista previa y mantener el estado anterior cuando la imagen no sea válida o falle la carga.
- **FR-011**: Al guardar cambios en un CV existente, el sistema MUST crear una versión nueva vinculada a la anterior; MUST preservar la versión original y las secciones no editadas.
- **FR-012**: Las certificaciones seleccionadas y la foto confirmadas MUST persistir en la versión correspondiente, aparecer en la vista previa y mantenerse en el PDF de las plantillas que las admitan. Si una plantilla omite fotos, el sistema MUST informar esa limitación antes de exportar.
- **FR-013**: El sistema MUST autorizar cada carga, lectura y modificación para el usuario propietario del perfil o CV; otros usuarios no deben poder acceder a los archivos ni a sus datos extraídos.
- **FR-014**: El sistema MUST permitir retirar un archivo seleccionado antes de confirmar y MUST comunicar los fallos de procesamiento o guardado sin presentar contenido no guardado como persistido.
- **FR-015**: El sistema MUST conservar los archivos de certificado en el perfil del usuario y permitirle volver a consultar sus datos y el archivo original; una versión de CV MUST referir las certificaciones incorporadas sin crear una copia del archivo para cada CV.
- **FR-016**: Antes de generar, el sistema MUST mostrar los certificados seleccionados; antes de guardar una edición y antes de descargar un CV generado, MUST mostrar las certificaciones incorporadas, omitidas por duplicadas y pendientes de revisión.
- **FR-017**: Subir un certificado nuevo durante la generación o edición MUST dejarlo seleccionado para el CV en curso, con opción de desmarcarlo antes de confirmar; los certificados previos del perfil MUST permanecer sin seleccionar.

### Key Entities *(include if feature involves data)*

- **Certificado del perfil**: Archivo aportado por el usuario y asociado a su perfil, con nombre, tipo, resultado de lectura y datos de la credencial; puede reutilizarse en distintos CVs.
- **Certificación del CV**: Credencial estructurada con nombre, emisor, fechas y referencia cuando existan; puede proceder de texto libre o de un certificado del perfil seleccionado para esa versión.
- **Foto del CV**: Imagen opcional vinculada a una versión concreta y su estado visible, reemplazado o retirado.
- **Versión de CV**: Documento estructurado que reúne las certificaciones seleccionadas y la foto confirmadas, vinculado a una versión previa cuando procede de una edición, sin duplicar los archivos originales de certificado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En pruebas con archivos legibles y compatibles, al menos el 90% de los usuarios completa la carga de un certificado y localiza su resultado en la vista previa sin asistencia en menos de 3 minutos, excluyendo el tiempo de generación del CV.
- **SC-002**: En pruebas de aceptación, el 100% de los certificados equivalentes cargados de nuevo se omite como duplicado y el 100% de las credenciales claramente distintas se conserva.
- **SC-003**: En pruebas de aceptación, el 100% de las ediciones de certificados o foto crea una versión nueva y conserva intacta la versión de origen.
- **SC-004**: En pruebas de aceptación, el 100% de los CVs sin foto permite agregar una desde "Editar CV" y el 100% de los CVs con foto permite reemplazarla o quitarla.
- **SC-005**: En pruebas de aceptación, el 100% de las certificaciones y fotos confirmadas que admite la plantilla elegida aparece de forma consistente en la vista previa y en el PDF descargado.
- **SC-006**: El 100% de los archivos inválidos y de los intentos de acceso a archivos ajenos se rechaza sin alterar versiones guardadas.
- **SC-007**: En pruebas de aceptación, el 100% de los certificados asociados al perfil puede seleccionarse de nuevo al generar otro CV sin volver a subir el archivo.
- **SC-008**: En pruebas de aceptación, ningún certificado previo del perfil aparece seleccionado al iniciar un CV nuevo; «Seleccionar todos» marca el 100% de los disponibles y el usuario puede desmarcar cualquiera antes de generar.

## Assumptions

- Los archivos originales de certificados permanecen en el perfil del usuario; el PDF del CV muestra las credenciales seleccionadas, sin anexar las páginas originales.
- La extracción de certificados en imagen requiere que el texto sea suficientemente legible. Los límites concretos de tamaño se definirán durante la planificación y se comunicarán antes de subir archivos.
- Un certificado de idioma se representa como certificación; el nivel o idioma se añade también a la sección de idiomas solo cuando el documento lo acredita y la incorporación no genera una entrada duplicada.
- La foto pertenece a una versión de CV. No se agrega automáticamente desde la foto de perfil ni se modifica la foto de perfil al editar el CV.
- Esta feature amplía la generación y la edición de CVs existentes; no incluye verificación con entidades emisoras externas ni cambios en el motor de búsqueda laboral.
