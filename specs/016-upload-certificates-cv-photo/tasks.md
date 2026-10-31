# Tasks: Certificados del perfil y foto editable del CV

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/) y [quickstart.md](./quickstart.md).

**Tests**: La constitución exige pruebas de integración para contratos, autenticación y persistencia, y pruebas de comportamiento para las interfaces críticas. Escribir los casos indicados antes de implementar cada flujo; verificar que fallen por la capacidad ausente y luego que pasen.

**Organization**: US1 = certificados al generar; US2 = certificados al editar; US3 = foto al editar. Todas tienen prioridad P1. `[P]` indica archivos distintos sin dependencia pendiente.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar la capacidad del despliegue y preparar el almacenamiento dentro del stack actual.

- [X] T001 Verificar que el `AZURE_OPENAI_DEPLOYMENT` configurado acepta JPEG/PNG y JSON para extracción, y registrar el resultado y los límites visibles (5 MiB, 5 páginas PDF, 10 archivos por operación, 50 por perfil) en `specs/016-upload-certificates-cv-photo/quickstart.md`; no instalar dependencias sin consultar al usuario.
- [X] T002 Crear `backend/supabase/migrations/010_user_certificates.sql`: tabla `public.user_certificates` con `id` UUID PK, `user_id` UUID FK obligatorio, `request_id` UUID único por usuario, `storage_path` único con prefijo `{user_id}/`, `original_filename` saneado de 1–255 caracteres, `mime_type` PDF/JPEG/PNG, `file_size_bytes` de 1–5 MiB, `content_sha256` hex de 64 caracteres único por usuario, `status` `pending_review|ready`, campos de credencial/idioma y marcas temporales; activar RLS y bucket privado `user-certificates` con políticas por carpeta de propietario.
- [X] T003 Ampliar `backend/supabase/migrations/010_user_certificates.sql` con `resumes.request_fingerprint` y `resumes.certificate_merge_report` opcionales para filas históricas, y restringir el borrado en `profile-photos` de rutas presentes en `resumes.data.personalInfo.photoPath`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Biblioteca privada reutilizable y fusión determinista, sin cambiar los flujos de CV todavía.

**Checkpoint**: Completar esta fase antes de integrar cualquiera de las tres historias.

- [X] T004 [P] Escribir pruebas de contrato para listar, subir, revisar y descargar certificados propios, errores 401/404/413/415/422, límite 50 e idempotencia en `tests/contract/test_profile_certificates_api.py`; deben fallar antes de implementar las rutas.
- [ ] T005 [P] Escribir pruebas de integración de RLS, bucket privado, prefijo `{user_id}/`, límite de 50 y carreras de carga duplicada en `tests/integration/test_user_certificates.py`; deben fallar antes de la persistencia nueva.
- [X] T006 [P] Escribir pruebas de equivalencia para misma referencia o nombre+emisor con fecha compatible, acentos/espacios/mayúsculas, y rechazo de coincidencia parcial de título en `tests/unit/test_certificate_merge.py`; deben fallar antes del combinador.
- [X] T007 Crear modelos de biblioteca, `status` `pending_review|ready`, fechas `YYYY|MM-YYYY|""`, nombre obligatorio para `ready`, límite de 50 IDs distintos y reporte `addedIds/duplicateIds/pendingIds` en `backend/app/models/profile_certificate.py`.
- [X] T008 [P] Añadir al proveedor Azure un prompt exclusivo para extraer una credencial JSON sin obedecer instrucciones contenidas en el archivo y una llamada visual JPEG/PNG mediante el despliegue existente en `backend/app/services/azure_openai.py`.
- [X] T009 Implementar validación binaria previa a IA: lectura acotada a 5 MiB, firma real PDF/JPEG/PNG, PDF con texto extraíble y máximo 5 páginas, nombre saneado y errores recuperables en `backend/app/services/certificate_extraction.py`.
- [X] T010 Implementar consulta y persistencia por `user_id` en `backend/app/services/profile_certificate_repository.py`: archivo una vez por perfil, hash SHA-256, `(user_id, request_id)`, limpieza si falla metadata, estado `pending_review|ready`, descarga propia y operación serializada por usuario para evitar duplicados concurrentes.
- [X] T011 Implementar validación de extracción, revisión de datos inciertos, deduplicación de biblioteca, límite de 50 y transición `pending_review → ready` en `backend/app/services/profile_certificate_service.py`; no sobrescribir valores existentes no vacíos ni inventar emisor, fecha o nivel.
- [X] T012 Implementar comparación y fusión reutilizable de certificaciones/idiomas de perfil con `StructuredCv` sin borrar datos base y con reporte de añadidos/duplicados en `backend/app/services/certificate_merge.py`.
- [X] T013 Implementar `GET/POST/PATCH/GET file` de `/api/profile/certificates` con Bearer Supabase, body binario y `Idempotency-Key` UUID para carga, errores `{detail:{code,message}}` y 404 uniforme para recurso ajeno/inexistente en `backend/app/api/profile_certificates.py`.
- [X] T014 Registrar el router de certificados sin modificar el flujo de autenticación de `frontend/app/auth/actions.ts` en `backend/app/main.py`.
- [X] T015 Ejecutar y ajustar las pruebas de T004–T006, incluido acceso cruzado entre cuentas y concurrencia, hasta pasar en `tests/contract/test_profile_certificates_api.py`, `tests/integration/test_user_certificates.py` y `tests/unit/test_certificate_merge.py`.

