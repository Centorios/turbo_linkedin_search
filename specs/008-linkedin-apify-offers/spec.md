# Feature Specification: Ofertas de LinkedIn en búsqueda y Match

**Feature Branch**: `008-linkedin-apify-offers`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Agregar ofertas de LinkedIn a CV8 mediante un Actor de Apify e integrarlas a la búsqueda y al Match existentes. Investigar Actors candidatos con el MCP de Apify (parámetros, datos, costos, requisitos de acceso) sin ejecutar Actors pagos ni pedir credenciales personales sin consultar. El usuario elige Jooble, LinkedIn o ambas fuentes; se muestra el estado de obtención sin bloquear la app; las ofertas se normalizan, se guardan asociadas a la búsqueda y al CV, sin duplicados entre fuentes; el Match considera ambas fuentes de forma sincrónica reutilizando embeddings, pgvector y el modelo de análisis actuales; si una fuente falla se conservan los resultados de la otra y se informa que la búsqueda está incompleta; se indica cuando una descripción es parcial y se permite abrir la oferta original; la búsqueda actual sigue operativa, con acceso por usuario y respeto de las condiciones de las fuentes."

## Clarifications

### Session 2026-10-08

- Q: Si la persona pulsa Match mientras LinkedIn todavía se está obteniendo, ¿qué debe pasar? → A: Se ejecuta de inmediato con las ofertas ya guardadas, se marca como parcial y cuando lleguen las de LinkedIn.
- Q: Cuando una misma vacante aparece en Jooble y en LinkedIn con distinta descripción, ¿cuál se usa para mostrarla y para el Match? → A: Se usa la descripción más larga/completa y se conservan los enlaces de ambas fuentes.
- Q: ¿Cuánto tiempo máximo se espera a LinkedIn antes de darlo por fallido, y se reintenta solo? → A: Máximo 3 minutos, sin reintento automático (solo reintento manual).
- Q: ¿Qué tope de uso de LinkedIn se aplica por persona? → A: Ninguno; solo el tope de gasto por ejecución.
- Q: ¿Cómo se informa a la persona que sus términos se envían a un servicio externo? → A: Aviso breve junto a la opción de LinkedIn, sin confirmación extra.
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir fuentes y buscar ofertas (Priority: P1)

La persona, con un CV seleccionado, revisa los términos y la ubicación de su búsqueda y elige dónde buscar: Jooble, LinkedIn o ambas fuentes. Al lanzar la búsqueda ve el estado de obtención de cada fuente y puede seguir usando la aplicación mientras LinkedIn se procesa. Las ofertas aparecen en un único listado, con indicación de su fuente y enlace a la oferta original.

**Why this priority**: Es el núcleo de la funcionalidad: sin elección de fuente y obtención no hay ofertas de LinkedIn que integrar.

**Independent Test**: Se puede probar lanzando una búsqueda con "LinkedIn" y luego con "ambas", verificando estado por fuente, navegación libre durante el procesamiento y listado final con fuente y enlace.

**Acceptance Scenarios**:

1. **Given** un CV seleccionado y términos/ubicación revisados, **When** elijo solo Jooble, **Then** la búsqueda se comporta como hoy, sin consultar LinkedIn.
2. **Given** los mismos datos, **When** elijo LinkedIn o ambas fuentes y lanzo la búsqueda, **Then** veo el estado de obtención de cada fuente elegida (en curso, completada, fallida).
3. **Given** LinkedIn sigue procesando, **When** navego a otras secciones de la aplicación, **Then** puedo hacerlo sin esperar y, al volver, veo el estado actualizado.
4. **Given** la obtención terminó, **When** veo el listado, **Then** cada oferta muestra su fuente y permite abrir la oferta original.

---

### User Story 2 - Match sobre ofertas de ambas fuentes (Priority: P1)

Una vez disponibles las ofertas de la búsqueda, la persona ejecuta el Match y el resultado considera conjuntamente las ofertas de Jooble y de LinkedIn obtenidas para esa búsqueda, con el mismo comportamiento, ranking y explicación que ya conoce. El Match sigue siendo una acción con resultado inmediato.

**Why this priority**: Es el valor final: recomendaciones útiles sobre un universo más amplio de ofertas.

**Independent Test**: Con una búsqueda que tiene ofertas de ambas fuentes, ejecutar Match y comprobar que el ranking incluye ofertas de las dos fuentes y que cada una indica su origen.

