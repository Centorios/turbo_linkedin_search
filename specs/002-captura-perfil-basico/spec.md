# Feature Specification: Captura de perfil básico tras iniciar sesión

**Feature Branch**: No creada (no hay hook de ramas configurado)

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Después del login, promptear a un modal con ingreso de datos básicos para después utilizar en la confección del CV"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Completar perfil básico después del acceso (Priority: P1)

Como usuario que acaba de iniciar sesión, quiero introducir mis datos personales en un formulario breve para no tener que volver a escribirlos al preparar mi CV.

**Why this priority**: El perfil básico aporta información personal reutilizable y evita repetir datos en el flujo principal del producto.

**Independent Test**: Iniciar sesión con una cuenta sin perfil básico, completar los campos, guardar y volver a entrar para comprobar que los datos se conservan y se muestran asociados a esa cuenta.

**Acceptance Scenarios**:

1. **Given** una persona autenticada cuya cuenta todavía no tiene nombre guardado, **When** termina el inicio de sesión, **Then** aparece un modal para completar el perfil antes de continuar al flujo del CV.
2. **Given** el modal abierto, **When** la persona introduce su nombre y los demás datos que desea compartir y guarda, **Then** el perfil queda guardado y el modal se cierra.
3. **Given** el correo de acceso conocido por la aplicación, **When** se muestra el modal, **Then** ese correo aparece como valor inicial del campo de correo y puede editarse para el CV sin cambiar las credenciales de acceso.
4. **Given** la persona no desea completar el perfil todavía, **When** pospone o cierra el modal, **Then** puede continuar sin guardar datos y se le vuelve a ofrecer el formulario en un inicio de sesión posterior.
5. **Given** un campo obligatorio vacío o un correo o enlace con formato no válido, **When** la persona intenta guardar, **Then** los datos no se guardan y se indica cómo corregirlos.

---

### User Story 2 - Reutilizar el perfil al preparar el CV (Priority: P1)

Como usuario con un perfil básico guardado, quiero que mis datos personales se incluyan automáticamente al preparar un CV para revisar el documento sin volver a introducirlos.

**Why this priority**: La reutilización conecta el nuevo perfil con el valor principal de la aplicación y reduce entradas duplicadas.

**Independent Test**: Guardar un perfil con datos personales, iniciar la preparación de un CV con información profesional y comprobar que la vista previa contiene los datos guardados en sus campos personales, junto con las secciones profesionales obtenidas de la información aportada.

**Acceptance Scenarios**:

1. **Given** un perfil básico guardado y una nueva solicitud de CV, **When** el usuario recibe la vista previa, **Then** nombre, correo, teléfono, ubicación y enlaces guardados aparecen en los campos correspondientes sin pedirlos de nuevo.
2. **Given** la información profesional no contiene datos personales o contiene datos personales distintos, **When** se prepara el CV, **Then** los datos confirmados en el perfil se conservan en la sección personal y no se inventan datos profesionales ausentes.
3. **Given** un perfil guardado para una cuenta, **When** inicia sesión otra cuenta en el mismo navegador, **Then** no se muestra ni se reutiliza el perfil de la cuenta anterior.

### Edge Cases

