# Validation

Con dependencias instaladas y variables habituales, backend: `$env:PYTHONPATH='backend;.'; .venv/Scripts/python.exe -m pytest -q`. Frontend: `npx tsc --noEmit`, `npm test`, `npm run build`.
Con Chrome existente: `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'; npm run test:e2e -- resume-history --project=chromium --workers=1`.
Escenarios sintéticos: lista ordenada, más páginas, abrir snapshot, cambiar plantilla/PDF, vacío, error/reintento y acceso sin sesión. Integración: generar y recuperar con dos cuentas, bearer inválido, ID ajeno, perfil modificado, parámetros límite y errores seguros.
No requiere nuevas dependencias ni migración: tabla `resumes` de 001_create_resumes.sql ya instalada. Validación con proveedores fake no reemplaza prueba de credenciales reales de Supabase/Azure.
