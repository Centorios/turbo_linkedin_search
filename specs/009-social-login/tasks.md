# Tasks: Acceso con Google y Microsoft

**Input**: Documentos en `specs/009-social-login/`.
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/auth.md.
**Tests**: Requeridos por los criterios de éxito y la constitución para cambios de autenticación.
**Organization**: Historias independientes sobre un callback compartido.

## Phase 1: Setup

- [x] T001 Verificar SDK PKCE existente y reglas de pruebas en frontend/app/lib/supabase.ts y .github/instructions/playwright-tests.instructions.md, sin instalar dependencias.

## Phase 2: Foundational

- [x] T002 [P] Crear pruebas del callback (cookies, éxito, error, sesión ausente, código faltante/reutilizado, destinos fijos y headers) en frontend/tests/auth-callback.test.ts y frontend/tests/auth-callback-integration.test.ts.
- [x] T003 Implementar GET con intercambio PKCE, cookies getAll/setAll, éxito solo con sesión, destinos internos fijos y no-store/no-referrer en frontend/app/auth/callback/route.ts.

## Phase 3: US1 - Google (Priority: P1)

**Goal**: Iniciar Google y entrar por el callback compartido.
**Independent Test**: Un clic usa `google`, retorna al generador y conserva la sesión.

- [x] T004 [US1] Escribir pruebas de acción Google y regresión correo/contraseña en frontend/tests/auth-actions.test.ts.
- [x] T005 [US1] Añadir acción tipada de proveedor con redirect al origen actual, rechazo de resultado sin URL y mensajes seguros en frontend/app/auth/actions.ts.
- [x] T006 [US1] Escribir pruebas de botón Google en acceso/registro y navegación por contraseña en frontend/tests/auth-page.test.tsx.
- [x] T007 [US1] Integrar botón Google sin alterar campos ni destinos de contraseña en frontend/app/auth/page.tsx.

## Phase 4: US2 - Microsoft (Priority: P1)

**Goal**: Ofrecer Microsoft con permisos mínimos.
**Independent Test**: Un clic usa `azure` y scope `email`, sin depender de una cuenta Google.

- [x] T008 [US2] Añadir casos Microsoft con `azure` y `scopes: "email"` en frontend/tests/auth-actions.test.ts y frontend/tests/auth-page.test.tsx.
- [x] T009 [US2] Completar acción y botón Microsoft en frontend/app/auth/actions.ts y frontend/app/auth/page.tsx.

## Phase 5: US3 - Errores y compatibilidad (Priority: P2)

**Goal**: Recuperar acceso tras fallas y mantener el ciclo de sesión existente.
**Independent Test**: Inicio fallido, cancelación y retorno inválido muestran error seguro y permiten reintentar; las operaciones pendientes bloquean acciones concurrentes.

- [x] T010 [US3] Cubrir y completar bloqueo compartido y mensajes de retorno sin reflejar datos externos en frontend/tests/auth-page.test.tsx y frontend/app/auth/page.tsx.
- [x] T011 [P] [US3] Probar restauración, onboarding y cierre de sesión con identidades Google/Azure en frontend/tests/session-provider.test.tsx, reutilizando frontend/app/auth/session-provider.tsx.
- [x] T012 [US3] Explorar con snapshot antes de selectores y crear/ejecutar casos de ambos proveedores y errores con transporte simulado en tests/e2e/social-login.spec.ts.

## Phase 6: Polish & Cross-Cutting

- [x] T013 [P] Documentar habilitación Google/Entra, scopes mínimos, xms_edov, URLs locales/producción, secretos y prueba real pendiente en docs/desarrollo.md y enlazar desde README.md.
- [x] T014 Ejecutar tests relevantes, typecheck, E2E y build de frontend/package.json; registrar resultados y límites externos en specs/009-social-login/quickstart.md y completar specs/009-social-login/tasks.md.

## Dependencies & Execution Order

- T001 -> T002 -> T003.
- US1: T003 -> T004 -> T005 -> T006 -> T007.
- US2: T007 -> T008 -> T009; depende solo de la estructura compartida, no de credenciales Google.
- US3: T009 -> T010; T011 puede ejecutarse tras T003; T012 después de T010/T011.
- T013 es independiente de implementación tras T001; T014 depende de T001-T013.

## Parallel Execution Examples

- US1: Pruebas de acciones y callback se pueden ejecutar juntas tras implementarlos.
- US2: Validar contrato Azure y callback compartido en una misma ejecución de Vitest.
- US3: T011 y T013 usan archivos distintos y no dependen de T010.
- Ejecución local secuencial para no introducir colisiones al modificar acciones/UI compartidas.

## Implementation Strategy

Primero callback seguro y tests rojos, luego Google como incremento mínimo, Microsoft
sobre la misma integración y finalmente errores/ciclo de sesión. La entrega solicitada
incluye ambas historias P1, no solo el incremento mínimo. No se considerará probado
el consentimiento real sin la configuración y autorización externas.
