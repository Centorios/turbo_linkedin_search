# Feature Specification: Filtro de belleza para foto de perfil

**Feature Branch**: `[018-photo-beauty-filter]`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "agregar la funcionalidad de agregar filtro a la foto que sacamos con la camara, al momento de tomar la foto que aparezca la opcion de embellecer y se le muestre al usuario la foto original y con los filtros aplicados para que elija"

## Clarifications

### Session 2026-11-07

- Q: ¿Dónde querés que se procese la foto para generar la versión con suavizado de piel? → A: Procesarla en el dispositivo y enviar al flujo de guardado solo la versión elegida.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comparar y elegir la foto embellecida (Priority: P1)

Como usuario que toma una foto de perfil con la cámara, quiero comparar una foto original y una versión que suavice la piel, y elegir si desenfocar el fondo, para controlar la imagen final.

**Why this priority**: La comparación y elección de la versión son el valor central de la funcionalidad solicitada.

**Independent Test**: Tomar una foto válida y comprobar que se muestran las versiones original y embellecida, que se pueden comparar y que la versión elegida continúa al flujo existente de foto de perfil.

**Acceptance Scenarios**:

1. **Given** que el usuario tomó una foto válida con la cámara, **When** termina el procesamiento, **Then** puede ver la foto con fondo desenfocado y una versión que además suaviza la piel, claramente identificadas.
2. **Given** que ambas versiones están disponibles, **When** el usuario elige la versión embellecida, **Then** esa versión se usa como su foto de perfil y puede continuar el flujo actual.
3. **Given** que ambas versiones están disponibles, **When** el usuario elige la foto original, **Then** se usa la foto sin suavizado de piel y con el desenfoque seleccionado.
4. **Given** la revisión de la foto, **When** el usuario desactiva o activa el interruptor de fondo, **Then** ambas alternativas reflejan su elección sin confirmar la foto.

### User Story 2 - Conservar el control de la captura (Priority: P2)

Como usuario, quiero cancelar la comparación o repetir la captura, para no guardar una foto hasta estar conforme con una de las alternativas.

**Why this priority**: Evitar una confirmación accidental protege la elección del usuario y completa el flujo de captura.

**Independent Test**: Desde la comparación, cancelar y volver a tomar la foto; confirmar que ninguna alternativa pendiente se guarda y que la cámara puede usarse de nuevo según el flujo actual.

**Acceptance Scenarios**:

1. **Given** la vista de comparación, **When** el usuario decide no continuar, **Then** puede cancelar o volver a tomar la foto sin confirmar ninguna de las dos versiones.
2. **Given** que no se pudo generar la versión embellecida, **When** el usuario revisa las opciones, **Then** conserva la posibilidad de usar la original y recibe un aviso claro.

### Edge Cases

- Si no se puede generar la versión embellecida, el usuario conserva la opción de usar la original y recibe un aviso claro.
- Si no se puede separar a la persona del fondo, el usuario recibe un aviso y puede elegir la captura original sin efectos.
- Si el usuario cancela la comparación o elige tomar otra foto, ninguna versión pendiente reemplaza la foto de perfil.
- El efecto debe conservar los rasgos y detalles faciales; no debe cambiar la forma del rostro ni funcionar como maquillaje o retoque personalizado.
- La comparación debe seguir siendo comprensible en pantallas pequeñas y con las reglas de captura de cámara ya existentes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Después de una captura válida desde la cámara, el sistema MUST ofrecer una comparación entre una versión con fondo desenfocado y otra que además suaviza sutilmente la piel.
- **FR-002**: El sistema MUST identificar claramente cuál alternativa es la original y cuál tiene el efecto aplicado.
- **FR-003**: El usuario MUST poder seleccionar la foto original o la embellecida antes de confirmar la foto de perfil.
- **FR-004**: El sistema MUST continuar con la versión seleccionada, respetando el estado del desenfoque; solo la embellecida MUST suavizar la piel.
- **FR-005**: El sistema MUST mantener disponible la foto original si no puede producir la alternativa embellecida y MUST informar al usuario de esa limitación.
- **FR-006**: El usuario MUST poder cancelar la comparación o volver a tomar la foto sin confirmar una imagen pendiente.
- **FR-007**: El efecto MUST limitarse a un embellecimiento general y sutil de la piel; MUST NOT ofrecer filtros personalizados, controles de intensidad, maquillaje ni cambios de rasgos faciales.
- **FR-008**: El flujo MUST conservar las reglas existentes de captura y validación de la foto.
- **FR-009**: El sistema MUST procesar la alternativa embellecida en el dispositivo, mantener ambas alternativas dentro del flujo de selección y continuar el guardado existente únicamente con la imagen elegida por el usuario.
- **FR-010**: El sistema MUST ofrecer un interruptor accesible de desenfoque, activado por defecto para cada captura, que afecta ambas alternativas y usa segmentación local.
- **FR-011**: Si la segmentación falla, el sistema MUST informar que no pudo desenfocar el fondo, desactivar el interruptor y permitir elegir la captura original y, si está disponible, la embellecida sin desenfoque.

### Key Entities *(include if feature involves data)*

- **Foto original**: Captura sin suavizado de piel, con o sin fondo desenfocado según la elección.
- **Foto embellecida**: Alternativa con suavizado general y sutil de la piel y con o sin fondo desenfocado según la elección.
- **Foto seleccionada**: Alternativa confirmada por el usuario para continuar el flujo existente de foto de perfil.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de las capturas válidas de prueba, el usuario ve la foto original y la alternativa embellecida o, si esta no está disponible, un aviso junto con la opción de usar la original.
- **SC-002**: En el 100% de las pruebas de selección, la imagen confirmada coincide con la alternativa elegida por el usuario.
- **SC-003**: Al menos 9 de cada 10 usuarios de prueba pueden distinguir las dos alternativas y seleccionar una sin ayuda.
- **SC-004**: En pruebas con dispositivos móviles y de escritorio, cancelar o volver a tomar la foto no confirma accidentalmente una alternativa pendiente.

## Assumptions

- La funcionalidad aplica únicamente a fotos tomadas con la cámara en el flujo actual de foto de perfil; las imágenes cargadas desde archivos quedan fuera de alcance y no se desenfocan.
- El embellecimiento usa un único efecto general de baja intensidad; el usuario no necesita ajustar parámetros para comparar y elegir.
- El procesamiento de la foto se realiza en el dispositivo; no se envía la imagen original a un servicio externo para aplicar el efecto.
- Los controles existentes de permiso de cámara, validación de captura, confirmación y guardado de foto se conservan.
- Solo la imagen seleccionada por el usuario continúa al flujo existente de guardado de la foto de perfil.
