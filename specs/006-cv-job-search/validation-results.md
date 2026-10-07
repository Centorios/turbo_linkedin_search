# Validación: Búsqueda de empleos desde un CV

**Fecha:** 2026-10-07

## Alcance comprobado

- `tests/contract/test_jobs_api.py`: 11 pruebas aprobadas. Cubren autorización por dueño, sugerencias desde CV validado, parámetros, deduplicación, enlaces seguros, errores de proveedor y contrato HTTP simulado con caché.
- `frontend/tests/jobs.test.tsx`: 5 pruebas aprobadas. Cubren búsqueda bajo acción explícita, estados vacío y error, cambio de cuenta y CV con solicitud pendiente, y reintento de sugerencias.
- Suite frontend completa: 44 pruebas aprobadas.
- `npx tsc --noEmit`: aprobado.
- `git diff --check`: aprobado.
- `npm run build`: compilación de Next.js aprobada. Se detuvo antes de completar el build porque Next.js intentó instalar automáticamente paquetes TypeScript. No se modificaron los manifiestos de dependencias.

## Suite backend ampliada

`pytest tests/contract tests/integration -q`: 100 aprobadas y 3 fallidas en pruebas existentes fuera de esta feature:

1. `test_profile_api.py::test_put_profile_saves_for_authenticated_user_and_get_returns_it`: el perfil devuelve `photoPath: null` adicional.
2. `test_competency_development.py::test_competency_without_evidence_from_user_is_rejected`: el servicio no lanza la excepción esperada.
3. `test_profile.py::test_profile_read_and_write_are_scoped_to_authenticated_user`: el perfil devuelve `photoPath: null` adicional.

Esta entrega no modifica los módulos de perfil o asistencia implicados en esas fallas. Las pruebas específicas de empleo pasan.

## Verificación pendiente del entorno

La consulta real a Jooble requiere configurar `JOOBLE_AR_API_KEY` en el backend. No había clave regional en este entorno; el conector se verificó con transporte HTTP simulado, sin consumir cuota. Tras configurar la clave, seguir `quickstart.md` para una comprobación manual con una oferta real.