---

## Phase 3: User Story 1 - Certificados al generar un CV (Priority: P1) 🎯 MVP

**Goal**: Subir certificados al perfil o elegir los existentes, incorporar solo los elegidos al CV generado y poder reutilizarlos en otro CV.

**Independent Test**: Subir un PDF legible, crear un CV con ese certificado, iniciar otro CV y verificar que los certificados previos aparecen desmarcados; «Seleccionar todos» los marca y la vista previa/PDF refleja solo los elegidos, sin duplicados.

### Tests for User Story 1

- [X] T016 [P] [US1] Escribir pruebas de contrato para `/api/generate-cv` con `selectedCertificateIds` `[]` por defecto, máximo 50 IDs propios `ready`, rechazo 422 de IDs ajenos/pendientes, fusión con texto, reporte y conflicto 409 por reusar clave con payload distinto en `tests/contract/test_generate_cv.py`.
- [X] T017 [P] [US1] Escribir pruebas de UI para certificados inicialmente desmarcados, nuevo `ready` marcado, selección individual, «Seleccionar todos» sobre toda la biblioteca paginada y retiro antes de generar, además de una prueba de PDF con certificaciones elegidas una sola vez en ATS/visual, en `frontend/tests/certificate-selector.test.tsx` y `frontend/tests/cv-pdf-document.test.tsx`.
- [X] T018 [P] [US1] Escribir pruebas de integración de snapshot, idempotencia, deduplicación e idiomas acreditados, y el recorrido completo de generación con certificados, en `tests/integration/test_generate_cv.py` y `tests/e2e/generate-certificates.spec.ts`.

### Implementation for User Story 1

- [X] T019 [US1] Extender `GenerateCvRequest/Response` con `selectedCertificateIds` y `certificateMergeReport`, conservando el CV plano validado y las solicitudes antiguas sin IDs, en `backend/app/models/generate_cv.py`.
- [X] T020 [US1] Guardar y recuperar `request_fingerprint` y `certificate_merge_report` junto al snapshot; misma clave y payload devuelve el registro original, payload distinto devuelve conflicto, en `backend/app/services/resume_repository.py`.
- [X] T021 [US1] Resolver certificados `ready` por `user_id`, fusionarlos después de validar la IA y antes de persistir, y no volver a aplicar el perfil al reintentar un CV guardado en `backend/app/services/cv_generation.py`.
- [X] T022 [US1] Mapear ID inválido/ajeno/pendiente a 422 e idempotencia conflictiva a 409 sin filtrar datos ajenos en `backend/app/api/generate_cv.py`.
- [X] T023 [P] [US1] Añadir tipos de certificado/reporte y cliente autenticado de lista paginada, carga binaria, revisión y descarga en `frontend/app/types/profile-certificate.ts` y `frontend/app/lib/profile-certificate-client.ts`.
- [X] T024 [US1] Crear selector accesible con estados de carga/error/revisión, `data-testid` para controles probados, selección individual y «Seleccionar todos» que abarque los 50 posibles registros en `frontend/app/components/certificate-selector.tsx`.
- [X] T025 [US1] Enviar IDs seleccionados y exponer el reporte sin pasar bytes ni `photoUrl` en `frontend/app/lib/generate-cv-client.ts`.
- [X] T026 [US1] Integrar selector, carga de hasta 10 archivos con claves propias, nuevos certificados marcados, selección previa visible y reporte posterior en `frontend/app/generate/page.tsx`.
- [X] T027 [US1] Ejecutar las pruebas de PDF escritas en T017 y ajustar la presentación de datos de certificación solo si fallan, en `frontend/tests/cv-pdf-document.test.tsx` y `frontend/app/templates/pdf/shared.tsx`.
- [X] T028 [US1] Ejecutar pruebas de US1 y su recorrido de navegador con `data-testid` en `tests/e2e/generate-certificates.spec.ts`; corregir fallos y confirmar que US1 funciona sin editar un CV existente.

