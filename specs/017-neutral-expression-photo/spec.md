# Feature Specification: Verificación de expresión neutra en la foto de cámara

**Feature Branch**: `017-neutral-expression-photo`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Implementar la detección de expresión al momento de sacar la foto, usando MediaPipe. No sacar la foto automáticamente, dejar que el usuario toque sacar foto, darle feedback mientras saca la foto y si saca la foto y no cumple con expresión neutra, indicarle que saque de nuevo y darle un pequeño feedback de qué mejorar."

## Clarifications

### Session 2026-11-02

- Q: ¿Qué debería pasar si la foto es rechazada varias veces seguidas por no ser neutra? → A: Se puede reintentar sin límite; nunca se permite usar una foto rechazada.
- Q: ¿Qué nivel de sonrisa se acepta como "expresión neutra"? → A: Tolerante: se acepta una sonrisa muy leve (labios cerrados, apenas curvados); se rechaza una sonrisa clara.
- Q: Si al tocar "Tomar foto" el sistema no puede evaluar bien el rostro (poca luz, rostro tapado o fuera de cuadro), ¿la foto se rechaza o se acepta sin verificar? → A: Se rechaza con un mensaje que indica qué corregir (más luz, mostrar el rostro completo, centrarse).
- Q: Cuando una foto es rechazada, ¿se muestra la foto tomada junto al mensaje o se descarta y se vuelve directo a la cámara en vivo? → A: Se descarta; vuelve la cámara en vivo con el mensaje de qué mejorar visible.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Guía en vivo mientras me preparo (Priority: P1)

Como usuario que se toma la foto de perfil con la cámara, quiero ver en tiempo real si mi expresión y posición son adecuadas para una foto neutra, para saber cuándo conviene tocar "Tomar foto".

**Why this priority**: Es el feedback "mientras saca la foto" que pidió el usuario; reduce intentos fallidos y es la parte más visible de la funcionalidad.

**Independent Test**: Abrir la cámara y comprobar que aparece un indicador de estado que cambia según el rostro (sin rostro, sonriendo, neutra) sin que se capture ninguna foto de forma automática.

**Acceptance Scenarios**:

1. **Given** la cámara abierta y mi rostro de frente con expresión neutra, **When** pasa un instante estable, **Then** veo un indicador positivo ("Listo, expresión neutra") y el botón "Tomar foto" sigue disponible.
2. **Given** la cámara abierta, **When** sonrío, abro la boca, levanto las cejas o cierro los ojos, **Then** veo un mensaje breve y específico de qué corregir (por ejemplo "Relajá la sonrisa").
3. **Given** la cámara abierta, **When** no hay un rostro visible, hay más de un rostro o miro hacia un costado, **Then** veo una indicación para mostrar un solo rostro de frente.
4. **Given** el indicador en estado "listo", **When** no toco nada, **Then** la foto NO se toma automáticamente.

---

### User Story 2 - Aviso al tomar una foto que no es neutra (Priority: P1)

Como usuario, si toco "Tomar foto" y mi expresión no era neutra, quiero que me avisen y me indiquen qué mejorar, para repetir la foto y obtener una adecuada.

**Why this priority**: Es el requisito central: la foto de perfil debe cumplir la expresión neutra y la persona debe entender por qué no fue aceptada.

**Independent Test**: Tocar "Tomar foto" con una expresión no neutra y verificar que aparece el aviso con el motivo, que la foto no se usa y que la cámara sigue activa para reintentar.

**Acceptance Scenarios**:

1. **Given** la cámara abierta, **When** toco "Tomar foto" con una expresión neutra y rostro de frente, **Then** la foto se acepta y sigue el flujo normal de foto de perfil.
2. **Given** la cámara abierta, **When** toco "Tomar foto" con una expresión no neutra, **Then** la foto no se acepta, veo un mensaje que me pide sacarla de nuevo y explica brevemente qué mejorar.
3. **Given** que la foto fue rechazada, **When** vuelvo a intentar, **Then** la cámara sigue activa y puedo tomar otra foto sin reabrirla.
4. **Given** que la foto fue rechazada por varios motivos a la vez, **When** veo el mensaje, **Then** se prioriza el motivo principal para no abrumar con una lista larga.

