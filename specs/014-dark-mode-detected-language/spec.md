# Feature Specification: Modo oscuro e idioma detectado en el CV

**Feature Branch**: `feat/modo-oscuro-idioma`
**Created**: 2026-10-24
**Status**: Implemented
**Input**: "Un botón sol/luna para alternar modo claro/oscuro, coherente con los colores de la app. Y que, si el texto no nombra ningún idioma, el CV muestre el idioma en el que está escrito."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cambiar entre modo claro y oscuro (Priority: P1)

Como usuario quiero alternar entre modo claro y oscuro para usar la app cómodamente a cualquier hora.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla, **When** toco el botón sol/luna, **Then** toda la app cambia de tema con una transición suave y el botón indica la acción siguiente ("Activar modo oscuro" o "Activar modo claro").
2. **Given** que elegí un tema, **When** recargo o vuelvo otro día, **Then** se conserva, sin destello del otro tema al cargar.
3. **Given** que nunca elegí, **When** abro la app, **Then** usa el modo de mi sistema y lo sigue si cambia.
4. **Given** el modo oscuro, **When** miro el CV, **Then** la hoja sigue blanca, porque es un documento para enviar o imprimir.
5. **Given** un celular angosto, **When** abro la app, **Then** el header no genera scroll horizontal.

### User Story 2 - El CV muestra el idioma en el que escribí (Priority: P2)

Como usuario quiero que mi CV tenga una sección "Idiomas" aunque no la haya escrito.

**Acceptance Scenarios**:

1. **Given** un texto en español que no nombra idiomas, **When** genero el CV, **Then** "Idiomas" muestra "Español".
2. **Given** un texto en inglés o en portugués sin idiomas, **When** genero el CV, **Then** muestra "Inglés" o "Portugués".
3. **Given** que el texto sí menciona idiomas, **When** genero el CV, **Then** se respetan y no se agrega ninguno.
4. **Given** un texto muy corto o ambiguo, **When** genero el CV, **Then** la sección queda vacía en vez de adivinar.

## Requirements *(mandatory)*

- **FR-001**: El modo oscuro redefine los tokens de color; los componentes usan clases de token, sin colores fijos.
- **FR-002**: Cada par de texto del tema oscuro llega a 4.5:1 (WCAG AA), verificado por un test que lee los tokens.
- **FR-003**: El tema se aplica antes del primer pintado y respeta la preferencia del sistema y "reducir movimiento".
- **FR-004**: El botón es accesible: `aria-label` con la acción, foco visible y operable con teclado.
- **FR-005**: El idioma se detecta sin servicios externos, solo para Español, Inglés y Portugués, y se agrega sin nivel.
- **FR-006**: No se pisa un idioma que la IA ya encontró, ni se agrega uno si hay duda.

## Assumptions

- El tema claro conserva sus colores; no se rediseña.
- Un texto con idiomas mezclados a partes iguales se considera ambiguo y no suma ningún idioma.