**Acceptance Scenarios**:

1. **Given** una búsqueda con ofertas de Jooble y LinkedIn, **When** ejecuto el Match, **Then** el resultado ordena y explica ofertas de ambas fuentes en un mismo ranking.
2. **Given** la obtención de LinkedIn aún en curso, **When** ejecuto el Match, **Then** se ejecuta de inmediato con las ofertas ya guardadas, el resultado se marca como parcial y se me ofrece recalcular cuando lleguen las de LinkedIn.
3. **Given** un Match vigente, **When** llegan nuevas ofertas de LinkedIn, **Then** se me indica que el resultado puede recalcularse con las ofertas nuevas.

---

### User Story 3 - Tolerancia a fallos y descripciones parciales (Priority: P2)

Si una fuente falla (por ejemplo LinkedIn no responde o se agota el límite), la persona conserva los resultados de la otra y ve un aviso claro de que la búsqueda está incompleta, con opción de reintentar solo la fuente fallida. Cuando una oferta tiene descripción parcial, se indica y se ofrece abrir la oferta original.

**Why this priority**: Aumenta la confianza y evita pérdida de resultados, pero depende de que la obtención base ya funcione.

**Independent Test**: Simular la falla de una fuente y verificar que los resultados de la otra se conservan, que aparece el aviso de búsqueda incompleta y que el Match sigue funcionando con lo disponible.

**Acceptance Scenarios**:

1. **Given** una búsqueda con ambas fuentes, **When** LinkedIn falla y Jooble termina, **Then** veo las ofertas de Jooble, un aviso "búsqueda incompleta" y puedo reintentar LinkedIn.
2. **Given** una oferta cuya descripción es parcial, **When** la veo en el listado o el detalle, **Then** aparece marcada como parcial con acceso a la oferta original.
3. **Given** una búsqueda incompleta, **When** ejecuto el Match, **Then** el resultado indica que se basa solo en las fuentes que respondieron.

---

### User Story 4 - Sin duplicados entre fuentes (Priority: P2)

La misma vacante publicada en Jooble y en LinkedIn aparece una sola vez en la búsqueda, conservando la información de ambas fuentes de origen.

**Why this priority**: Mejora la calidad del listado y del ranking, sin bloquear el primer valor entregado.

**Independent Test**: Con una vacante presente en ambas fuentes, comprobar que se lista una sola vez y que se conserva el enlace/origen de cada fuente.

**Acceptance Scenarios**:

1. **Given** una vacante repetida entre Jooble y LinkedIn, **When** termina la obtención, **Then** se muestra una única oferta que indica ambas fuentes de origen.
2. **Given** una búsqueda repetida con las mismas ofertas, **When** se vuelve a obtener, **Then** no se crean ofertas duplicadas.

---

### User Story 5 - Investigación y viabilidad del Actor de Apify (Priority: P1)

Antes de construir, el equipo investiga con el MCP de Apify los Actors candidatos para LinkedIn y documenta parámetros, datos disponibles, costos y requisitos de acceso, y elige una opción viable o deja asentadas las limitaciones encontradas. No se ejecutan Actors pagos ni se solicitan credenciales personales sin consulta previa.

**Why this priority**: Define si la integración es viable y a qué costo; condiciona el resto del alcance.

**Independent Test**: Existe un documento de investigación con comparativa de candidatos, decisión recomendada (o limitaciones) y confirmación explícita de la persona responsable antes de cualquier ejecución con costo.

**Acceptance Scenarios**:

1. **Given** acceso al MCP de Apify, **When** se investiga, **Then** quedan documentados por candidato: parámetros, campos devueltos, costo, límites y requisitos de acceso.
2. **Given** que una opción implica costo o credenciales personales, **When** se llega a ese punto, **Then** se consulta a la persona responsable antes de continuar.
3. **Given** que ningún Actor es viable, **When** se concluye la investigación, **Then** se documentan las limitaciones y la funcionalidad queda limitada a la búsqueda actual.

### Edge Cases