---

### User Story 3 - Alternativa cuando no se puede verificar (Priority: P2)

Como usuario, quiero poder seguir subiendo mi foto aunque la verificación no esté disponible (dispositivo lento, sin soporte, falla al cargar), para no quedar bloqueado.

**Why this priority**: Protege el flujo existente de foto de perfil y la accesibilidad; la verificación es una ayuda, no una barrera total.

**Independent Test**: Simular que la verificación no puede cargarse y comprobar que se puede tomar la foto con aviso de que no se verificó, o usar "Buscar" para subir un archivo.

**Acceptance Scenarios**:

1. **Given** que la verificación no se puede cargar o falla, **When** abro la cámara, **Then** veo un aviso de que la expresión no se verificará y puedo tomar la foto igualmente.
2. **Given** cualquier estado de la verificación, **When** prefiero subir un archivo con "Buscar", **Then** ese camino sigue funcionando sin verificación de expresión.

---

### Edge Cases

- Mala iluminación o rostro parcialmente cubierto (lentes oscuros, mascarilla): la foto se rechaza con una indicación de qué corregir, en vez de aprobarse sin verificar.
- Parpadeo momentáneo justo al tocar el botón: no debe causar un rechazo por un único fotograma; la decisión se basa en una ventana breve alrededor del momento de la captura.
- Rostro neutro pero fuera de encuadre o muy lejos: se rechaza con indicación de acercarse o centrarse.
- Dos o más rostros en cuadro: se pide que aparezca una sola persona.
- Toques repetidos y rápidos del botón: no se generan capturas duplicadas ni mensajes contradictorios.
- La persona cierra la cámara durante la verificación: la cámara se apaga y no queda ningún proceso activo.
- Rechazos repetidos: no hay límite de intentos ni opción de omitir la verificación desde la cámara; quien no logre una foto aceptada puede subir un archivo con "Buscar".
- Usuarios con expresiones naturalmente marcadas (por ejemplo, boca ligeramente curvada): el umbral debe tolerar variaciones leves para no rechazar fotos razonablemente neutras.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mientras la cámara está abierta, el sistema MUST analizar el rostro en tiempo real y mostrar un indicador de estado visible y comprensible.
- **FR-002**: El sistema MUST NOT tomar la foto automáticamente; la captura solo ocurre cuando el usuario toca "Tomar foto".
- **FR-003**: El indicador en vivo MUST distinguir al menos: sin rostro, más de un rostro, rostro no frontal, expresión no neutra y expresión neutra lista.
- **FR-004**: Cuando la expresión no es neutra, el indicador en vivo MUST mostrar un mensaje corto y específico de qué corregir (sonrisa, boca abierta, cejas, ojos cerrados, orientación de la cabeza).
- **FR-005**: Al tocar "Tomar foto", el sistema MUST evaluar la expresión del momento de la captura y decidir si la foto cumple el criterio de expresión neutra. Una sonrisa muy leve (labios cerrados, apenas curvados) MUST aceptarse; una sonrisa clara MUST rechazarse. Si el rostro no se puede evaluar (poca luz, rostro tapado o fuera de cuadro), la foto MUST rechazarse indicando qué corregir (más luz, mostrar el rostro completo, centrarse).
- **FR-006**: Si la foto no cumple, el sistema MUST descartarla, mostrar un mensaje en español rioplatense que pida sacarla de nuevo e indique el motivo principal, y volver a la cámara en vivo con ese mensaje visible, sin mostrar la foto rechazada. Los reintentos son ilimitados y el sistema MUST NOT ofrecer usar una foto rechazada, sin importar cuántas veces se repita.
- **FR-007**: Si la foto cumple, el sistema MUST aceptarla y continuar el flujo existente de foto de perfil (mismo formato, validaciones y subida actuales).
- **FR-008**: El análisis del rostro MUST ejecutarse localmente en el dispositivo del usuario; ningún fotograma de video ni imagen se envía a un servicio externo para evaluar la expresión.
- **FR-009**: Si la verificación no está disponible (error de carga, dispositivo sin soporte o rendimiento insuficiente), el sistema MUST informar que la expresión no se verificará y permitir tomar la foto igualmente.
- **FR-010**: El camino de subida de archivo con "Buscar" MUST seguir funcionando sin verificación de expresión.
- **FR-011**: El sistema MUST evitar rechazos por un único fotograma ruidoso, evaluando una ventana breve de fotogramas alrededor de la captura.
- **FR-012**: Los mensajes de feedback MUST ser accesibles (anunciables por lectores de pantalla) y no depender solo del color.
- **FR-013**: La cámara MUST apagarse en todos los casos de cierre y la verificación MUST detenerse con ella, tal como exige el comportamiento actual de la cámara.
- **FR-014**: Los indicadores y mensajes MUST exponer identificadores estables para pruebas automatizadas.

