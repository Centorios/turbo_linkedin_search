# Feature Specification: Recomendaciones de empleos con Match

**Feature Branch**: `007-job-match-recommendations`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Cuando el usuario realiza una búsqueda de empleos y obtiene resultados, debe tener acceso a un botón “Match”, acompañado de la descripción: “Recibí hasta tres recomendaciones de las ofertas encontradas que mejor se adapten a tu perfil profesional”. El matching debe utilizar el CV seleccionado para esa búsqueda y exclusivamente las ofertas obtenidas en ella, sin iniciar una nueva búsqueda. Debe generar embeddings del perfil y de las ofertas con un modelo de embeddings desplegado en Azure, distinto del modelo que genera los CVs, y usar Supabase pgvector para almacenarlos y recuperar los candidatos más relevantes. Luego el modelo que genera los CVs debe analizar perfil y ofertas candidatas y recomendar hasta tres empleos, explicando coincidencias y requisitos no acreditados en el CV. Las recomendaciones deben basarse solo en datos disponibles, señalar información faltante, poder ser menos de tres o ninguna, y no presentar la afinidad como probabilidad de contratación. El procesamiento debe permitir seguir usando la aplicación y mostrar su estado. Las recomendaciones permanecen asociadas al CV y a la búsqueda que las originó, y cada usuario solo accede a sus propios CVs y resultados. Conservar la búsqueda laboral actual y permitir abrir la publicación original de cada oferta recomendada."

## Clarifications

### Session 2026-10-08

- Q: Si ya hay recomendaciones para una búsqueda y un CV, ¿qué debe pasar al pulsar Match de nuevo? → A: Mostrar las recomendaciones guardadas y ofrecer "Recalcular", que reemplaza el resultado anterior.
- Q: ¿Cuánto tiempo se conservan búsquedas, ofertas, vectores y recomendaciones, y qué pasa si se elimina el CV? → A: Se conservan mientras exista el CV; al eliminarlo se borran también sus búsquedas, ofertas, vectores y recomendaciones.
- Q: ¿Qué debe ver la persona si falla la generación de vectores o el análisis? → A: Estado "Falló" con mensaje claro y botón "Reintentar"; se conserva el resultado previo si existía.
- Q: ¿Qué debe pasar con las recomendaciones guardadas si la persona edita el CV después de generarlas? → A: Se conservan y se muestra el aviso "El CV cambió desde este análisis" con la opción de Recalcular.
- Q: ¿Cómo se muestra la afinidad y qué criterio decide que una oferta es adecuada? → A: Etiqueta cualitativa (Alta / Media) decidida por el modelo según los requisitos acreditados; las ofertas de afinidad baja no se recomiendan.
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pedir recomendaciones sobre una búsqueda (Priority: P1)

Una persona con sesión iniciada busca empleos con uno de sus CVs y obtiene resultados. Junto a ellos ve el botón **Match** con la descripción “Recibí hasta tres recomendaciones de las ofertas encontradas que mejor se adapten a tu perfil profesional”. Al pulsarlo, el sistema evalúa únicamente las ofertas ya listadas contra el CV elegido en esa búsqueda y le presenta hasta tres recomendaciones ordenadas por afinidad, cada una con su explicación.

**Why this priority**: Es el valor central de la entrega: pasar de una lista de ofertas a una selección priorizada y justificada.

**Independent Test**: Realizar una búsqueda con resultados, pulsar Match y comprobar que aparecen hasta tres ofertas de esa misma lista, cada una con una explicación, sin que se haya lanzado otra búsqueda.

**Acceptance Scenarios**:

1. **Given** una búsqueda con resultados hecha con un CV, **When** la persona abre la lista, **Then** ve el botón Match y su descripción.
2. **Given** esa lista de resultados, **When** pulsa Match, **Then** el sistema usa solo el CV de esa búsqueda y solo esas ofertas, y no consulta nuevamente la fuente de empleos.
3. **Given** que el análisis termina con ofertas adecuadas, **When** se muestran las recomendaciones, **Then** son como máximo tres, ordenadas de mayor a menor afinidad, y todas pertenecen a los resultados de la búsqueda.
4. **Given** una búsqueda sin resultados, **When** se muestra la pantalla, **Then** el botón Match no está disponible o está deshabilitado con una explicación.

---

### User Story 2 - Entender por qué encaja y qué falta (Priority: P1)

Para cada oferta recomendada, la persona lee una explicación clara de qué elementos de su CV coinciden con la oferta y qué requisitos de la oferta no están acreditados en el CV. Si la oferta no aporta datos suficientes para evaluar algún aspecto, la recomendación lo indica de forma explícita.