- Búsqueda sin resultados en una o ambas fuentes: se informa claramente, sin tratarlo como error.
- LinkedIn tarda más de lo esperado: el estado sigue "en curso" hasta un máximo de 3 minutos; al excederlo, LinkedIn pasa a "fallida", la búsqueda queda incompleta y se ofrece reintento manual (sin reintento automático, para no duplicar costo).
- La persona cierra la aplicación durante la obtención: al volver ve el estado final o el progreso conservado.
- Ofertas sin descripción, sin ubicación o con campos faltantes: se guardan con lo disponible y se marcan como parciales.
- Misma vacante con títulos o empresas ligeramente distintos entre fuentes: se aplica un criterio consistente de duplicado, se usa la descripción más completa y no se pierden enlaces de origen.
- Dos búsquedas simultáneas del mismo usuario: cada una conserva sus propias ofertas y estados.
- Cambio del CV seleccionado entre búsquedas: las ofertas quedan asociadas al CV con que se lanzó cada búsqueda.
- Límite de uso o cuota de la fuente agotado: se informa como fuente fallida/incompleta, sin afectar a la otra.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir elegir como fuente de la búsqueda Jooble, LinkedIn o ambas, usando los términos y la ubicación ya revisados por la persona.
- **FR-002**: La búsqueda solo con Jooble MUST mantener el comportamiento actual sin regresiones.
- **FR-003**: El sistema MUST mostrar el estado de obtención de cada fuente elegida (en curso, completada, fallida) y actualizarlo sin que la persona deba recargar manualmente.
- **FR-004**: La persona MUST poder seguir usando la aplicación mientras la obtención de LinkedIn está en curso, y recuperar el estado al volver.
- **FR-005**: El sistema MUST normalizar las ofertas de ambas fuentes a una estructura común (título, empresa, ubicación, descripción disponible, fuente, enlace original, fecha si existe).
- **FR-006**: El sistema MUST guardar las ofertas asociadas a la búsqueda y al CV seleccionado, conservando fuente, enlace original y descripción disponible.
- **FR-007**: El sistema MUST evitar ofertas duplicadas dentro de una búsqueda, incluso entre fuentes distintas, conservando la referencia a cada fuente de origen. Cuando una vacante duplicada tenga descripciones distintas, se MUST usar la más larga/completa para mostrarla y para el Match, y conservar los enlaces originales de ambas fuentes.
- **FR-008**: El Match MUST considerar en conjunto las ofertas de todas las fuentes obtenidas para esa búsqueda.
- **FR-009**: El Match MUST reutilizar el mecanismo actual de embeddings, búsqueda vectorial y modelo de análisis, sin introducir un flujo paralelo.
- **FR-010**: El Match MUST seguir siendo una acción de resultado inmediato una vez que las ofertas están disponibles, sin pasar a procesamiento diferido.
- **FR-011**: Si una fuente falla, el sistema MUST conservar los resultados de la otra, informar que la búsqueda está incompleta y permitir reintentar solo la fuente fallida. La obtención de LinkedIn MUST considerarse fallida tras 3 minutos sin completar y MUST NOT reintentarse automáticamente; solo se reintenta por acción manual.
- **FR-012**: El sistema MUST indicar cuando una oferta tiene descripción parcial y MUST permitir abrir la oferta original desde el listado y el detalle.
- **FR-013**: Cada oferta y cada resultado de Match MUST mostrar su fuente de origen.
- **FR-014**: Cuando el Match se base en una búsqueda incompleta o con obtención en curso, el resultado MUST indicarlo. El Match MUST poder ejecutarse en cualquier momento con las ofertas ya guardadas (sin bloquearse por una obtención en curso) y MUST ofrecer recalcular cuando lleguen ofertas nuevas.
- **FR-015**: El acceso a búsquedas, ofertas y resultados MUST estar limitado al usuario propietario, sin exponer datos entre usuarios.
- **FR-016**: La obtención desde LinkedIn MUST respetar las condiciones de uso de la fuente y del proveedor del Actor, y limitarse a información de ofertas públicas sin requerir credenciales personales de LinkedIn de la persona usuaria.
- **FR-017**: El sistema MUST documentar la investigación de Actors candidatos (parámetros, datos disponibles, costos, requisitos de acceso) y la decisión adoptada o las limitaciones halladas.
- **FR-018**: No MUST ejecutarse Actors con costo ni solicitarse credenciales personales sin consulta y aprobación previa de la persona responsable del proyecto.
- **FR-019**: Los mensajes de estado, aviso de incompletitud y descripción parcial MUST ser claros, en español y sin términos técnicos.
- **FR-021**: Junto a la opción de LinkedIn, la interfaz MUST mostrar un aviso breve indicando que los términos de búsqueda se envían a un servicio externo para obtener las ofertas; no se requiere confirmación adicional.
- **FR-020**: Los elementos de interfaz necesarios para pruebas (selector de fuentes, estados por fuente, aviso de búsqueda incompleta, marca de descripción parcial, enlace a oferta original) MUST ser identificables por pruebas automatizadas.

