# Data Model: Acceso social

No se crean tablas, migraciones ni entidades persistidas por la aplicación.

## Usuario e identidad

Supabase conserva el usuario (`id`, email) y sus identidades externas Google/Azure.
El `user.id` sigue siendo la clave de autorización de perfiles y CVs.
La asociación de emails verificados pertenece a Supabase, sin reglas nuevas locales.

## Sesión

La sesión existente contiene usuario, access token, refresh token y expiración.
El callback establece las cookies usando `@supabase/ssr`; SessionProvider restaura
esa sesión al abrir el generador y conserva el onboarding existente.
No se guardan tokens externos en tablas ni se solicitan permisos para usarlos.

## Estado transitorio de interfaz

- Proveedor: unión literal `google | azure`.
- Inicio: inactivo -> pendiente -> navegación externa o error.
- Correo/contraseña y proveedor comparten bloqueo de operaciones concurrentes.
- Retorno: sin código/error -> login con mensaje; código válido -> sesión y generador;
  intercambio fallido o sesión ausente -> login con mensaje.
- Un código inválido o reutilizado nunca produce redirección al generador.

## Validaciones

- El proveedor solo se acepta desde la unión tipada interna.
- El redirect inicial usa el origen del navegador y `/auth/callback`.
- El callback solo acepta código no vacío sin error de proveedor.
- El éxito exige respuesta sin error y sesión no nula.
- Parámetros de destino y mensajes externos se ignoran.