---

## Phase 4: User Story 2 - Certificados en un CV existente (Priority: P1)

**Goal**: Desde «Editar CV», seleccionar certificados propios o subir nuevos y guardar una versión derivada, conservando la original.

**Independent Test**: Abrir un CV histórico, seleccionar una credencial ausente y guardar nueva versión; repetir con una credencial ya presente y comprobar que no se duplica ni se crea versión sin cambios.

### Tests for User Story 2

- [X] T029 [P] [US2] Escribir pruebas de contrato para `POST /api/resumes/{id}/versions` y `POST /api/cv-imports/{id}/versions`: IDs propios, base propia, reporte, `parent_resume_id`, idempotencia, `409 no_changes` y original intacta en `tests/contract/test_resume_edits_api.py` y `tests/contract/test_cv_import.py`.
- [X] T030 [P] [US2] Escribir pruebas de UI y recorrido de navegador para biblioteca desmarcada, nuevo certificado marcado, duplicado informado, revisión antes de guardar y propuesta conservada ante error en `frontend/tests/cv-import-editor.test.tsx` y `tests/e2e/resume-edit.spec.ts`.

### Implementation for User Story 2

- [X] T031 [US2] Ampliar `ResumeVersionRequest`, `SaveVersionRequest` y `ResumeVersion` con `selectedCertificateIds` opcional (máximo 50) y reporte en `backend/app/models/cv_import.py`.
- [X] T032 [US2] Incorporar selección validada por usuario y fusión determinista en `CvImportService.save_resume_version` y `save_version`; rechazar `no_changes` y preservar la versión base en `backend/app/services/cv_import.py`.
- [X] T033 [US2] Persistir reporte y huella de payload en cada versión y validar reintentos de `Idempotency-Key` en `backend/app/services/cv_import_repository.py`.
- [X] T034 [US2] Devolver reportes y mapear selección inválida/ajena a 422, `no_changes` a 409 y conflicto de clave a 409 en `backend/app/api/cv_imports.py`.
- [X] T035 [US2] Enviar `selectedCertificateIds` en ambos clientes de versiones, preservando el `StructuredCv` existente y sin enviar archivos originales en `frontend/app/lib/cv-import-client.ts`.
- [X] T036 [US2] Montar el selector compartido en `frontend/app/components/cv-import-editor.tsx` para historial y PDF importado; mantener certificaciones de la base, mostrar nuevos/duplicados/pendientes y crear la nueva versión solo cuando haya cambios.
- [X] T037 [US2] Ejecutar pruebas de US2 y recorrido de navegador en `tests/e2e/resume-edit.spec.ts`; confirmar que agregar certificados funciona sin usar el control de foto.

---

## Phase 5: User Story 3 - Foto editable por versión (Priority: P1)

**Goal**: Agregar foto cuando falte; mostrar, reemplazar o quitar la existente; conservar fotos y CVs anteriores.

**Independent Test**: Editar un CV sin foto, guardar uno con foto y comprobar plantilla visual/PDF; editar uno con foto para reemplazarla o quitarla y verificar que la versión anterior todavía la muestra.

### Tests for User Story 3

- [ ] T038 [P] [US3] Escribir pruebas de contrato para rechazo de `photoPath` ajeno/inexistente, aceptación de `{user_id}/{uuid}.{jpg|jpeg|png|webp}` y `null`, preservación de original y política de Storage que impide borrar foto referenciada en `tests/contract/test_resume_edits_api.py` y `tests/integration/test_profile.py`.
- [X] T039 [P] [US3] Escribir pruebas de UI y navegador de foto actual, agregar/reemplazar/quitar, URL firmada efímera, fallo de carga que conserva estado, aviso ATS y foto en PDF en `frontend/tests/cv-import-editor.test.tsx`, `frontend/tests/cv-pdf-document.test.tsx`, `tests/e2e/resume-edit.spec.ts` y `tests/e2e/profile-photo.spec.ts`.

