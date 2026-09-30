# Validation

Desde `frontend/`, con dependencias existentes: `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run test:e2e -- visual-refresh profile-cv download-pdf --project=chromium`.
Playwright usa servidor Next local. Pruebas visuales usan sesión sintética, sin credenciales reales.
Revisar acceso y generador a 375/768/1440 px, tabs, errores y foco por teclado; generar, cambiar ATS/visual y descargar. La vista previa debe seguir blanca.
