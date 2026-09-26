# Research: Enriquecimiento de trayectoria y competencias

## Decision 1: Mantener el estado de preguntas en la sesión cliente

**Decision**: El navegador mantiene el texto fuente, respuestas, propuestas y decisiones durante la revisión en memoria. Cada turno envía el texto y las respuestas previas necesarias; el backend no persiste conversación, borradores ni identificadores de sesión. El estado se descarta al cerrar, cambiar de usuario, salir del flujo o completar el CV.

**Rationale**: La feature puede funcionar por turnos síncronos sin crear historial o retención de información profesional adicional. El backend sigue siendo stateless y solo persiste el CV final por el flujo existente.

**Alternatives considered**:
- Guardar la conversación en PostgreSQL: permitiría reanudarla, pero requiere una entidad, RLS, expiración, política de borrado y pruebas de aislamiento que no aportan valor solicitado en esta iteración.
- Guardar turnos en `localStorage`: facilita recarga, pero amplía la persistencia local de datos profesionales y requiere nueva política de borrado.

## Decision 2: Separar el contrato de asistencia del contrato final de CV

**Decision**: Crear modelos Pydantic de asistencia con estado discriminado `needs_input` o `ready`, preguntas de seguimiento y propuestas tipadas. El servicio de asistencia usa Azure OpenAI ya configurado y no modifica ni devuelve un `StructuredCv`. El endpoint existente de generación continúa produciendo y validando el contrato de CV vigente.

**Rationale**: Las preguntas, evidencias y estados de revisión son datos de interacción que no pertenecen a `cv-schema.json`. Mantener contratos separados impide que contenido parcial o metadatos de procedencia lleguen a las plantillas PDF o a la tabla de CV.

**Alternatives considered**:
- Añadir campos de preguntas, evidencia y estado de aceptación al JSON final del CV: rechazado porque expone estado temporal en plantillas, PDF y persistencia.
- Crear una conversación persistida y convertirla en un CV mediante una API nueva: rechazado porque duplica el flujo existente de generación sin que se solicite reanudación.

## Decision 3: Toda competencia demostrada debe señalar evidencia textual

**Decision**: Las propuestas de trayectoria y competencias demostradas contienen una o más citas textuales del texto fuente o respuestas confirmadas. El backend valida que cada cita sea una subcadena de la entrada acumulada. Si la salida no incluye evidencia válida, la propuesta no se devuelve como competencia demostrada. Las recomendaciones de desarrollo se etiquetan separadamente y no requieren ni afirman evidencia de una capacidad ya adquirida.

**Rationale**: El contrato actual de CV valida forma, pero no procedencia semántica. Citas verificables y revisión del usuario establecen un límite comprobable adicional sin ampliar el esquema CV.

**Alternatives considered**:
- Confiar solo en el prompt para que el modelo no invente hechos: rechazado porque el prompt actual también contiene esa regla, pero no verifica de forma automática la procedencia de cada afirmación.
- Aceptar competencias sin evidencia si el modelo estima alta confianza: rechazado porque la confidence generada no prueba que el usuario posea la competencia.

## Decision 4: Solo las propuestas aceptadas se añaden al texto de generación

**Decision**: El usuario puede editar y aceptar cada propuesta factual. Al solicitar el CV, el cliente compone el texto fuente original con las versiones aceptadas/editadas; las propuestas rechazadas, inferencias pendientes y acciones de desarrollo no se añaden. Ese texto usa el endpoint actual de generación y el resultado vuelve a validarse con `StructuredCv`.

**Rationale**: Reutiliza el límite de validación y persistencia ya establecido y no agrega un contrato alterno de almacenamiento de CV. Las sugerencias de desarrollo quedan en la interfaz de asistencia y fuera de las competencias factuales del documento.

**Alternatives considered**:
- Persistir propuestas antes de pedir aceptación: rechazado porque crearía contenido parcial o no confirmado en el CV persistido.
- Reemplazar el generador actual por una segunda generación acoplada al diálogo: rechazado porque duplicaría validación e idempotencia.
- Aplicar automáticamente las competencias inferidas a `skills`: rechazado porque confundiría capacidad probable con competencia confirmada.

## Decision 5: Reutilizar Azure OpenAI y el stack vigente

**Decision**: Añadir una operación específica al proveedor Azure OpenAI existente que solicite JSON estricto para preguntas/propuestas. Mantener la comunicación síncrona por FastAPI y usar React/Next.js para interacción y revisión. No agregar paquetes ni servicios.

**Rationale**: El stack ya provee autenticación bearer, Azure JSON mode, Pydantic, preview, CV generation y persistencia final; un proveedor o infraestructura de chat nueva no es necesaria.

**Alternatives considered**:
- Incorporar un servicio de conversación o una base vectorial: rechazado porque el flujo solo necesita contexto textual aportado por el usuario y no búsqueda externa.
- Exponer credenciales o consultar Azure desde el navegador: rechazado por los límites de seguridad del proyecto.

## Integration Notes

- Operación propuesta: `POST /api/trajectory-assistance/turn`, autenticada con el bearer existente; recibe `sourceText` y respuestas previas, no `user_id`.
- La respuesta `needs_input` devuelve preguntas acotadas; `ready` devuelve propuestas factuales con citas de evidencia y acciones de desarrollo separadas.
- El estado provisional vive en memoria cliente y se limpia al cambiar de usuario/salir del flujo; ningún turno se agrega a `resumes`.
- El cuerpo final de `generate-cv` sigue siendo `{text}`; el texto se compone con las propuestas factuales aceptadas/editadas, nunca con opciones rechazadas o acciones de desarrollo.
- Azure recibe información profesional en cada turno; las llamadas son síncronas y sujetas al límite de tiempo de proveedor. La política de retención de Azure no se determina en el código actual y debe revisarse operativamente antes del despliegue.
