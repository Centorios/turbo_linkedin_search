# Feature Specification: Historial de CVs de la cuenta

**Feature Branch**: `codex/005-account-cv-history`
**Created**: 2026-09-30
**Status**: Ready
**Input**: "Agregar un historial de cuenta donde guardar antiguos intentos de CV"

## User Scenarios & Testing

### User Story 1 - Encontrar intentos anteriores (Priority: P1)
Como usuario quiero encontrar los CVs que generé antes, incluso después de cerrar sesión.
**Why this priority**: Evita perder trabajo y regenerar documentos.
**Independent Test**: Generar dos CVs, volver a iniciar sesión y ver ambos con fecha, más nuevo primero.
**Acceptance Scenarios**:
1. **Given** dos CVs exitosos, **When** abro Historial, **Then** veo ambos ordenados por fecha sin duplicados de reintentos.
2. **Given** más de una página de resultados, **When** avanzo o retrocedo, **Then** puedo recuperar todas las versiones.
3. **Given** cuenta sin CVs o error de carga, **When** abro Historial, **Then** veo un estado vacío o un mensaje con reintento.

### User Story 2 - Revisar y descargar una versión (Priority: P2)
Como usuario quiero abrir un CV anterior y descargarlo en la plantilla que elija.
**Why this priority**: Hace útil el archivo de versiones.
**Independent Test**: Cambiar perfil actual y abrir un CV antiguo; mantiene los datos históricos y permite descargar ambas plantillas.
**Acceptance Scenarios**:
1. **Given** un CV antiguo, **When** lo abro, **Then** reviso sus datos originales, sin generar contenido nuevo.
2. **Given** una versión abierta, **When** selecciono ATS o visual, **Then** puedo descargar el PDF correspondiente.
3. **Given** foto histórica eliminada, **When** abro el CV, **Then** el texto sigue disponible.

### User Story 3 - Mantener el historial privado (Priority: P1)
Como usuario quiero que solo mi cuenta tenga acceso a mis CVs.
**Why this priority**: La experiencia profesional es privada.
**Independent Test**: Dos cuentas acceden a listas e IDs; ninguna puede leer documentos de la otra.
**Acceptance Scenarios**:
1. **Given** una cuenta distinta, **When** solicita el ID de otro CV, **Then** no obtiene ni datos ni confirmación de su existencia.
2. **Given** cierre o cambio de cuenta durante la carga, **When** completa una solicitud anterior, **Then** no aparece contenido de la cuenta previa.

### Edge Cases
- Historial vacío, errores de almacenamiento, sesión expirada e ID inválido.
- CVs con la misma fecha se ordenan de forma estable.
- Clics rápidos en versiones distintas no muestran un resultado atrasado.
- Intentos fallidos no tienen CV para guardar; el historial contiene generaciones exitosas.

## Requirements
### Functional Requirements
- **FR-001**: Cada CV exitoso MUST guardarse automáticamente como versión independiente de la cuenta.
- **FR-002**: El historial MUST mostrar nombre, fecha y resumen, con navegación por páginas y orden descendente estable.
- **FR-003**: Cada versión MUST permitir vista previa, selección ATS/visual y PDF.
- **FR-004**: Abrir una versión MUST conservar su contenido original y no consultar IA.
- **FR-005**: Lista y detalle MUST validar sesión y dueño; otros usuarios no pueden leer registros.
- **FR-006**: Carga, vacío y errores MUST ser explícitos; errores permiten reintentar.
- **FR-007**: Cambiar o cerrar cuenta MUST retirar inmediatamente datos previos y descartar respuestas tardías.
- **FR-008**: Pruebas MUST verificar aislamiento, persistencia, paginación y flujo de revisión/exportación.

### Key Entities
- Versión de CV: identificador, fecha, contenido estructurado original y dueño.
- Página de historial: lista resumida, posición y disponibilidad de siguiente página.

## Success Criteria
### Measurable Outcomes
- **SC-001**: Dos generaciones distintas aparecen tras recargar y volver a iniciar sesión; un reintento no crea otra versión.
- **SC-002**: Una cuenta con 21 versiones puede abrir todas mediante navegación por páginas.
- **SC-003**: Cero documentos de otra cuenta accesibles en pruebas de lista, detalle y cambio de sesión.
- **SC-004**: Ambas plantillas descargan un PDF legible de una versión antigua sin generación adicional.

## Assumptions
- "Intentos" significa CVs generados exitosamente; errores de IA no son documentos.
- Se reutilizan los registros existentes; no se incluyen edición, eliminación ni renombrado.
- Los datos personales históricos se mantienen aunque el perfil actual cambie.
