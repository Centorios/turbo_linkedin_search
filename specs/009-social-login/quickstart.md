# Quickstart: Validar acceso con Google y Microsoft

## Prerrequisitos

- Dependencias existentes instaladas; sin paquetes nuevos.
- Configuración pública Supabase en `frontend/.env.local`.
- Para consentimiento real: proveedores habilitados según
  [guía de desarrollo](../../docs/desarrollo.md#autenticación-con-google-y-microsoft).

## Validación automatizada (desde la raíz)

```powershell
Set-Location frontend
npm test -- tests/auth-actions.test.ts tests/auth-page.test.tsx tests/auth-callback.test.ts tests/auth-callback-integration.test.ts tests/session-provider.test.tsx
npx tsc --noEmit
npm run test:e2e -- --project=chromium social-login.spec.ts
npm run build
```

Los tests usan transportes/clientes simulados y no requieren credenciales OAuth.
Los contratos esperados están en [contracts/auth.md](contracts/auth.md).
Las pruebas E2E observan la UI antes de construir selectores.

## Validación real previa a desplegar

1. Abrir `/auth`; comprobar ambos botones y acceso por contraseña.
2. Google: autorizar con una cuenta de prueba; verificar `/generate`, onboarding
   si falta perfil, recarga y cierre de sesión.
3. Microsoft: repetir con cuenta personal y organizacional permitida.
4. Cancelar el consentimiento de ambos; verificar mensaje seguro y reintento.
5. Usar una cuenta con CV guardado; comprobar que conserva su historial.
6. Entrar con otra cuenta y comprobar que no ve CVs ajenos.
7. Repetir desde el dominio de producción autorizado y comprobar cookies.

Estas pruebas reales no se sustituyen por mocks: necesitan configuración del
administrador y consentimiento interactivo. Registrar su resultado antes del release.

## Evidencia de ejecución (2026-10-14)

- Checklist de especificación: 16/16 completo.
- Análisis cruzado: 13/13 requisitos y criterios cubiertos por tareas; sin bloqueos constitucionales.
- Vitest: 34/34 pruebas, incluidos SDK Supabase real con transporte HTTP simulado,
  acciones, callback, UI y restauración/cierre de sesión Google/Azure.
- `npx tsc --noEmit`: exitoso.
- E2E: 7/7 usando Chrome instalado con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
  El Chromium propio de Playwright no estaba instalado; no se instalaron paquetes.
  Se usó filtro de archivo para no ejecutar suites ajenas que requieren credenciales.
- Exploración real en `http://localhost:5173/auth`: snapshots de acceso, registro,
  navegación interceptada de ambos proveedores y errores observados antes de selectores.
- `npm run build`: exitoso, incluye Route Handler dinámico `/auth/callback`.
- `git diff --check`: sin errores.
- Consentimiento real Google/Microsoft: pendiente de habilitación administrativa y
  cuentas autorizadas; no se afirma que los proveedores estén configurados.