**Why this priority**: Sin explicación, la recomendación no es accionable ni confiable; es parte inseparable del valor de la función.

**Independent Test**: Generar recomendaciones y verificar que cada una lista coincidencias, requisitos no acreditados y, cuando corresponda, información faltante, sin afirmar experiencia o requisitos ausentes en las fuentes.

**Acceptance Scenarios**:

1. **Given** una recomendación, **When** la persona la abre, **Then** ve coincidencias concretas entre su CV y la oferta.
2. **Given** una oferta que exige algo que el CV no acredita, **When** se muestra la recomendación, **Then** ese requisito aparece como no acreditado y no como cumplido.
3. **Given** una oferta con descripción escasa, **When** se muestra la recomendación, **Then** se señala qué información falta para evaluarla.
4. **Given** cualquier recomendación, **When** se muestra la afinidad, **Then** se presenta como etiqueta cualitativa (Alta o Media) de coincidencia entre perfil y oferta y nunca como probabilidad de ser contratado.

---

### User Story 3 - Estado de carga, timeouts y errores (Priority: P2)

El Match se resuelve de forma **sincrónica**: la petición espera el resultado, sin cola ni worker. Mientras dura, la persona ve un estado de carga claro ("Analizando…"). Si el análisis supera el tiempo máximo o falla, ve un mensaje comprensible y puede reintentar.

**Why this priority**: El análisis puede tardar decenas de segundos; la persona debe saber que está en curso y no quedar sin información si algo falla.

**Independent Test**: Pulsar Match y comprobar el estado de carga; simular timeout y error de proveedor y comprobar el mensaje y el botón "Reintentar".

**Acceptance Scenarios**:

1. **Given** que se pulsó Match, **When** el análisis está en curso, **Then** se muestra el estado "Analizando…" y el botón queda deshabilitado, sin permitir un segundo análisis idéntico.
2. **Given** un análisis en curso, **When** la persona usa otras partes de la pantalla (por ejemplo, abre ofertas), **Then** la interfaz sigue respondiendo.
3. **Given** que el análisis excede el tiempo máximo, **When** vence el plazo, **Then** se informa que tardó demasiado y se permite reintentar.
4. **Given** que falla un proveedor, **When** se informa el error, **Then** el mensaje explica el problema sin datos técnicos, permite reintentar y conserva el resultado previo si existía.
5. **Given** que la persona sale de la pantalla durante el análisis, **When** regresa, **Then** ve el resultado guardado si el análisis terminó en el servidor, o puede volver a pulsar Match.

---

### User Story 4 - Recuperar recomendaciones y abrir la oferta original (Priority: P2)

Las recomendaciones quedan guardadas junto al CV y a la búsqueda que las originaron. La persona puede volver a verlas más tarde y abrir la publicación original de cada oferta recomendada en una pestaña nueva.

**Why this priority**: Permite consultar el resultado sin repetir el análisis y facilita pasar a postularse.

**Independent Test**: Generar recomendaciones, salir y volver a entrar, comprobar que siguen asociadas a su CV y búsqueda, y abrir el enlace original de una oferta.

**Acceptance Scenarios**:

1. **Given** recomendaciones ya generadas, **When** la persona vuelve a la búsqueda, **Then** las ve asociadas al CV y a los términos de esa búsqueda sin recalcularlas.
2. **Given** una oferta recomendada, **When** pulsa el enlace de la publicación, **Then** se abre la publicación original en una pestaña nueva.
3. **Given** dos usuarios distintos, **When** uno consulta, **Then** nunca ve CVs, búsquedas ni recomendaciones del otro.

---

### Edge Cases

