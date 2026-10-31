# Quickstart de validación: certificados y foto

## Preparación

1. Usar el entorno local ya configurado para frontend, backend, Supabase y Azure OpenAI. Aplicar `backend/supabase/migrations/010_user_certificates.sql` en el entorno de prueba cuando esté implementada; comprobar RLS y buckets privados.
2. Verificar que `AZURE_OPENAI_DEPLOYMENT` acepta una imagen JPEG/PNG como entrada y devuelve JSON. [Microsoft documenta el formato de imagen para chat con visión](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/gpt-v-quickstart). El 2026-10-31 se probó el despliegue configurado con un PNG válido del repositorio: respondió HTTP 200 con contenido JSON. No se instala un proveedor nuevo.
3. Crear dos cuentas de prueba. Preparar un certificado PDF con texto, una imagen legible del mismo certificado, otro certificado distinto, un PDF sin texto, una foto JPEG válida y un archivo con tipo incorrecto. No usar documentos reales de personas en pruebas compartidas.

## Comprobación manual

1. Con la cuenta A, abrir generación. Subir el primer certificado. Debe figurar en el perfil, poder consultarse su archivo y quedar seleccionado para el CV actual.
2. Iniciar otro CV. Los certificados del perfil deben aparecer desmarcados. Pulsar «Seleccionar todos» y después desmarcar uno; generar el CV. Verificar que el PDF contiene solo los elegidos y que no se duplica un certificado ya mencionado en la biografía.
3. Subir otra vez el mismo PDF y luego la imagen del mismo certificado. Debe reutilizarse una credencial del perfil, sin crear otra fila ni otra entrada en el CV. Subir el certificado distinto y verificar que sí aparece como nuevo.
4. Subir PDF sin texto, archivo incorrecto y archivo demasiado grande. Deben mostrarse mensajes claros, sin agregar certificados al CV ni dejar archivos públicos. Para una lectura incierta, corregir/confirmar datos antes de que el certificado quede seleccionable.
5. Abrir un CV guardado desde Historial → «Editar CV». Seleccionar un certificado propio ausente, agregar foto a un CV que no la tiene, revisar y guardar. Debe aparecer una versión nueva y la original debe conservar certificaciones y estado de foto.
6. En otra versión con foto, reemplazarla y luego quitarla en una edición posterior. Verificar que cada versión previa conserva su imagen. Con ATS se informa que la foto no aparece; con plantilla visual la vista previa y la descarga coinciden.
7. Con la cuenta B, intentar acceder al ID o al archivo de certificado de A, usar su ID al generar un CV y guardar una ruta de foto de A. Todas las operaciones deben ser rechazadas sin mostrar datos privados.
8. Reintentar una generación y un guardado con la misma clave idempotente. Debe obtenerse el mismo CV/reporte; cambiar el payload con esa clave debe producir conflicto.

## Pruebas automatizadas previstas

Con servicios de prueba disponibles y dependencias ya instaladas:

```powershell
python -m pytest tests/contract tests/integration
```

```powershell
Set-Location frontend
npm test
```

```powershell
Set-Location frontend
npm run test:e2e -- --grep "certificados|foto.*CV"
```

El proyecto guarda pytest en `tests/` de la raíz: ejecutar allí los archivos nuevos junto a `test_generate_cv.py`, `test_cv_import.py` y `test_resume_edits_api.py`. Las pruebas deben cubrir los contratos de [certificates-api.md](./contracts/certificates-api.md) y [cv-integration.md](./contracts/cv-integration.md), el modelo de [data-model.md](./data-model.md), las políticas de Storage y el PDF real en navegador. No se requiere instalar dependencias para ejecutar este plan; si faltan en el entorno, solicitar autorización antes de instalarlas.

## Resultado esperado

Cada certificado se conserva una vez por perfil; la selección explícita determina qué credenciales aparecen en el CV nuevo. Las versiones antiguas no cambian al editar certificados o fotos. Ningún archivo ni dato de otra cuenta resulta accesible. La vista previa y el PDF exportado contienen los mismos datos en las plantillas aplicables.
