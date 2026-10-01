# Feature Specification: Logo de CV y motor

**Feature Branch**: `codex/004-cv-engine-logo`
**Created**: 2026-09-30
**Status**: Ready
**Input**: "Hacer un logo que involucre una hoja escrita como un CV y un motor"

## User Scenarios & Testing

### User Story 1 - Identificar la marca (Priority: P1)
Como usuario quiero reconocer CV8 con una hoja de currículum y un motor que sugiera impulso profesional.
**Why this priority**: Define la identidad solicitada.
**Independent Test**: Ver logo en acceso y cabecera y comparar ambos símbolos.
**Acceptance Scenarios**:
1. **Given** el acceso o generador, **When** veo la marca, **Then** encuentro una hoja con líneas escritas junto a un motor y el nombre CV8.
2. **Given** un lector de pantalla, **When** encuentra el logo, **Then** anuncia CV8 una sola vez.

### User Story 2 - Reconocer la pestaña (Priority: P2)
Como usuario quiero reconocer el mismo símbolo en la pestaña del navegador.
**Why this priority**: Coherencia entre aplicación y navegador.
**Independent Test**: Inspeccionar icono a 16 y 32 px.
**Acceptance Scenarios**:
1. **Given** una pestaña, **When** se muestra el icono, **Then** conserva la hoja y motor sin recortes.

### Edge Cases
- Legibilidad a tamaños pequeños y fondo claro.
- Múltiples instancias no deben interferir entre sí.

## Requirements
### Functional Requirements
- **FR-001**: La marca MUST combinar hoja escrita y motor reconocible.
- **FR-002**: Acceso y cabecera MUST usar la misma marca con nombre CV8.
- **FR-003**: El icono de pestaña MUST compartir la identidad.
- **FR-004**: La marca MUST tener nombre accesible y conservar proporciones al escalar.

## Success Criteria
### Measurable Outcomes
- **SC-001**: Los tres puntos de marca (acceso, cabecera, pestaña) muestran el símbolo nuevo.
- **SC-002**: Cero recortes a 16, 32 y 48 px.
- **SC-003**: Lectores de pantalla identifican CV8 como una imagen.

## Assumptions
- Conservar nombre CV8 y usar un motor mecánico como metáfora de impulso.
- No cambiar el formato ni contenido de los CVs.