- Ninguna oferta resulta adecuada: se informa claramente que no hay recomendaciones, sin forzar tres.
- Solo una o dos ofertas son adecuadas: se muestran únicamente esas.
- La búsqueda tiene menos de tres ofertas: se evalúan las disponibles y se aplican las mismas reglas.
- La oferta tiene datos mínimos (solo título o descripción corta): se evalúa con lo que haya y se señala la información faltante.
- El CV tiene poca información: la explicación indica que la evaluación es limitada.
- La persona pulsa Match varias veces seguidas sobre la misma búsqueda: el botón se deshabilita durante la petición y el servidor rechaza una segunda solicitud simultánea.
- El análisis excede el tiempo máximo: se informa timeout con "Reintentar"; los embeddings ya generados se conservan, por lo que el reintento es más rápido.
- Se pulsa Match sobre una búsqueda y un CV que ya tienen recomendaciones: se muestran las guardadas; solo "Recalcular" inicia un nuevo análisis y reemplaza el anterior (si el recálculo falla, se conserva el resultado previo).
- Falla el servicio de análisis o el de comparación: el estado muestra "Falló" con mensaje claro y botón "Reintentar" (sin reintentos automáticos); se conserva el resultado previo si existía y la búsqueda original no se pierde.
- La persona pierde la sesión durante el análisis: al volver a iniciar sesión solo ve sus propios resultados.
- La búsqueda se repite con los mismos términos y cambian las ofertas: las recomendaciones anteriores siguen asociadas a la búsqueda que las originó, y la nueva búsqueda requiere un nuevo Match.
- Las ofertas contienen texto que intenta dar instrucciones al sistema: se tratan como contenido a evaluar, no como órdenes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar el botón **Match** con la descripción “Recibí hasta tres recomendaciones de las ofertas encontradas que mejor se adapten a tu perfil profesional” cuando una búsqueda de empleos tiene resultados.
- **FR-002**: El sistema MUST usar para el Match exclusivamente el CV seleccionado en esa búsqueda y las ofertas obtenidas en ella.
- **FR-003**: El sistema MUST NOT iniciar una nueva búsqueda de empleos al ejecutar Match.
- **FR-004**: El sistema MUST preseleccionar las ofertas más cercanas al perfil mediante una comparación de similitud entre representaciones vectoriales del perfil profesional y de cada oferta.
- **FR-005**: Las representaciones vectoriales MUST generarse con un modelo de embeddings desplegado en Azure que sea distinto del modelo usado para generar los CVs, y MUST almacenarse y compararse en Supabase con pgvector.
- **FR-006**: Tras la preselección, el modelo usado para generar los CVs MUST analizar el contenido del perfil y de las ofertas candidatas y producir hasta tres recomendaciones.
- **FR-007**: Cada recomendación MUST incluir la oferta, una explicación de las coincidencias con el CV y la lista de requisitos de la oferta no acreditados en el CV.
- **FR-008**: Las recomendaciones MUST basarse solo en datos del CV y de la oferta; el sistema MUST NOT inventar experiencia, habilidades ni requisitos.
- **FR-009**: Cuando falte información en la oferta o en el CV para evaluar un aspecto, la recomendación MUST indicarlo de forma explícita.
- **FR-010**: El sistema MAY devolver menos de tres recomendaciones o ninguna cuando no haya ofertas adecuadas, e MUST informar este resultado con un mensaje claro.
- **FR-011**: El sistema MUST ordenar las recomendaciones por afinidad y MUST presentar la afinidad como etiqueta cualitativa (Alta o Media), nunca como porcentaje ni como probabilidad de contratación. La etiqueta la determina el modelo según los requisitos acreditados en el CV; las ofertas de afinidad baja MUST NOT recomendarse y se consideran no adecuadas (FR-010).
- **FR-012**: La salida de la evaluación MUST validarse antes de guardarse o mostrarse, y MUST rechazar recomendaciones que no correspondan a ofertas de la búsqueda.
- **FR-013**: El Match MUST ejecutarse de forma sincrónica (sin cola ni worker), MUST mostrar un estado de carga mientras la petición está en curso sin bloquear el resto de la interfaz, y MUST aplicar un tiempo máximo total tras el cual responde con un error de timeout comprensible.
- **FR-014**: El sistema MUST impedir análisis duplicados simultáneos para la misma búsqueda y el mismo CV (una segunda solicitud simultánea se rechaza con un error claro).
- **FR-021**: El sistema MUST reutilizar los embeddings ya almacenados (por contenido sin cambios) y MUST generar los faltantes del CV y de las ofertas en una única llamada en lote.
- **FR-015**: Las recomendaciones MUST persistir asociadas al CV y a la búsqueda que las originó y MUST poder consultarse nuevamente sin recalcularse. Si ya existen recomendaciones para esa búsqueda y ese CV, Match MUST mostrarlas sin reprocesar y MUST ofrecer una acción explícita "Recalcular" que reemplaza el resultado anterior (se conserva un solo resultado vigente por búsqueda y CV). Estos datos (búsquedas, ofertas, vectores y recomendaciones) MUST conservarse mientras exista el CV y MUST eliminarse al eliminar el CV. Si el CV se edita después de generar las recomendaciones, estas MUST conservarse y mostrarse con el aviso "El CV cambió desde este análisis" junto a la acción "Recalcular".
- **FR-016**: Cada recomendación MUST permitir abrir la publicación original de la oferta en una pestaña nueva.
- **FR-017**: Cada persona MUST acceder solo a sus propios CVs, búsquedas y recomendaciones; el acceso a recursos ajenos MUST responder igual que a recursos inexistentes.
- **FR-018**: La búsqueda de empleos actual (edición de términos y ubicación, resultados, enlaces) MUST conservarse sin cambios de comportamiento.
- **FR-019**: El sistema MUST registrar los fallos de procesamiento sin exponer datos personales ni credenciales, y MUST ofrecer reintento a la persona.
- **FR-020**: El contenido de las ofertas MUST tratarse como datos a evaluar y no como instrucciones para el sistema.

