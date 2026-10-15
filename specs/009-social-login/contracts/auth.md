# Contratos de autenticación social

## Acción cliente

`signInWithProvider(provider: "google" | "azure"): Promise<AuthActionResult>`

- Reutiliza `createSupabaseBrowserClient`.
- Llama `auth.signInWithOAuth` con proveedor, redirectTo
  `${window.location.origin}/auth/callback` y `scopes: "email"` solo para Azure.
- Delega la navegación al SDK. Un resultado sin URL se trata como fallo.
- Retorna `{ error: null }` al iniciar navegación, o un mensaje seguro en español.
- No acepta secretos ni destinos proporcionados por el usuario.

## UI `/auth`

- Botones `auth-google` ("Continuar con Google") y `auth-microsoft`
  ("Continuar con Microsoft") disponibles en ambos modos.
- Durante envío por contraseña o proveedor, ambos botones y las acciones de
  envío/cambio de modo quedan deshabilitados.
- Mensajes de falla usan `role="alert"` y `data-testid="auth-error"`.
- `reason=oauth-error` muestra un mensaje fijo; nunca renderiza detalles externos.
- Los formularios y destinos existentes por contraseña permanecen iguales.

## GET `/auth/callback`

Entrada: query `code` emitido por Supabase y cookies PKCE del mismo navegador.
También puede llegar `error`/`error_description` del proveedor.

- Error declarado o falta de código: 307 a `/auth?reason=oauth-error`.
- Código: `createServerClient` con URL/anon key públicas y adaptador `getAll/setAll`.
- Intercambio exitoso con sesión: 307 a `/generate` con cookies actualizadas.
- Error, excepción o ausencia de sesión: 307 a `/auth?reason=oauth-error`.
- Todas las respuestas llevan `Cache-Control: no-store` y `Referrer-Policy: no-referrer`.
- Ignorar `next`, destinos externos y mensajes arbitrarios.
- Sin cambios en endpoints FastAPI, permisos o formato del bearer.

## Configuración

Credenciales OAuth privadas solo en Supabase Auth Providers. Registrar
`https://<project-ref>.supabase.co/auth/v1/callback` en Google/Entra y
`<origen-app>/auth/callback` en la lista de redirect URLs de Supabase.
