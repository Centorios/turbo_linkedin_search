# Feature Specification: Estilos para la plantilla Creativo del PDF

**Feature Branch**: `feat/creative-pdf-styles`
**Created**: 2026-10-16
**Status**: Implemented
**Input**: "Agregar 4 o 5 plantillas distintas para el PDF creativo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir un estilo creativo (Priority: P1)

Como usuario quiero elegir entre varios diseños creativos para mi CV, para adaptarlo a distintos públicos y gustos.

**Independent Test**: Generar un CV, elegir "Creativo PDF" y recorrer los cinco estilos viendo cada vista previa.

**Acceptance Scenarios**:

1. **Given** un CV generado, **When** elijo "Creativo PDF", **Then** veo cinco estilos (Clásico, Barra lateral, Encabezado de color, Elegante serif, Línea de tiempo) y el Clásico queda activo.
2. **Given** un estilo elegido, **When** cambio a ATS y vuelvo a Creativo, **Then** se restaura el último estilo que elegí.
3. **Given** cualquier estilo, **When** miro la vista previa y descargo el PDF, **Then** ambos son el mismo documento.

### User Story 2 - Conservar contenido y foto en todos los estilos (Priority: P1)

Como usuario quiero que cambiar de estilo no altere mi información.

**Acceptance Scenarios**:

1. **Given** un CV con resumen, experiencia, educación, habilidades, idiomas y certificaciones, **When** cambio de estilo, **Then** todo el contenido aparece en cada uno y nunca se muestran datos como el identificador de credencial.
2. **Given** un perfil con foto, **When** elijo cualquier estilo creativo, **Then** la foto aparece; en ATS no aparece.
3. **Given** un CV largo, **When** ocupa varias páginas, **Then** el diseño se mantiene (la barra lateral se repite y las entradas no se cortan a la mitad).

## Requirements *(mandatory)*

- **FR-001**: Hay cinco estilos creativos, definidos en `frontend/app/templates/registry.ts`. El id `creative` es el estilo Clásico y conserva su nombre de archivo.
- **FR-002**: La vista previa y la descarga usan `renderCvPdf`, por lo que todos los estilos se ven igual en ambas.
- **FR-003**: Cada estilo es un documento `@react-pdf/renderer` en `frontend/app/templates/pdf/`. Solo usan fuentes integradas (Helvetica y Times).
- **FR-004**: Todos los estilos usan los textos y títulos de `pdf/shared.tsx`, de modo que el contenido y los estados vacíos sean iguales.
- **FR-005**: El nombre del archivo incluye el estilo (por ejemplo `ana-garcia-creativo-barra-lateral.pdf`).
- **FR-006**: No se agregan dependencias ni cambios de backend.

## Assumptions

- Los estilos no se guardan en el CV ni en la cuenta: la elección vive en la sesión de la página, como la plantilla actual.
- Una URL o un correo muy largos pueden envolverse en varias líneas dentro de columnas angostas; no se recortan.
