# Feature Specification: Editar un CV desde el Historial

**Feature Branch**: `feat/editar-cv-historial`
**Created**: 2026-10-23
**Status**: Implemented
**Input**: "En el Historial, agregar un botón 'Editar CV' al lado de 'Descargar PDF' que lleve a 'Editá un CV existente' para modificar esa versión."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editar una versión guardada (Priority: P1)

Como usuario quiero editar cualquier versión de mi Historial con la ayuda de la IA, sin tener que descargarla e importarla como PDF.

**Independent Test**: Abrir una versión en el Historial, tocar "Editar CV", pedir un cambio, revisarlo y guardarlo.

**Acceptance Scenarios**:

1. **Given** una versión abierta en el Historial, **When** toco "Editar CV", **Then** llego a "Editá un CV existente" con esa versión cargada, la sección a la vista y su vista previa.
2. **Given** la versión cargada, **When** pido un cambio y la IA necesita datos, **Then** veo sus preguntas y, al responderlas, una propuesta para revisar.
3. **Given** una propuesta, **When** la guardo, **Then** se crea una versión nueva vinculada a la original, la original no cambia y puedo ir al Historial a verla.
4. **Given** una versión que no existe o es de otra cuenta, **When** abro el enlace, **Then** veo "No encontramos esa versión del CV." y puedo importar un PDF.

## Requirements *(mandatory)*

- **FR-001**: El Historial muestra "Editar CV" junto a "Descargar PDF" para la versión abierta.
- **FR-002**: El editor acepta una versión del historial como base, además de un PDF importado. Oculta las acciones propias del PDF (descargar original, eliminar).
- **FR-003**: Las ediciones usan `POST /api/resumes/{id}/edits` y `POST /api/resumes/{id}/versions`, con la misma validación, preguntas e idempotencia que la importación.
- **FR-004**: Guardar nunca sobrescribe: crea una versión con `parent_resume_id` igual a la base.
- **FR-005**: Solo se puede editar una versión propia; la ajena responde igual que una inexistente.

## Assumptions

- La edición es por instrucciones a la IA, como en "Editá un CV existente". La edición manual de campos queda fuera de esta feature.
- No se requiere migración: se reutilizan las columnas `source_id` y `parent_resume_id` de la migración 009.
