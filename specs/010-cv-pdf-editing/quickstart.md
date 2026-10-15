# Quickstart: Validación de edición de CV PDF

## Prerrequisitos

- Entorno local configurado conforme al [README](../../README.md), con credenciales locales para Supabase y Azure OpenAI.
- Migración `009_cv_import_sources.sql` aplicada en la base Supabase de desarrollo.
- Bucket privado `cv-sources` disponible tras aplicar la migración.
- Dependencia `pypdf` incorporada e instalada únicamente después de la aprobación del usuario.
- PDF de prueba con texto seleccionable (menos de 10 MiB y 20 páginas), otro PDF escaneado y otro archivo que no sea PDF. No usar CVs reales con datos personales en pruebas automatizadas.

## Validación de contratos y backend

Desde la raíz del repositorio, con las dependencias backend instaladas:

```powershell
$env:PYTHONPATH = "$PWD\backend;$PWD"
.\backend\.venv\Scripts\python.exe -m pytest tests\contract\test_cv_import.py tests\integration\test_cv_import.py tests\integration\test_cv_import_repository.py -q
```

**Resultado esperado**: pasan los casos de autenticación, firma/MIME, tamaño/páginas, PDF cifrado o escaneado, salida estructurada, aislamiento entre usuarios, propuesta no persistida, confirmación idempotente y preservación del original.

## Validación de interfaz

Desde `frontend`:

```powershell
npm run test -- tests/cv-import-editor.test.tsx
```

**Resultado esperado**: la interfaz muestra los estados de carga/error, las preguntas de aclaración, las secciones propuestas, los cambios pendientes de revisión y la confirmación explícita antes de guardar.

## Validación de extremo a extremo

Iniciar la API desde `backend` y Next.js desde `frontend` según la configuración local del proyecto; iniciar sesión con un usuario de prueba y abrir la página de generación.

Ejecutar desde `frontend`:

```powershell
npm run test:e2e -- ../tests/e2e/cv-import-edit.spec.ts
```

**Escenario esperado**:

1. Cargar el PDF compatible y comprobar que se presenta como CV estructurado.
2. Solicitar un cambio con datos suministrados por el usuario y comprobar que se muestra como propuesta sin afectar el historial.
3. Enviar una instrucción para corregir la propuesta; comprobar que la nueva propuesta parte del borrador y sigue sin afectar el historial.
4. Confirmar la propuesta y comprobar que aparece una versión nueva con vista previa y descarga PDF.
5. Descargar el PDF fuente y verificar que permanece igual al archivo seleccionado.
6. Intentar acceder al origen desde otra cuenta y comprobar que recibe `404` sin revelar metadatos.
7. Cargar un PDF escaneado o inválido y verificar que se explica el problema sin guardar el archivo ni cambiar el CV activo.
8. Eliminar la fuente importada y comprobar que el PDF original y todas sus versiones dejan de estar disponibles.

## Medición de criterios cuantitativos

- Evaluar un corpus de al menos 10 PDFs sintéticos con texto seleccionable; registrar cuántos se convierten en CV revisable y verificar el umbral de 90% de `SC-001`.
- Medir con reloj monotónico la importación y la propuesta de edición en pruebas automatizadas; verificar que al menos el 90% termina en menos de 60 segundos para entradas dentro de límites (`SC-002`).
- Realizar 10 sesiones de prueba con usuarios nuevos; registrar tareas completadas sin ayuda y verificar que al menos 9 completan el flujo de carga, edición y revisión (`SC-005`).
- En cada escenario de eliminación, verificar que el objeto, la fuente y todas las versiones derivadas ya no se pueden recuperar (`SC-006`).

## Contratos

Consultar [cv-imports.openapi.yaml](./contracts/cv-imports.openapi.yaml) para rutas, esquemas de solicitud/respuesta y errores.
