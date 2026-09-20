# Research: End-to-End CV Generation Flow

## Decision 1: Azure OpenAI GPT-4o como proveedor único del MVP

- **Decision**: Usar Azure OpenAI GPT-4o con salida estructurada y un System Prompt
  dedicado a extracción de CV.
- **Rationale**: La constitución exige Azure OpenAI como proveedor de IA y prohíbe introducir
  proveedores alternativos sin una enmienda. GPT-4o cubre extracción multisección y redacción
  orientada a logros dentro del flujo sincrónico.
- **Alternatives considered**: Anthropic Claude 3.5 en Azure fue mencionado como alternativa,
  pero se difiere para evitar dos contratos de proveedor en el MVP.

## Decision 2: Contrato único y versionable para el CV

- **Decision**: Mantener un objeto raíz estable con `personalInfo`, `summary`, `experience`,
  `education`, `skills`, `languages` y `certifications`; las secciones repetibles siempre son
  arrays, aunque estén vacías.
- **Rationale**: Un contrato único permite que FastAPI valide una vez y que ambas plantillas
  rendericen el mismo dato sin transformaciones implícitas.
- **Alternatives considered**: Se descartan secciones dinámicas y un objeto plano porque dificultan
  la validación, la compatibilidad entre plantillas y la evolución del esquema.

## Decision 3: Validación defensiva en backend antes de persistir

- **Decision**: Validar autenticación, payload de entrada y respuesta del modelo en FastAPI;
  persistir solo documentos que cumplen el esquema.
- **Rationale**: El backend es el límite de confianza y evita que JSON inválido o datos de otro
  usuario alcancen Supabase o el navegador.
- **Alternatives considered**: Validar solo en frontend se rechaza porque el cliente no es un
  límite de seguridad y permitiría persistencia inconsistente.

## Decision 4: PDF exclusivamente en el navegador

- **Decision**: Las plantillas Minimalista ATS y Creativo PDF consumirán el contrato validado y
  `@react-pdf/renderer` generará el archivo en el cliente.
- **Rationale**: Cumple la constitución, evita trabajo de renderizado en FastAPI y permite revisar
  la misma representación antes de descargar.
- **Alternatives considered**: Renderizar PDF en backend se descarta para esta etapa por mayor
  complejidad operativa y por contravenir el límite de arquitectura.

## Decision 5: Flujo sincrónico con idempotencia de solicitud

- **Decision**: `POST /api/generate-cv` devuelve el CV validado en la misma operación y acepta un
  identificador de solicitud para impedir duplicados cuando el cliente reintenta.
- **Rationale**: La experiencia MVP necesita feedback inmediato y el requisito FR-020 exige no
  duplicar registros ante errores de red.
- **Alternatives considered**: Colas, workers y polling quedan fuera por estar explícitamente
  reservados para la Etapa 2.

## Decision 6: Frontera explícita de credenciales

- **Decision**: Mantener las credenciales de Azure OpenAI, PostgreSQL y Supabase privilegiado solo
  en el backend mediante variables de entorno o un gestor de secretos. El navegador recibe solo
  configuración pública de Supabase y el access token de la sesión.
- **Rationale**: Reduce el impacto de exposición en el cliente y cumple el principio constitucional
  de no distribuir secretos ni cadenas de conexión.
- **Alternatives considered**: Exponer claves de Azure o Supabase service-role al navegador se
  rechaza porque permitiría su reutilización fuera de la autorización del usuario.

## Decision 7: Validación condicional de contacto

- **Decision**: Validar `email` con formato de correo y `linkedin`/`website` con URL `http` o `https` cuando
  tengan valor; aceptar `""` para representar información ausente.
- **Rationale**: Mantiene el contrato uniforme decidido previamente y evita contaminar el CV con
  datos de contacto claramente inválidos sin penalizar perfiles incompletos.
- **Alternatives considered**: Texto libre para todos los campos se descarta por reducir la
  confiabilidad de las plantillas y de los documentos exportados.

## Decision 8: Alcance de persistencia del MVP

- **Decision**: Persistir el resultado asociado a `user_id` y `request_id` solo para completar la
  solicitud y hacer reintentos idempotentes; no ofrecer consulta ni vista de historial.
- **Rationale**: Mantiene la seguridad y la idempotencia necesarias sin ampliar el MVP con una
  experiencia de gestión de documentos.
- **Alternatives considered**: Exponer listado o consulta de CVs se difiere a una feature posterior.
