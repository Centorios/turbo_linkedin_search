# Feature Specification: End-to-End CV Generation Flow

**Feature Branch**: `001-cv-generation-flow`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "End-to-End User Flow: autenticación, entrada de biografía, generación de CV estructurado y descarga de PDF."

## Clarifications

### Session 2026-09-19

- Q: ¿Qué estructura canónica debe tener el JSON que devuelve el modelo para representar el CV generado? → A: Objeto anidado con `personalInfo`, `summary`, `experience[]`, `education[]`, `skills.hard[]`, `skills.soft[]`, `languages[]` y `certifications[]`.
- Q: ¿Los campos textuales ausentes del JSON deben representarse siempre como cadenas vacías, manteniendo todas las propiedades requeridas? → A: Todas las propiedades textuales permanecen presentes y usan `""` cuando no hay información; las colecciones usan `[]`.
- Q: ¿Qué formato deben usar las fechas de experiencia, educación y certificaciones cuando la fuente contiene solo mes y año o únicamente el año? → A: `MM-YYYY` o `YYYY`.
- Q: ¿Dónde deben almacenarse y qué credenciales pueden llegar al navegador durante el flujo de generación? → A: Azure, PostgreSQL y claves privilegiadas de Supabase solo en backend mediante variables de entorno o gestor de secretos; el navegador solo recibe configuración pública de Supabase y el access token de sesión.
- Q: ¿Los campos `email`, `linkedin` y `website` deben validarse con formato específico cuando no estén vacíos? → A: Validar `email` como correo y `linkedin`/`website` como URL cuando tengan valor; aceptar `""` si faltan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear cuenta e iniciar sesión (Priority: P1)

Como persona que busca mejorar su CV, quiero crear una cuenta o iniciar sesión con mi correo y contraseña para asociar de forma privada mi identidad con cada solicitud de generación.

**Why this priority**: La identidad del usuario es necesaria para proteger la información profesional y autorizar la generación.

**Independent Test**: Se puede probar creando una cuenta, iniciando sesión, cerrando sesión y comprobando que solo una sesión válida permite acceder al flujo privado.

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta en la pantalla de acceso, **When** completa un correo y una contraseña válidos y confirma el registro, **Then** se crea la cuenta y se establece una sesión.
2. **Given** una cuenta existente, **When** la persona introduce credenciales válidas, **Then** accede al formulario privado de generación de CV.
3. **Given** credenciales inválidas, **When** la persona intenta iniciar sesión, **Then** ve un mensaje claro y no accede a información privada.
4. **Given** una sesión activa, **When** la persona recarga la aplicación, **Then** la sesión se conserva sin volver a autenticarse durante su vigencia.

---

### User Story 2 - Generar y revisar un CV (Priority: P1)

Como usuario autenticado, quiero pegar mi biografía o historia laboral y solicitar un CV para recibir una versión estructurada con información profesional útil y orientada a logros.

**Why this priority**: Esta es la principal propuesta de valor del MVP y transforma texto libre en un documento profesional revisable.

**Independent Test**: Se puede probar con una sesión válida y un texto profesional completo, verificando que el resultado muestra las secciones esperadas y que el estado de carga informa el progreso.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado en el formulario, **When** pega una biografía o historia laboral no vacía y solicita la generación, **Then** el botón muestra un estado de carga y el sistema procesa la solicitud.
2. **Given** una solicitud procesada correctamente, **When** el resultado está disponible, **Then** el usuario ve una previsualización con información personal, resumen, experiencia, logros cuantificables, educación, habilidades duras, habilidades blandas, idiomas y certificaciones cuando estén presentes.
3. **Given** un usuario no autenticado, **When** intenta enviar información profesional, **Then** la solicitud se rechaza y se le solicita iniciar sesión.
4. **Given** una respuesta que no cumple la estructura esperada, **When** el sistema intenta procesarla, **Then** no muestra ni guarda datos incompletos como si fueran válidos y comunica un error recuperable.

---

### User Story 3 - Descargar el CV en PDF (Priority: P2)

