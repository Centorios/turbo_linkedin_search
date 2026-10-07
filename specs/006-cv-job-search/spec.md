# Feature Specification: Búsqueda de empleos desde un CV

**Feature Branch**: `codex/006-cv-job-search`
**Created**: 2026-10-07
**Status**: Ready
**Input**: "Usar los puestos y palabras clave generados por el flujo de CV para buscar y listar empleos, empezando por Argentina."

## User Scenarios & Testing

### User Story 1 - Preparar una búsqueda desde un CV (Priority: P1)

Como usuario autenticado quiero elegir un CV guardado y revisar las palabras de búsqueda sugeridas para buscar puestos relacionados con mi experiencia.

**Why this priority**: El CV ya contiene información estructurada que evita empezar una búsqueda desde cero.

**Independent Test**: Elegir un CV con experiencia y habilidades, comprobar que se propone un puesto y una ubicación y editar ambos antes de buscar.

**Acceptance Scenarios**:

1. **Given** un CV propio con un puesto laboral, **When** lo selecciono, **Then** veo ese puesto como término de búsqueda sugerido y puedo editarlo.
2. **Given** un CV sin puestos, **When** lo selecciono, **Then** se sugieren habilidades técnicas verificadas o se me pide escribir un término.
3. **Given** un CV de otra cuenta, **When** solicito sus sugerencias, **Then** no obtengo datos ni confirmación de su existencia.

### User Story 2 - Buscar y revisar empleos de Argentina (Priority: P1)

Como usuario quiero buscar empleos con los términos revisados y ver una lista de ofertas vigentes para abrir la que me interese.

**Why this priority**: Convierte el CV en un punto de partida útil para encontrar oportunidades reales.

**Independent Test**: Buscar un puesto con ubicación argentina, ver ofertas con datos básicos y abrir una oferta en su fuente.

**Acceptance Scenarios**:

1. **Given** términos y ubicación válidos, **When** inicio la búsqueda, **Then** veo ofertas con título, empresa, ubicación, resumen, fuente y enlace.
2. **Given** ofertas repetidas en la respuesta, **When** se muestra la lista, **Then** cada identificador aparece una sola vez.
3. **Given** cero resultados o un fallo de la fuente, **When** termina la búsqueda, **Then** veo un estado claro y puedo modificar los términos o reintentar.
4. **Given** una sesión caducada, **When** busco, **Then** no se envían datos privados ni se muestran resultados de otra cuenta.

### Edge Cases

- CV sin experiencia ni habilidades utilizables.
- Ubicación del CV ausente o fuera de Argentina; el usuario puede corregirla.
- Fuente de ofertas sin configurar, temporalmente caída o con datos incompletos.
- Cambio de cuenta o de CV durante una búsqueda; las respuestas anteriores no se muestran.
- Descripciones con HTML y enlaces inválidos de la fuente externa.

## Requirements

### Functional Requirements

- **FR-001**: El usuario MUST poder seleccionar uno de sus CVs guardados como base de búsqueda.
- **FR-002**: El sistema MUST sugerir un término a partir del puesto profesional o de habilidades técnicas presentes en el CV validado, sin inventar competencias.
- **FR-003**: El usuario MUST poder revisar y editar término y ubicación antes de consultar ofertas.
- **FR-004**: La primera fuente MUST ofrecer búsqueda de ofertas para Argentina mediante acceso autorizado.
- **FR-005**: La búsqueda MUST enviar a la fuente solamente término y ubicación, sin datos personales ni el CV completo.
- **FR-006**: Cada resultado MUST mostrar título, empresa si existe, ubicación, resumen, fuente y enlace seguro a la oferta.
- **FR-007**: El sistema MUST eliminar duplicados por identificador de fuente y rechazar enlaces inválidos.
- **FR-008**: Las sugerencias y búsquedas MUST comprobar autenticación y propiedad del CV.
- **FR-009**: La interfaz MUST distinguir carga, lista, vacío, configuración faltante y fallo temporal, con reintento cuando corresponda.
- **FR-010**: El sistema MUST evitar consultas automáticas a la fuente al cargar la página o cambiar el CV; el usuario inicia cada búsqueda.
- **FR-011**: La interfaz MUST descartar respuestas tardías cuando cambie la cuenta, el CV o los términos de búsqueda.

### Key Entities

- **CV guardado**: versión validada y privada del historial del usuario.
- **Perfil de búsqueda**: puesto y ubicación sugeridos, más habilidades verificadas como ayuda editable.
- **Oferta laboral**: referencia de fuente, identificador, título, empresa, ubicación, resumen, fecha disponible y enlace.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Un usuario con un CV guardado puede llegar a una lista de hasta 20 ofertas en tres acciones o menos desde la página de búsqueda.
- **SC-002**: En las pruebas de dos cuentas, ninguna obtiene sugerencias o resultados basados en un CV ajeno.
- **SC-003**: El 100% de las ofertas mostradas tiene título y enlace HTTPS válido; no aparecen identificadores duplicados.
- **SC-004**: Los estados de cero resultados, fuente no configurada y error permiten al usuario continuar sin perder sus términos editados.

## Assumptions

- Esta primera entrega cubre búsqueda y listado. Guardar favoritos, histórico de ofertas, embeddings, puntuación de afinidad y procesamiento periódico quedan para entregas posteriores.
- La ubicación inicial es la del CV si existe; de otro modo, Argentina. Se puede editar antes de buscar.
- La fuente de ofertas requiere una credencial regional administrada por el servidor; hasta configurarla, la interfaz comunica su ausencia.
- Las ofertas se abren en su sitio de origen. El sistema no envía solicitudes de postulación.
