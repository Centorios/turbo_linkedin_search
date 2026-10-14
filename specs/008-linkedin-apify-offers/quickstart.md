# Quickstart de validación (008)

## Prerrequisitos
- Migración `008` aplicada en Supabase.
- Variables de backend (ver `backend/.env.example`): `APIFY_TOKEN`, `APIFY_LINKEDIN_ACTOR_ID`, y las existentes de Jooble/Azure.

## Pruebas automáticas (sin costo, proveedores simulados)
1. `pytest tests/contract tests/integration` cubre inicio asíncrono, polling idempotente, timeout 180 s, reintento manual, fallo parcial, deduplicación entre fuentes y aislamiento por usuario.
2. `npm test` en `frontend` cubre estados de UI: en curso, completa, incompleta, descripción parcial, reintento y recálculo.

## Validación manual (con costo ≈ US$0,03, requiere aprobación)
1. Iniciar sesión, elegir un CV, seleccionar Jooble + LinkedIn y buscar.
2. Verificar resultados de Jooble inmediatos y LinkedIn "obteniendo" sin bloquear la app.
3. Al terminar, ver ≤20 ofertas de LinkedIn con enlace original; ejecutar Match y comprobar que incluye ambas fuentes.
4. Simular token inválido: Jooble se conserva y se muestra "búsqueda incompleta".