### Implementation for User Story 3

- [X] T040 [US3] Validar en backend propiedad, formato y existencia de `photoPath` nuevo o cambiado antes de guardar una versión, sin exponer URLs firmadas, en `backend/app/services/cv_photo.py` y `backend/app/services/cv_import.py`.
- [X] T041 [US3] Reutilizar carga JPEG/PNG/WebP de hasta 5 MiB con ruta UUID nueva e inmutable, y eliminar intentos de borrado inmediato de foto anterior al editar el perfil en `frontend/app/lib/profile-photo-client.ts` y `frontend/app/components/basic-profile-modal.tsx`.
- [X] T042 [US3] Añadir en `frontend/app/components/cv-import-editor.tsx` vista de foto actual mediante URL firmada, botones agregar/reemplazar/quitar, estado de error y aviso ATS; mantener `photoUrl` fuera del `data` enviado y refrescar `CvPreview` para cada propuesta.
- [X] T043 [US3] Ejecutar las pruebas de PDF escritas en T039 y ajustar, si fallan, la resolución de foto histórica: ATS omite foto y las plantillas visuales la conservan, en `frontend/tests/cv-pdf-document.test.tsx` y `frontend/app/lib/cv-pdf.tsx`.
- [X] T044 [US3] Ejecutar pruebas de US3 y recorrido de navegador de versiones con foto en `tests/e2e/resume-edit.spec.ts` y `tests/e2e/profile-photo.spec.ts`; comprobar imagen en vista previa/PDF y original intacta.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validación final de límites, seguridad y documentación sin ampliar el alcance.

- [X] T045 [P] Revisar que prompts, errores y logs no incluyan contenido de certificados, URLs firmadas ni secretos, y que todos los controles de prueba tengan `data-testid`, en `backend/app/services/azure_openai.py`, `backend/app/api/profile_certificates.py`, `frontend/app/components/certificate-selector.tsx` y `frontend/app/components/cv-import-editor.tsx`.
- [ ] T046 Ejecutar los recorridos de [quickstart.md](./quickstart.md) y las suites focalizadas de pytest, Vitest y Playwright; registrar resultados y limitaciones reales en `specs/016-upload-certificates-cv-photo/validation-results.md`.
- [X] T047 Actualizar la documentación de flujo de IA, estructura de certificaciones, límites de archivos y conservación de fotos en `README.md`.

---

## Dependencies & Execution Order

```text
T001–T003 (setup)
       ↓
T004–T015 (biblioteca, extracción, fusión y autorización)
       ├── US1: T016–T028 (generación, MVP)
       ├── US2: T029–T037 (edición de certificados)
       └── US3: T038–T044 (foto por versión)
                    ↓
             T045–T047 (cierre)
```

- US1, US2 y US3 son verificables por separado tras la base común. US2 y US3 modifican `cv_import.py` y `cv-import-editor.tsx`: integrar esos cambios en secuencia o coordinar los mismos archivos, aunque sus pruebas y demás módulos sean independientes.
- Escribir y ejecutar primero las pruebas de cada fase; implementar modelos, servicios, rutas y UI en ese orden. T001 exige una comprobación real de visión antes de declarar completo el soporte JPEG/PNG.
- No se crean tareas para modificar `frontend/app/auth/actions.ts`: se reutiliza Supabase Auth y su manejo actual de errores.

## Parallel Examples

- **Base**: T004, T005 y T006 son pruebas en archivos distintos; T008 puede avanzar en el proveedor mientras se definen los modelos de T007, siempre que no se cierre T011 antes de ambos.
- **US1**: T016, T017 y T018 cubren contrato, interfaz e integración en archivos distintos; T023 puede prepararse junto al servicio de T021 después de fijar el contrato.
- **US2**: T029 y T030 pueden escribirse a la vez; T031–T034 forman la secuencia backend antes de T035–T036.
- **US3**: T038 y T039 son pruebas independientes; T040 y T041 afectan backend y frontend distintos antes de integrarse en T042.

## Implementation Strategy

1. Completar setup/base y entregar US1 como primer incremento utilizable: biblioteca de perfil y CV nuevo con selección explícita.
2. Añadir US2 sobre los endpoints de versiones existentes; verificar que los CVs previos no cambian.
3. Añadir US3 sobre el editor existente y preservar los objetos de foto referenciados.
4. Completar el cierre transversal. No instalar dependencias sin consultar al usuario; no añadir proveedores externos ni flujos de matching.
