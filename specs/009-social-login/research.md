# Research: Acceso social

## Decision: Reutilizar Supabase Auth con PKCE

**Rationale**: `frontend/app/lib/supabase.ts` ya usa `createBrowserClient`.
La implementación instalada de `@supabase/ssr` configura PKCE y almacena el
verificador en cookies. Los JWT resultantes siguen siendo válidos para FastAPI.
**Alternatives considered**: SDKs directos Google/Microsoft o un gestor adicional:
duplican sesión, credenciales y autorización sin aportar valor al alcance.

## Decision: Google como `google`, Microsoft como `azure`

**Rationale**: Son los identificadores de Supabase. Azure requiere `scopes: "email"`
para devolver una identidad utilizable. Google usa los permisos básicos predeterminados.
No se solicita acceso offline ni permisos de servicios externos.
**Alternatives considered**: `microsoft` no es un proveedor Supabase válido;
permisos Graph adicionales son innecesarios.

## Decision: Callback servidor con cookies en la respuesta

**Rationale**: El Route Handler no monta el SessionProvider y evita competir con
la detección automática de código del cliente navegador. `createServerClient`
lee las cookies PKCE e intercambia el código una vez por petición; `setAll`
propaga los cambios a la respuesta de redirección. Éxito siempre a `/generate`;
falla siempre a `/auth?reason=oauth-error`. No se procesa `next`.
**Alternatives considered**: Intercambiar manualmente en una página cliente puede
competir con la inicialización automática de Supabase y con efectos repetidos.

## Decision: Errores locales genéricos y configuración administrativa documentada

**Rationale**: No mostrar ni registrar `error_description`, tokens o códigos externos.
Errores y excepciones se convierten en mensajes explícitos seguros en español.
Microsoft debe habilitar cuentas personales y de organizaciones con tenant `common`
si se requiere ambas, y configurar el claim opcional `xms_edov` para verificar email.
La app no implementa vinculación manual; Supabase conserva su política de identidades.
**Alternatives considered**: Mostrar mensajes crudos del proveedor puede filtrar
información y no garantiza texto comprensible; fusionar usuarios cambia permisos.

## Sources

- [Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google):
  aplicaciones web, redirect URI hacia Supabase, permisos básicos.
- [Supabase Azure](https://supabase.com/docs/guides/auth/social-login/auth-azure):
  proveedor `azure`, scope `email`, tenant `common`, claim `xms_edov`.
- Código instalado `@supabase/ssr/src/createBrowserClient.ts` y
  `createServerClient.ts`: PKCE, cookies y detección automática.

No quedan incertidumbres que impidan implementar. El consentimiento real requiere
habilitación y credenciales administradas fuera del repositorio.
