# Research: Captura de perfil básico tras iniciar sesión

## Decision 1: Guardar el perfil en una tabla propia por usuario

**Decision**: Crear una tabla `basic_profiles` con una única fila por `user_id`, referenciada a `auth.users`, con los seis campos de perfil y `updated_at`. Aplicar RLS por `auth.uid() = user_id` y añadir validación equivalente en la capa de servicio.

**Rationale**: El correo de contacto del CV puede ser distinto del correo de autenticación. Una entidad de dominio propia permite validar esos datos y evolucionar el perfil sin mezclarlo con credenciales de acceso. La tabla `resumes` ya usa una clave de usuario, una migración versionada y aislamiento RLS.

**Alternatives considered**:
- Guardar los campos en metadata de Auth: rechazado porque los datos del CV tienen reglas y propósito propios, el correo de CV puede diferir del correo de acceso y los metadatos editables del usuario no deben confundirse con autorización.
- Guardar el perfil solo en estado del navegador: rechazado porque no lo conservaría entre sesiones ni dispositivos y no permitiría reutilizarlo de forma fiable.

## Decision 2: Leer y guardar el perfil a través de FastAPI autenticado

**Decision**: Añadir operaciones `GET /api/profile` y `PUT /api/profile`, protegidas por el bearer token validado con `require_user_id`. El payload no acepta `userId`; el servicio de persistencia deriva `user_id` exclusivamente de la identidad autenticada y lo incluye explícitamente en cada filtro y upsert.

**Rationale**: La constitución exige que FastAPI centralice autenticación, validación y persistencia operativa. El acceso administrativo de Supabase omite RLS, por lo que el filtro explícito por el usuario validado es obligatorio además de la política de base de datos. La respuesta no necesita exponer claves ni identificadores internos.

**Alternatives considered**:
- Operar directamente sobre `basic_profiles` desde el cliente web con la clave anónima: compatible con RLS, pero mueve persistencia y reglas del dominio al cliente, en contra del límite arquitectónico vigente.
- Usar una ruta sin autenticación y recibir `user_id` en el cuerpo: rechazado por permitir suplantación de titular.

## Decision 3: El perfil confirmado prevalece campo por campo en `personalInfo`

**Decision**: Después de validar el CV generado, combinar `personalInfo` con el perfil del usuario antes de persistirlo y devolverlo. Para cada campo personal, usar el valor guardado si no está vacío; si está vacío, conservar el valor extraído por el modelo. No modificar resumen, experiencia, educación, habilidades, idiomas ni certificaciones.

**Rationale**: Los datos confirmados por el usuario son la fuente preferida para nombre y contacto, mientras que el texto profesional puede contener información válida cuando el perfil no la tenga. Aplicar la combinación también a resultados idempotentes garantiza el mismo contrato sin perder secciones profesionales.

**Alternatives considered**:
- Reemplazar todo `personalInfo` con el perfil, incluso sus campos vacíos: rechazado porque eliminaría datos útiles extraídos del texto.
- Aplicar los datos solo en el frontend: rechazado porque la respuesta y el CV persistido diferirían, y el dato confirmado se podría perder al reintentar con idempotencia.
- Pedir al modelo que decida qué dato personal prevalece: rechazado porque introduce una decisión no determinista para datos ya confirmados por el usuario.

## Decision 4: Posponer no persiste ni descarta datos en servidor

**Decision**: El cierre o la acción de posponer solo descarta el estado temporal del formulario y lo oculta durante la sesión actual. En un inicio de sesión posterior, se ofrece otra vez si no existe un perfil con nombre válido.

**Rationale**: Coincide con el requisito de poder continuar sin cambios y volver a ofrecer el modal en un acceso posterior. No se requiere una entidad de estado de onboarding ni persistir información parcial.

**Alternatives considered**:
- Registrar en servidor que el usuario descartó el modal permanentemente: rechazado porque impediría volver a ofrecerlo y ampliaría el modelo de datos sin necesidad.
- Bloquear el flujo de generación hasta completar el perfil: rechazado porque el requisito permite posponer.

## Decision 5: No generar si falla la lectura del perfil existente

**Decision**: Si no existe perfil, la generación continúa con los datos extraídos de la solicitud. Si la consulta a almacenamiento falla, la generación se detiene antes de llamar al proveedor y devuelve un error recuperable sin persistir un resultado incompleto. La respuesta guardada por idempotencia también se combina con el perfil vigente antes de devolverla.

**Rationale**: Permite posponer voluntariamente sin bloquear el MVP y, a la vez, evita ignorar silenciosamente datos personales confirmados cuando la fuente de verdad no está disponible. La combinación con el perfil vigente mantiene su precedencia incluso al repetir una solicitud.

**Alternatives considered**:
- Continuar con el texto de entrada cuando falle una consulta de perfil: rechazado porque podría guardar o mostrar datos personales que contradicen el perfil confirmado.
- Devolver una respuesta idempotente sin consultar el perfil actual: rechazado porque impediría reflejar cambios posteriores del usuario.

## Integration Notes

- El token se obtiene de la sesión existente en Supabase y se envía solo en `Authorization: Bearer`.
- `GET /api/profile` devuelve `null` cuando aún no existe fila; el correo de sesión se propone como valor inicial del formulario, pero no modifica las credenciales de acceso.
- El nombre es obligatorio. Email puede ser `""` o válido; LinkedIn y sitio web pueden ser `""` o URLs `http`/`https`; los campos opcionales restantes usan `""` cuando se desconocen.
- Las llamadas de perfil deben ejecutarse al establecerse una sesión válida, no en rutas públicas ni durante una sesión ajena.
- No se incorporan nuevos proveedores, servicios externos ni dependencias.
