# Quickstart: Captura de perfil básico

## Prerrequisitos

- Python 3.11+, entorno virtual y dependencias instaladas según [docs/desarrollo.md](../../docs/desarrollo.md).
- Node.js LTS y dependencias del frontend instaladas.
- Proyecto Supabase de desarrollo con Auth y PostgreSQL configurados; aplicar la migración `backend/supabase/migrations/002_create_basic_profiles.sql` antes de probar persistencia.
- Variables de backend configuradas localmente y solo en backend; frontend con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_BACKEND_URL`.
- Para Playwright, una cuenta Supabase confirmada y valores E2E configurados en la misma terminal como indica la guía de desarrollo. No registrar esos valores en el repositorio.

## Arranque local

Backend, en una terminal PowerShell:

```powershell
Set-Location backend
$env:PYTHONPATH="."
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend, en otra terminal:

```powershell
Set-Location frontend
npm run dev -- --hostname 127.0.0.1
```

Abrir `http://localhost:3000/auth`.

## Validación automatizada

Desde la raíz del repositorio:

```powershell
$env:PYTHONPATH="backend;."
.venv\Scripts\python.exe -m pytest tests/contract/test_profile.py tests/contract/test_profile_api.py tests/integration/test_profile.py tests/integration/test_generate_cv.py -q
```

Desde `frontend/`:

```powershell
npm test -- --run
npx playwright test --reporter=list
```

Las pruebas de navegador deben usar los roles, etiquetas y `data-testid` especificados en [profile-api.md](contracts/profile-api.md), y verificar el estado accesible del diálogo y sus mensajes.

Al restaurar una sesión autenticada, la interfaz consulta `GET /api/profile`: una respuesta `null` permite ofrecer el modal; un perfil guardado se reutiliza; un error se muestra como estado recuperable y no como perfil pendiente. Guardar el formulario llama `PUT /api/profile`. Posponer no llama a ninguna operación de escritura.

## Escenarios de aceptación

1. Iniciar sesión con una cuenta sin perfil guardado; confirmar que el modal aparece después de restaurar la sesión y antes de continuar.
2. Guardar nombre y al menos correo, teléfono, ubicación y enlaces válidos; recargar y confirmar que el modal no reaparece y que los valores siguen asociados a esa cuenta.
3. Posponer el modal; confirmar que no se envió un PUT ni se creó una fila y que el flujo de generación continúa. Cerrar e iniciar sesión de nuevo; confirmar que se vuelve a ofrecer mientras falte un nombre guardado.
4. Enviar nombre vacío, correo inválido o enlace sin `http`/`https`; confirmar error accesible por campo, sin persistencia y con los demás valores conservados para corregir.
5. Generar un CV con perfil guardado y texto que omita o contradiga datos personales; confirmar que los campos no vacíos del perfil prevalecen, que los campos vacíos usan el valor extraído y que experiencia, educación, skills, idiomas y certificaciones no cambian.
6. Repetir la generación con el mismo `Idempotency-Key` después de cambiar el perfil; confirmar que se usa el resultado idempotente combinado con el perfil vigente, sin otra llamada al proveedor ni una fila duplicada.
7. Provocar una lectura de perfil fallida; confirmar que se muestra un error recuperable, no se llama al proveedor y no se persiste un CV parcial.
8. Iniciar sesión como usuario A y guardar un perfil; autenticar usuario B y comprobar que GET no devuelve el perfil de A ni puede sobrescribirlo. Verificar también la política RLS con dos usuarios de prueba en la base aislada.

## Resultado esperado

Cada cuenta tiene como máximo un perfil personal guardado. El usuario puede posponer el modal sin bloquear el CV; al guardar, los datos confirmados se reutilizan en `personalInfo`, conservan su titularidad y no alteran las demás secciones del CV.