### Key Entities *(include if feature involves data)*

- **Búsqueda de empleos**: consulta realizada con un CV, con sus términos, ubicación y la lista de ofertas obtenidas; necesita identificarse de forma estable para asociarle recomendaciones.
- **Oferta**: publicación con título, empresa, ubicación, descripción breve y enlace original; pertenece a una búsqueda.
- **Representación vectorial**: huella numérica del perfil o de una oferta usada para medir cercanía; se asocia al CV o a la oferta que describe.
- **Resultado de Match**: resultado vigente (uno por búsqueda y CV) con momento de generación y huella del CV usado; se reemplaza al recalcular.
- **Recomendación**: oferta seleccionada con posición, afinidad cualitativa (Alta o Media), coincidencias, requisitos no acreditados e información faltante; pertenece a una solicitud de Match, a un CV y a una búsqueda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al menos el 95% de los Match iniciados sobre búsquedas con resultados terminan en un resultado visible (recomendaciones o aviso de ausencia) en menos de 50 segundos; el resto termina con un mensaje de timeout o error comprensible, nunca en espera indefinida.
- **SC-002**: El 100% de las recomendaciones mostradas corresponden a ofertas de la búsqueda que las originó y a un CV de la persona que las solicitó.
- **SC-003**: El 100% de las recomendaciones incluye al menos una coincidencia o un motivo explícito de falta de información, y lista los requisitos no acreditados cuando existan.
- **SC-004**: En una revisión manual de 20 recomendaciones de muestra, ninguna atribuye al CV experiencia o requisitos inexistentes.
- **SC-005**: Durante el análisis la persona ve un estado de carga en el 100% de los casos y, ante timeout o error, ve un mensaje claro con "Reintentar".
- **SC-006**: El 100% de los intentos de acceder a recomendaciones de otra cuenta es rechazado sin revelar su existencia.
- **SC-007**: Al menos el 90% de las personas de prueba logra pedir un Match y abrir la publicación original de una oferta recomendada sin ayuda en menos de 2 minutos.
- **SC-008**: Tras la entrega, la búsqueda de empleos existente mantiene el 100% de sus pruebas actuales aprobadas.

## Assumptions

- Esta entrega usa las ofertas de la fuente de empleos ya integrada; no incorpora scraping ni nuevas fuentes.
- Se evalúa un máximo de 20 ofertas por búsqueda, el mismo tope de la búsqueda actual.
- El perfil profesional que se compara es el contenido del CV seleccionado en la búsqueda; el correo y el token de sesión no se envían a los modelos.
- Para generar la explicación se envían al modelo solo el contenido del CV y los datos públicos de las ofertas candidatas.
- La búsqueda y sus ofertas deben quedar guardadas para poder asociar recomendaciones a ellas; hoy la búsqueda no se persiste y esta feature lo requiere.
- Se asume que las ofertas aportan título, empresa, ubicación y un fragmento descriptivo; no se accede a la publicación completa para evaluarlas.
- No se calculará ni mostrará una probabilidad de contratación; la afinidad es una etiqueta cualitativa orientativa (Alta o Media).
- Las plataformas indicadas (Azure para embeddings y Supabase pgvector) son una restricción de la entrega. La constitución actual excluye pgvector y embeddings en la primera entrega de búsqueda y exige procesamiento sincrónico para la generación del CV, por lo que se enmendó (v1.3.0) para permitir embeddings y pgvector. Decisión de diseño: el Match es sincrónico, sin cola ni worker; el procesamiento en segundo plano queda permitido por la constitución pero no se usa en esta entrega.
- El modelo de embeddings requiere un despliegue propio en Azure y sus credenciales viven solo en el servidor.
- Favoritos, historial global de ofertas y notificaciones fuera de la aplicación quedan para entregas posteriores.