### Key Entities

- **Resultado de verificación de expresión**: Veredicto de una captura (neutra / no neutra / no evaluable) con el motivo principal y los motivos secundarios; es efímero y no se persiste.
- **Estado en vivo del rostro**: Estado instantáneo mostrado al usuario durante la preparación (sin rostro, varios rostros, no frontal, no neutra, lista).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al menos el 90% de las personas que ven un mensaje de rechazo logra una foto aceptada en el siguiente intento.
- **SC-002**: El indicador en vivo refleja un cambio de expresión en menos de 1 segundo.
- **SC-003**: En una batería de pruebas con expresiones claramente no neutras (sonrisa amplia, boca abierta, ojos cerrados), el 95% es rechazada; con expresiones claramente neutras de frente, el 90% es aceptada.
- **SC-004**: El 100% de los rechazos muestra un motivo concreto de mejora, nunca un mensaje genérico solamente.
- **SC-005**: Ninguna foto se toma sin que el usuario toque el botón en el 100% de los casos.
- **SC-006**: Si la verificación no está disponible, el 100% de las personas puede igualmente completar su foto de perfil (cámara sin verificar o archivo).
- **SC-007**: La apertura de la cámara con verificación activa no demora más de 3 segundos adicionales en un equipo de gama media tras la primera carga.

## Assumptions

- La verificación de expresión se implementa con MediaPipe, según lo pedido por el usuario; se ejecuta en el navegador, por lo que no es un proveedor externo ni agrega datos al backend.
- Se amplía la cámara existente de la spec 013 (`CameraCapture`); no cambian el formato (JPEG cuadrado 640×640), la validación ni la subida de la foto.
- "Expresión neutra" significa: sin sonrisa clara (se tolera una sonrisa muy leve con labios cerrados), boca cerrada o casi cerrada, cejas en reposo, ojos abiertos y cabeza razonablemente de frente; los umbrales se ajustarán con pruebas y toleran variaciones leves.
- Un único rostro por foto; las fotos grupales no son un caso de uso.
- El veredicto no se guarda ni se muestra luego en el perfil; solo guía la captura.
- Los textos usan español rioplatense con voseo, como el resto de la app.
- Los modelos y archivos de MediaPipe se sirven desde la propia aplicación; ningún video sale del dispositivo.
- Dispositivos sin soporte para el análisis siguen el camino de FR-009; no se bloquea la foto.
- Fuera de alcance: captura automática, reconocimiento de identidad, calidad de iluminación como criterio de rechazo estricto, y verificación de archivos subidos con "Buscar".
