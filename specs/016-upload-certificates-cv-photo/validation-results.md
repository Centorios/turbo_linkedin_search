# Validación de certificados del perfil y foto editable

Fecha: 2026-10-31.

## Verificado en el repositorio

- Azure OpenAI configurado aceptó un PNG válido y devolvió JSON (preflight documentado en [quickstart.md](./quickstart.md)).
- `python -m pytest tests/contract tests/integration tests/unit -q`: 240 pruebas aprobadas.
- `npm test`: 323 pruebas aprobadas.
- `tsc --noEmit`: sin errores.
- Playwright Chromium: `generate-certificates.spec.ts` (1 prueba), `resume-edit.spec.ts` (3 pruebas) y `profile-photo.spec.ts` (6 pruebas) aprobadas en una ejecución conjunta. Las rutas de API y Storage en estas pruebas son simuladas.
- `git diff --check`: sin errores de espacios.

## Pendiente de entorno de prueba

La migración [010_user_certificates.sql](../../backend/supabase/migrations/010_user_certificates.sql) quedó preparada en el repositorio, pero no se aplicó a una instancia remota de Supabase durante esta implementación. Por eso no se ejecutaron aún pruebas reales de RLS, bucket privado, concurrencia SQL y protección de fotos referenciadas, ni el recorrido completo con dos cuentas y persistencia real. Las pruebas automatizadas con Playwright validan la interfaz mediante respuestas simuladas; la extracción visual se comprobó con una llamada independiente al despliegue Azure configurado.

Para habilitar la función en un entorno, aplicar la migración numerada después de `009` y recorrer los pasos 1–8 de [quickstart.md](./quickstart.md) con cuentas y archivos de prueba. No se instalaron dependencias.
