# Feature Specification: Enriquecimiento de trayectoria y competencias

**Feature Branch**: No creada (no hay hook de ramas configurado)

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Hacer un poco más inteligente el desarrollo de la trayectoria y las competencias (más ficción)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mejorar la descripción de la trayectoria profesional (Priority: P1)

Como usuario que prepara un CV, quiero que el sistema me ayude a describir mejor mi experiencia y mis logros para comunicar con claridad el valor de mi trabajo.

**Why this priority**: La trayectoria laboral es una sección central del CV y una mejora útil debe poder producirse sin alterar los hechos aportados por el usuario.

**Independent Test**: Aportar una trayectoria breve con responsabilidades y resultados concretos, responder las preguntas de precisión que se muestren y revisar una propuesta mejor redactada que conserve los hechos proporcionados.

**Acceptance Scenarios**:

1. **Given** información de trayectoria incompleta o ambigua, **When** el usuario solicita ayuda, **Then** el sistema identifica qué datos faltan y pregunta solo por detalles relevantes antes de completar una afirmación.
2. **Given** información confirmada sobre un puesto, **When** el sistema propone una descripción, **Then** conserva cargo, empresa, fechas, responsabilidades y resultados confirmados, y permite revisar y editar el texto antes de usarlo en el CV.
3. **Given** que el usuario no puede confirmar un dato solicitado, **When** responde que lo desconoce, **Then** el sistema omite ese detalle y no completa la respuesta con una suposición presentada como hecho.
4. **Given** hechos confirmados sobre una experiencia, **When** el sistema propone una redacción más atractiva, **Then** mejora claridad y fuerza sin añadir responsabilidades, resultados o métricas no aportados.

---

### User Story 2 - Identificar y desarrollar competencias (Priority: P1)

Como usuario, quiero entender qué competencias demuestran mis experiencias y cuáles podría desarrollar para orientar mejor mi CV y mi crecimiento profesional.

**Why this priority**: Relacionar experiencias concretas con competencias hace más comprensible el perfil y puede ofrecer pasos de desarrollo accionables.

**Independent Test**: Aportar ejemplos de tareas y resultados, comprobar qué competencias se relacionan con ellos, distinguir las inferidas de las confirmadas y revisar sugerencias concretas para desarrollar las competencias elegidas.

**Acceptance Scenarios**:

1. **Given** tareas, responsabilidades o logros confirmados, **When** el usuario solicita un análisis, **Then** el sistema propone competencias relacionadas y explica qué evidencia aportada respalda cada propuesta.
2. **Given** una competencia propuesta que el usuario no reconoce o no desea incluir, **When** la rechaza, **Then** no aparece como competencia confirmada en el CV.
3. **Given** competencias que el usuario desea desarrollar, **When** solicita orientación, **Then** recibe acciones de aprendizaje concretas y diferenciadas de las competencias que ya posee.

### Edge Cases

- La trayectoria no incluye métricas: el sistema no inventa cifras y puede formular una pregunta para que el usuario aporte un resultado verificable.
- La información describe responsabilidades, pero no permite inferir una competencia con confianza: la propuesta se omite o se presenta como posibilidad sujeta a confirmación.
- Una sugerencia hipotética no corresponde a la experiencia real del usuario: puede descartarse y no se incorpora al CV.
- El usuario no responde a una pregunta adicional: puede continuar con los hechos ya aportados, sin bloquear la generación del CV.
- El modelo no puede justificar una competencia con evidencia del usuario: la competencia queda como idea de desarrollo, nunca como habilidad confirmada.
- El usuario edita una propuesta: solo la versión que confirma se incorpora al documento final.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir que el usuario solicite ayuda para desarrollar la redacción de su trayectoria profesional y sus competencias.
- **FR-002**: El sistema MUST identificar preguntas de seguimiento cuando falten datos necesarios para describir responsabilidades, alcance o resultados con precisión.
- **FR-003**: El sistema MUST conservar los datos de trayectoria que el usuario confirmó y MUST evitar presentar como ciertos cargos, empresas, fechas, métricas, responsabilidades, certificaciones o resultados no confirmados.
- **FR-004**: Cada competencia sugerida como demostrada MUST incluir una referencia comprensible a la experiencia o logro aportado que la respalda.
- **FR-005**: El usuario MUST poder revisar, editar, aceptar o rechazar cada propuesta de redacción y competencia antes de incorporarla al CV.
- **FR-006**: El sistema MUST mantener separadas las competencias confirmadas por el usuario, las inferidas con evidencia y las que se proponen desarrollar.
- **FR-007**: Las sugerencias de aprendizaje MUST describir acciones concretas y MUST identificarse como recomendaciones, no como conocimientos o credenciales que el usuario ya posee.
- **FR-008**: Una propuesta rechazada o no confirmada MUST quedar fuera del CV final.
- **FR-009**: El sistema MUST permitir continuar con la información confirmada cuando el usuario no responda preguntas adicionales.
- **FR-010**: La ayuda de redacción MUST limitarse a reformular hechos reales aportados o confirmados por el usuario. El sistema MUST NOT generar puestos, logros, métricas o perfiles hipotéticos, ni presentarlos como sugerencias para incluir en el CV.
- **FR-011**: Las afirmaciones aceptadas para el CV MUST seguir cumpliendo el contrato estructurado vigente y MUST pasar su validación antes de mostrarse o persistirse.

### Key Entities *(include if feature involves data)*

- **Experiencia profesional**: Información de un puesto o actividad aportada o confirmada por el usuario, incluida función, organización, periodo, responsabilidades y resultados disponibles.
- **Competencia**: Habilidad o capacidad relacionada con evidencia de una experiencia; mantiene estado de confirmación, evidencia y posible acción de desarrollo.
- **Propuesta de redacción**: Versión editable de un texto de trayectoria o logro, asociada a los datos fuente y al estado aceptada, editada o rechazada.
- **Acción de desarrollo**: Sugerencia concreta para fortalecer una competencia, diferenciada de una competencia que el usuario afirma poseer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de afirmaciones factuales incorporadas al CV puede vincularse a información proporcionada o confirmada explícitamente por el usuario.
- **SC-002**: Al menos el 90% de usuarios de prueba puede distinguir las competencias confirmadas, inferidas con evidencia y sugeridas para desarrollar.
- **SC-003**: Al menos el 90% de usuarios de prueba puede aceptar, editar o descartar una propuesta antes de incorporarla al CV.
- **SC-004**: En una muestra de 20 perfiles de prueba, el 100% de métricas, cargos y credenciales ausentes permanece ausente del CV hasta que el usuario los aporte y confirme.
- **SC-005**: Al menos el 85% de usuarios de prueba considera que las acciones propuestas para desarrollar competencias son claras y realizables.

## Assumptions

- La persona usuaria aporta información real de su trayectoria y conserva la decisión final sobre qué contenido integrar en su CV.
- “Más ficción” se interpreta como una redacción más creativa de hechos reales, no como generación de experiencia ficticia.
- El contrato de CV y el flujo de autenticación existentes se mantienen; esta feature mejora las interacciones de trayectoria y competencias, no reemplaza la generación ni la descarga.
- Las recomendaciones de desarrollo pueden ser útiles sin añadir perfiles, puestos o credenciales ficticios.
