# Feature Specification: Dictado por voz con botón de micrófono

**Feature Branch**: `feat/dictado-por-voz`

**Created**: 2026-10-29

**Status**: Implemented

**Input**: User description: "Make it so i can voice to text pressing a microphone button"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dictar la experiencia profesional (Priority: P1)

Como usuario quiero tocar un botón de micrófono junto a "Biografía o experiencia profesional" y contar
mi trayectoria hablando, para no tener que escribir un texto largo.

**Why this priority**: es el campo principal de la app (la entrada del CV) y el más largo de completar.
Dictarlo ahorra tiempo, sobre todo en el celular.

**Independent Test**: en `/generate`, tocar el micrófono, hablar y comprobar que lo dicho aparece al final
del texto y que "Generar CV" funciona con ese texto.

**Acceptance Scenarios**:

1. **Given** un navegador con dictado, **When** abro `/generate`, **Then** veo un botón con ícono de micrófono y nombre accesible "Dictar por voz" junto al campo de experiencia.
2. **Given** que toco el micrófono y doy permiso, **When** hablo, **Then** el botón indica que está escuchando ("Detener dictado"), veo lo que se va reconociendo y cada frase confirmada se agrega **al final** del texto, sin borrar lo que ya había escrito.
3. **Given** que estoy dictando, **When** toco de nuevo el micrófono, **Then** el dictado se detiene y el texto queda editable como siempre.
4. **Given** que estoy dictando, **When** toco "Generar CV" o salgo de la página, **Then** el dictado se detiene.
5. **Given** que no doy permiso, no hay micrófono o no hay conexión, **When** intento dictar, **Then** veo el motivo en español rioplatense y puedo seguir escribiendo.

---

### User Story 2 - Responder por voz las preguntas del asistente (Priority: P2)

Como usuario quiero dictar mis respuestas en "Mejorar trayectoria y competencias", para contestar las
preguntas de seguimiento sin escribir.

**Why this priority**: son respuestas cortas y frecuentes; reutiliza el mismo botón.

**Independent Test**: abrir el asistente con preguntas, tocar el micrófono de una respuesta, hablar y ver
el texto en esa respuesta y no en otra.

**Acceptance Scenarios**:

1. **Given** el asistente con preguntas, **When** miro cada respuesta, **Then** cada una tiene su botón de micrófono.
2. **Given** que dicto en una respuesta, **When** se confirma la frase, **Then** se agrega solo a esa respuesta.
3. **Given** que cierro el asistente o envío las respuestas, **When** había un dictado activo, **Then** se detiene.

---

### Edge Cases

- Navegador sin dictado por voz (por ejemplo, Firefox): el botón **no se muestra** y el resto funciona igual.
- La persona deja de hablar un rato: el navegador termina el dictado solo; el botón vuelve a "Dictar por voz".
- Silencio total desde el inicio: se avisa "No escuchamos nada" y se puede volver a intentar.
- Texto vacío al empezar: la primera frase se agrega sin espacio inicial.
- El texto termina en salto de línea: la frase se agrega sin espacio extra.
- Solo un dictado a la vez: al empezar otro, el anterior se detiene.
- El permiso llega después de detener o desmontar: no se agrega texto ni se reactiva.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El campo "Biografía o experiencia profesional" MUST tener un botón de micrófono que inicia y detiene el dictado.
- **FR-002**: Cada respuesta de las preguntas de "Mejorar trayectoria y competencias" MUST tener su propio botón de micrófono.
- **FR-003**: El texto dictado MUST agregarse al final del texto existente, separado por un espacio cuando haga falta, y nunca reemplazarlo.
- **FR-004**: Mientras se dicta, MUST verse que se está escuchando (estado del botón, aria-pressed y un texto de estado que anuncie lo reconocido provisoriamente).
- **FR-005**: El dictado MUST reconocer español de Argentina por defecto.
- **FR-006**: El botón MUST mostrarse solo si el navegador ofrece dictado por voz.
- **FR-007**: El dictado MUST detenerse al tocar de nuevo el botón, al enviar el formulario, al deshabilitarse el campo, al cerrar el asistente y al salir de la pantalla.
- **FR-008**: Los errores (permiso denegado, sin micrófono, sin conexión, silencio, fallo genérico) MUST mostrarse en español rioplatense con voseo; una cancelación propia no muestra error.
- **FR-009**: Agregar texto dictado MUST comportarse como escribirlo: actualiza el contador de caracteres y, en la experiencia profesional, invalida la revisión previa del asistente.
- **FR-010**: Los botones MUST tener `data-testid` estables y nombre accesible.
- **FR-011**: La app MUST NOT guardar ni enviar el audio a su backend; solo el texto resultante entra al flujo actual.

### Key Entities

- **Sesión de dictado**: estado efímero en el navegador (`idle`, `listening`, `error`), el texto provisorio y el mensaje de error. No se persiste.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona completa el campo de experiencia por voz con como máximo 2 toques (empezar y detener).
- **SC-002**: El 100% de las frases confirmadas se agregan al final sin perder el texto previo.
- **SC-003**: En navegadores sin dictado no aparece ningún control roto ni texto en inglés.
- **SC-004**: El micrófono se libera en el 100% de los cierres (detener, enviar, cerrar, salir).

## Assumptions

- Se usa el reconocimiento de voz que ofrece el navegador (Chrome, Edge, Safari). Algunos navegadores procesan el audio en servicios propios del fabricante; la app no recibe ni guarda audio. Se documenta para la revisión de privacidad.
- El idioma fijo es `es-AR`; el CV se escribe mayormente en español y la detección de idioma del CV (feature 014) sigue funcionando sobre el texto resultante.
- No se agregan dependencias nuevas ni cambios en el backend, la base de datos o los contratos.
- La puntuación depende del reconocedor del navegador; la persona puede corregir el texto antes de generar.
- Fuera de alcance: dictado en otros campos (perfil básico, editor de CV importado, búsqueda de empleos), elección de idioma y comandos de voz.