Como usuario que revisó su CV generado, quiero descargarlo en PDF para compartirlo o utilizarlo en una postulación.

**Why this priority**: La descarga convierte el resultado generado en un documento utilizable fuera de la aplicación.

**Independent Test**: Se puede probar desde una previsualización válida, pulsando la acción de descarga y comprobando que se obtiene un PDF legible con el contenido mostrado.

**Acceptance Scenarios**:

1. **Given** una previsualización válida, **When** el usuario pulsa "Descargar PDF", **Then** se genera y descarga un archivo PDF desde el navegador.
2. **Given** un CV con contenido mínimo, **When** el usuario descarga el PDF, **Then** el archivo mantiene las secciones disponibles sin errores de formato.
3. **Given** una descarga en curso, **When** el usuario vuelve a pulsar la acción, **Then** la interfaz evita descargas duplicadas o informa que la primera sigue en curso.

---

### Edge Cases

- El texto enviado está vacío o solo contiene espacios: el sistema debe impedir el envío y explicar qué información falta.
- El texto es muy corto para extraer experiencia o educación: el resultado debe conservar las secciones disponibles y señalar la información ausente sin inventarla.
- El texto contiene caracteres especiales, varios idiomas o saltos de línea: el sistema debe conservar el significado y mostrar el contenido correctamente.
- La sesión expira mientras se procesa una solicitud: el sistema no debe guardar el resultado sin autorización y debe solicitar autenticación nuevamente.
- El servicio de generación no responde o devuelve un error: el usuario debe recibir un mensaje accionable y poder reintentar sin duplicar registros de la solicitud.
- La generación produce un CV con una sola sección: la previsualización y el PDF deben seguir siendo legibles.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir crear una cuenta e iniciar sesión con correo electrónico y contraseña.
- **FR-002**: El sistema MUST mantener la sesión del usuario mientras sea válida y MUST permitir cerrar sesión.
- **FR-003**: El sistema MUST impedir el acceso al flujo de generación cuando no existe una sesión válida.
- **FR-004**: El sistema MUST permitir al usuario autenticado introducir una biografía o historia laboral en texto plano.
- **FR-005**: El sistema MUST validar que el texto de entrada no esté vacío antes de iniciar la generación.
- **FR-006**: El sistema MUST mostrar un estado de carga claro desde el envío hasta la recepción de un resultado o error.
- **FR-007**: El sistema MUST enviar la solicitud de generación únicamente con la identidad autenticada del usuario y el texto introducido.
- **FR-008**: El sistema MUST validar la identidad del usuario antes de procesar o persistir la solicitud.
- **FR-009**: El sistema MUST solicitar una respuesta estructurada con un objeto anidado que incluya `personalInfo`, `summary`, `experience[]`, `education[]`, `skills.hard[]`, `skills.soft[]`, `languages[]` y `certifications[]`.
- **FR-009a**: Dentro de `personalInfo`, `email` MUST ser un correo válido cuando no sea `""`, y `linkedin` y `website` MUST ser URLs `http` o `https` válidas cuando no sean `""`.
- **FR-010**: Cada elemento de `experience[]` MUST incluir, cuando estén disponibles, cargo, empresa, ubicación, fechas y logros cuantificables; cada elemento de `education[]` MUST incluir, cuando estén disponibles, institución, programa, fechas y descripción. Las fechas MUST usar `MM-YYYY` o `YYYY`.
- **FR-011**: Cada elemento de `certifications[]` MUST incluir, cuando estén disponibles, nombre, entidad emisora, fecha de obtención, fecha de vencimiento y credencial o referencia. Las fechas MUST usar `MM-YYYY` o `YYYY`.
- **FR-012**: El sistema MUST conservar como listas vacías (`[]`) las secciones repetibles sin información suficiente, mantener como cadenas vacías (`""`) las propiedades textuales sin datos y MUST evitar inventar elementos ausentes.
- **FR-013**: El sistema MUST rechazar respuestas que no cumplan el esquema de CV definido y MUST mostrar un error recuperable.
- **FR-014**: El sistema MUST persistir cada CV válido asociado al usuario y a su `requestId` para completar la solicitud y permitir reintentos idempotentes; el MVP MUST excluir una vista o consulta de historial de CVs.
- **FR-015**: El sistema MUST devolver el CV validado para que el usuario pueda revisarlo antes de descargarlo.
- **FR-016**: El sistema MUST mostrar una previsualización interactiva y legible del CV generado.
- **FR-017**: El sistema MUST permitir seleccionar y visualizar al menos una plantilla orientada a ATS y una plantilla visual para lectura humana, sin perder la información estructurada.
- **FR-018**: El sistema MUST permitir descargar la previsualización válida como un archivo PDF generado en el navegador.
- **FR-019**: El sistema MUST mostrar mensajes comprensibles para errores de autenticación, entrada inválida, generación fallida y sesión expirada.
- **FR-020**: El sistema MUST evitar duplicar registros cuando una misma solicitud se reintenta tras un error de red antes de confirmar el resultado.
- **FR-021**: El sistema MUST aplicar aislamiento por `user_id` en toda persistencia y operación de idempotencia, y MUST impedir que una solicitud acceda a datos asociados a otro usuario. El MVP no ofrece endpoints de consulta de historial.
- **FR-022**: Las claves de Azure OpenAI, cadenas de conexión de PostgreSQL y claves privilegiadas de Supabase MUST almacenarse solo en el backend mediante variables de entorno o un gestor de secretos. El navegador MUST recibir únicamente la configuración pública necesaria de Supabase y el access token de la sesión autenticada; nunca debe recibir claves de proveedor, claves de servicio ni cadenas de conexión.