- La cuenta tiene un perfil previo sin nombre: el modal vuelve a solicitar el dato obligatorio y conserva los datos opcionales válidos que ya existan.
- La sesión expira mientras se guarda el perfil: la aplicación no confirma el guardado y solicita volver a autenticarse.
- Un enlace de LinkedIn o sitio web no usa `http` o `https`: se rechaza ese valor con un mensaje asociado al campo.
- El usuario pospone el formulario y continúa al CV: el flujo existente permanece disponible y no incorpora valores no guardados.
- El guardado falla por un problema temporal: los valores introducidos permanecen disponibles en el formulario para reintentar mientras la sesión siga activa.
- La consulta del perfil falla después del inicio de sesión: el sistema muestra un error recuperable, no trata el error como si no hubiera perfil y ofrece reintentar antes de habilitar la generación.
- El perfil contiene campos opcionales vacíos: el CV conserva esos campos vacíos y puede completarse con el resto de información disponible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Después de un inicio de sesión correcto, el sistema MUST ofrecer el modal de perfil básico cuando la cuenta no tenga guardado un nombre completo.
- **FR-002**: El modal MUST permitir ingresar nombre completo, correo electrónico, teléfono, ubicación, perfil de LinkedIn y sitio web; solo el nombre completo será obligatorio.
- **FR-003**: El sistema MUST iniciar el campo de correo con el correo de la cuenta cuando esté disponible y MUST permitir editarlo para el CV sin modificar el correo de acceso.
- **FR-004**: El sistema MUST aceptar un correo vacío o válido y enlaces vacíos o direcciones `http`/`https` válidas; MUST indicar los errores junto al campo correspondiente y MUST impedir el guardado de datos inválidos.
- **FR-005**: El sistema MUST guardar el perfil asociado a la cuenta autenticada y MUST impedir que otra cuenta vea o utilice esos datos.
- **FR-006**: El usuario MUST poder posponer o cerrar el modal; esta acción MUST dejar el perfil sin cambios y MUST permitir que se vuelva a ofrecer en un inicio de sesión posterior mientras no haya nombre guardado.
- **FR-007**: El sistema MUST reutilizar los datos guardados en los campos personales correspondientes del CV y MUST conservarlos en la vista previa sin requerir que el usuario los vuelva a escribir.
- **FR-008**: La información personal guardada MUST complementar, y no reemplazar, la experiencia, educación, habilidades u otros datos profesionales aportados por el usuario.
- **FR-009**: Si la lectura o el guardado del perfil falla o la sesión deja de ser válida, el sistema MUST mostrar un mensaje comprensible y MUST ofrecer recuperación. Un fallo de lectura MUST distinguirse de un perfil ausente y MUST impedir iniciar la generación hasta completar una lectura correcta; un fallo de guardado MUST evitar confirmar datos no guardados y MUST permitir reintentar.
- **FR-010**: Al cambiar de cuenta o cerrar sesión, el sistema MUST dejar de mostrar o reutilizar el perfil de la cuenta anterior.

### Key Entities *(include if feature involves data)*

- **Perfil básico**: Datos personales que el usuario guarda para sus CVs: nombre completo, correo para el CV, teléfono, ubicación, LinkedIn y sitio web.
- **Usuario autenticado**: Titular del perfil básico y de los datos profesionales usados para preparar sus CVs.
- **CV preparado**: Documento revisable que combina los datos personales confirmados del perfil con la información profesional disponible para esa solicitud.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al menos el 90% de usuarios nuevos de prueba ve el formulario de perfil en su primer inicio de sesión cuando aún no ha guardado un nombre.
- **SC-002**: Al menos el 90% de usuarios de prueba puede completar o posponer el formulario en menos de dos minutos.
- **SC-003**: El 100% de los datos personales válidos guardados aparece en el campo correspondiente de la vista previa del CV sin volver a ingresarlos.
- **SC-004**: El 100% de intentos de una cuenta por consultar o reutilizar el perfil de otra cuenta es rechazado.
- **SC-005**: Al menos el 95% de usuarios de prueba puede corregir un dato inválido o reintentar un guardado fallido sin perder los demás valores introducidos.

## Assumptions

- La persona ya completó correctamente el inicio de sesión antes de que se ofrezca el modal.
- El formulario solo vuelve a aparecer automáticamente mientras no haya un nombre completo guardado; los campos opcionales pueden permanecer vacíos.
- El correo de acceso se propone como correo del CV, pero modificarlo en el perfil no cambia la cuenta de acceso.
- Posponer el formulario no bloquea la preparación de un CV y no persiste los valores escritos parcialmente.
- Los datos del perfil cubren solo información personal; la experiencia, formación y habilidades continúan obteniéndose de la información que el usuario aporte al preparar cada CV.
- Los datos personales confirmados en el perfil prevalecen en los campos personales del CV hasta que el usuario los cambie en el perfil.
