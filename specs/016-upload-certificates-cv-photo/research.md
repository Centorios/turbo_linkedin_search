# Research: certificados del perfil y foto editable

## R1. Biblioteca de certificados separada del CV

**Decision**: Crear `user_certificates` y bucket privado `user-certificates`, con propietario y archivo original. El CV guarda una copia de los campos normalizados en `resumes.data.certifications`; el archivo no se copia ni se anexa al PDF.

**Rationale**: `basic_profiles` contiene datos personales simples y `resumes.data` ya es el contrato de CV versionado. Una colección separada evita que `PUT /api/profile` sobrescriba certificados y permite reutilizar un archivo en varias generaciones. La copia de datos conserva el CV histórico si el certificado del perfil cambia.

**Alternatives considered**: Archivos por CV duplicarían almacenamiento y contradicen la aclaración; un array dentro de `basic_profiles` dificulta deduplicación y consultas de archivos.

## R2. Extracción de documentos con servicios existentes

**Decision**: Reutilizar `pypdf` para PDF con texto extraíble, con límite de 5 MiB y 5 páginas. Para JPEG/PNG, enviar la imagen por el proveedor Azure OpenAI actual como contenido visual, exigir objeto JSON de una credencial y validar con Pydantic. Antes de implementarlo, verificar que `AZURE_OPENAI_DEPLOYMENT` admite imágenes en la configuración real. Si el PDF no tiene texto, informar que se necesita un PDF legible o una imagen compatible.

**Rationale**: El backend ya usa `pypdf`, `httpx` y el despliegue Azure para JSON. [La documentación de Microsoft para modelos de chat con visión](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/gpt-v-quickstart) describe imágenes base64 en mensajes; la disponibilidad depende del modelo desplegado. El límite de páginas y tamaño contiene coste y tiempo.

**Alternatives considered**: OCR de PDF escaneado y un servicio externo ampliarían proveedores, coste y permisos; una librería OCR local agregaría dependencias y carga operativa. El contrato de esta feature acepta PDF con texto e imágenes legibles.

## R3. Duplicados e idempotencia

**Decision**: Calcular SHA-256 del archivo para repetición exacta y comparar identidad normalizada dentro del usuario: referencia/credencial identificable, o nombre+emisor con fechas compatibles. Resolver la comparación en un flujo serializado por usuario al registrar el certificado, con restricción única por `(user_id, content_sha256)` y `(user_id, request_id)` como segunda defensa. Una coincidencia devuelve el certificado existente; conflictos de datos se devuelven para revisión, sin sobrescribir campos no vacíos.

**Rationale**: La comparación por nombre solo confundiría cursos distintos; la comparación por bytes sola no detectaría el mismo certificado exportado de otra manera. La serialización y las restricciones evitan duplicados ante dos cargas simultáneas.

**Alternatives considered**: Matching por embeddings es innecesario y menos explicable; una clave única basada solo en nombre/emisor puede descartar credenciales realmente distintas.

## R4. Selección y versión inmutable

**Decision**: Los IDs del perfil se envían explícitamente en la solicitud de generación o guardado y se resuelven con `user_id` en el backend. Los certificados previos comienzan sin seleccionar; uno recién subido queda seleccionado. El servidor combina los seleccionados con certificaciones ya extraídas del texto/CV, sin borrar entradas de la versión base. `resumes.data` es un snapshot; cambios posteriores en el perfil no alteran CVs guardados.

**Rationale**: Preserva el contrato `StructuredCv`, la generación sincrónica y el historial. La selección en cliente no sustituye la autorización en servidor. El reintento de `/api/generate-cv` debe devolver el snapshot guardado y no aplicar el perfil actual sobre él.

**Alternatives considered**: Guardar una referencia dinámica para renderizar certificados haría variar CVs históricos; insertar todos sin selección contradice la decisión del usuario.

## R5. Fotos por versión sin nuevo proveedor

**Decision**: Reutilizar `profile-photos` como bucket privado, con cada nueva foto en una ruta UUID inmutable. El editor carga la URL firmada para previsualizar y conserva `photoPath` en el JSON. Al guardar, el backend valida formato, propiedad y existencia de la ruta. El flujo de edición del perfil deja de borrar inmediatamente fotos antiguas; la política de eliminación de Storage también impide borrar una ruta referenciada por `resumes.data.personalInfo.photoPath`. La limpieza futura requiere comprobar referencias.

**Rationale**: El bucket, políticas y cliente de carga ya existen. Mantener los objetos referenciados evita que el CV original pierda su imagen al reemplazar la foto en otra versión o en el perfil. El PDF se sigue generando en frontend con la función compartida.

**Alternatives considered**: Un bucket nuevo exigiría cambiar el significado de `photoPath` o añadir un campo de bucket en el esquema; reutilizar la ruta mutable del perfil rompería el historial. No se hará una migración retrospectiva de fotos que ya no existan.

## R6. Guardado y fallos parciales

**Decision**: Mantener endpoints existentes de versiones. El archivo nuevo de certificado se valida antes de persistirlo y se limpia si falla el alta de metadatos; si sus datos son inciertos queda `pending_review` y no se ofrece para selección. La UI solo presenta como seleccionable un registro `ready`. Se diferencian certificados guardados en el perfil de certificados seleccionados para el CV. Si falla guardar una versión, se conserva la base y la propuesta en pantalla para reintentar con la misma clave idempotente.

**Rationale**: La carga de biblioteca es una operación propia, mientras que crear una versión sigue siendo otra operación explícita del usuario. Esta separación coincide con el repositorio y evita mostrar un guardado parcial como definitivo.

**Alternatives considered**: Una única solicitud de generación con archivos binarios y CV complicaría los reintentos y la validación del contrato JSON actual.