### Key Entities *(include if feature involves data)*

- **Usuario**: Persona autenticada, identificada por correo y una identidad única, titular de sus solicitudes de generación.
- **Perfil profesional de entrada**: Texto libre aportado por el usuario, con la biografía o historia laboral que inicia la generación.
- **CV estructurado**: Documento generado y validado con `personalInfo`, `summary`, `experience[]`, `education[]`, `skills.hard[]`, `skills.soft[]`, `languages[]` y `certifications[]`.
- **Certificación**: Credencial profesional asociada a su nombre, entidad emisora, fechas y referencia cuando estén disponibles.
- **Sesión**: Estado autenticado que autoriza las operaciones privadas mientras sus credenciales sean válidas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al menos el 90% de usuarios de prueba puede crear una cuenta o iniciar sesión y llegar al formulario sin asistencia.
- **SC-002**: En una muestra de al menos 30 solicitudes válidas ejecutadas en el entorno local configurado, el percentil 90 del tiempo entre $T_0$ (pulsación de "Generar CV") y $T_f$ (finalización de la recepción del JSON estructurado y renderizado de la previsualización interactiva) MUST ser de 60 segundos o menos.
- **SC-003**: El 100% de CVs mostrados en la previsualización contiene únicamente datos que pasaron la validación estructural.
- **SC-004**: Al menos el 95% de usuarios de prueba puede identificar el estado de carga, corregir una entrada vacía o reintentar tras un error sin abandonar el flujo.
- **SC-005**: Al menos el 95% de descargas válidas produce un PDF que se abre correctamente y conserva el contenido visible en la previsualización.
- **SC-006**: En pruebas de autorización, el 100% de intentos de acceder a datos de generación de otro usuario son rechazados.

## Assumptions

- El usuario dispone de conexión a internet y de un navegador moderno compatible con la aplicación.
- La primera versión utiliza correo y contraseña; los proveedores externos de identidad quedan fuera de esta feature.
- El usuario aporta información veraz y suficiente para que el sistema redacte logros; el sistema no debe inventar datos ausentes.
- El MVP no ofrece historial ni consulta posterior de CVs; `resumes` conserva únicamente el resultado
	necesario para completar la solicitud y resolver reintentos idempotentes.
- La generación es sincrónica para esta etapa; scraping, embeddings, colas y procesamiento en segundo plano quedan fuera de alcance.
- La aplicación ya cuenta o contará con configuración segura para autenticación, persistencia y generación, sin exponer secretos al navegador.
