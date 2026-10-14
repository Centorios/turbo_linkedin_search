# Validación: Eliminar CVs del historial de la cuenta

**Fecha:** 2026-10-14

## Resultados

- `pytest tests/integration/test_resume_history.py tests/integration/test_match_persistence.py::test_match_result_migrations_cascade_when_resume_is_deleted -q`: **20 aprobadas**. Incluye borrado 204, desaparición de lista/detalle, propietario e ID, 401 sin sesión, 404 equivalente para ajeno/inexistente, error seguro y la verificación de cascadas existentes.
- `vitest run tests/resume-history.test.tsx`: **14 aprobadas**. Incluye confirmación/cancelación, cierre de vista previa, conservación de otros CVs, paginación, cambio de cuenta durante borrado, fallo/reintento y prevención de clics concurrentes.
- `tsc --noEmit`: aprobado.
- `git diff --check`: aprobado.
- Los tests backend/UI nuevos fallaron primero por ausencia de la función de borrado y luego pasaron tras su implementación.

## Observaciones

- pytest muestra una advertencia deprecada de Starlette al usar `httpx` con `TestClient`; no afecta el resultado.
- Vitest muestra la advertencia deprecada de la API CJS de Vite; la suite pasa.
- La persistencia se validó con el cliente de prueba existente y con la prueba de integridad de migraciones. No se ejecutó una eliminación manual contra un proyecto Supabase real.
- No se agregaron dependencias ni migraciones: la eliminación usa las relaciones `ON DELETE CASCADE` existentes.