### Key Entities

- **Búsqueda**: consulta de una persona con términos, ubicación, CV asociado y fuentes elegidas; reúne estados de obtención por fuente y un indicador de completitud.
- **Estado de obtención por fuente**: avance de cada fuente dentro de una búsqueda (en curso, completada, fallida) con momento de última actualización y motivo resumido en caso de fallo.
- **Oferta**: vacante normalizada con título, empresa, ubicación, descripción disponible, indicador de descripción parcial, fuente(s) de origen y enlace(s) original(es); pertenece a una búsqueda y a un CV.
- **Fuente**: origen de ofertas (Jooble, LinkedIn); una oferta duplicada puede referenciar más de una.
- **Resultado de Match**: resultado vigente por búsqueda y CV, con ranking, explicación, fuentes consideradas e indicador de búsqueda incompleta.
- **Investigación de Actor**: registro de candidatos evaluados, sus características, costos, requisitos de acceso y decisión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La persona puede lanzar una búsqueda en LinkedIn o en ambas fuentes en no más de 3 interacciones desde el CV seleccionado.
- **SC-002**: El estado de cada fuente es visible en menos de 2 segundos tras lanzar la búsqueda y se refleja el cambio de estado en menos de 10 segundos desde que ocurre.
- **SC-003**: Durante la obtención, el 100% de las secciones de la aplicación siguen utilizables sin esperar.
- **SC-004**: Ante la falla de una fuente, el 100% de los resultados de la otra se conserva y el aviso de búsqueda incompleta es visible.
- **SC-005**: En vacantes presentes en ambas fuentes de un conjunto de prueba, 0 duplicados visibles en el listado y en el ranking.
- **SC-006**: El 100% de las ofertas muestra su fuente y permite abrir la oferta original; el 100% de las descripciones parciales está marcado.
- **SC-007**: El Match sobre ofertas ya disponibles entrega resultado en un tiempo comparable al actual (sin aumento perceptible para la persona).
- **SC-008**: La búsqueda solo con Jooble mantiene su comportamiento: 0 regresiones en las pruebas existentes.
- **SC-009**: Ningún usuario puede ver búsquedas u ofertas de otro en pruebas de acceso.
- **SC-010**: La investigación de Actors está documentada y aprobada por la persona responsable antes de cualquier ejecución con costo.

## Assumptions

- El producto "CV8" es esta misma aplicación; se extienden la búsqueda de empleos (006) y el Match (007) ya existentes.
- La persona ya selecciona un CV y revisa términos y ubicación antes de buscar; ese flujo se mantiene.
- La obtención de LinkedIn se delega al Actor de Apify `bebity/linkedin-jobs-scraper` (decisión aprobada; ver [research.md](./research.md)). Según su ficha pública no requiere cuenta, cookies ni login de LinkedIn. Alternativa de respaldo: `valig/linkedin-jobs-scraper`.
- Cada búsqueda en LinkedIn obtiene hasta 20 ofertas. Costo estimado ≈ US$0,03–0,04 por búsqueda; se fija además un tope de gasto por ejecución. No se aplica límite de búsquedas por persona; el control de costo se limita al tope por ejecución y a las 20 ofertas por búsqueda.
- Si el Actor deja de ser viable, el alcance se reduce a mantener la búsqueda actual e informar la limitación.
- Dos ofertas se consideran la misma vacante cuando coinciden en título, empresa y ubicación normalizados, o en enlace original equivalente.
- La obtención de LinkedIn corre en segundo plano; el Match permanece sincrónico y opera sobre las ofertas ya guardadas.
- Se reutilizan los embeddings, pgvector y el modelo de análisis vigentes; no se cambia el proveedor de IA.
- Fuera de alcance: postulación automática, inicio de sesión en LinkedIn por parte de la persona, scraping directo sin proveedor y nuevas fuentes distintas de Jooble y LinkedIn.
