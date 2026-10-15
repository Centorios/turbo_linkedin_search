# CV8 - Generador de CV con IA

Aplicación para transformar texto profesional en un CV estructurado, validado y exportable a PDF, con una primera búsqueda de empleos desde ese CV.

## Estructura

- `backend/`: FastAPI, validacion, autenticacion y persistencia.
- `frontend/`: Next.js, preview y exportacion PDF en el navegador.
- `tests/`: pruebas contractuales, de integracion y E2E.
- `specs/001-cv-generation-flow/`: especificacion, contratos y tareas.

## Desarrollo local

Requisitos: Python 3.11+, Node.js LTS y un proyecto Supabase configurado.

### Backend

```powershell
Set-Location ..
python -m venv .venv
\.venv\Scripts\Activate.ps1
Set-Location backend
pip install -e ".[test]"
$env:PYTHONPATH="."
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Comprobación: `http://127.0.0.1:8000/health` debe responder `{"status":"ok"}`.

### Frontend

```powershell
Set-Location frontend
npm install
npm run dev -- --hostname 127.0.0.1
```

Abrir `http://localhost:3000/auth`.

> Si ya tenías `frontend/node_modules` de antes, volvé a correr `npm install`: la interfaz
> ahora usa Tailwind CSS (`tailwindcss` + `@tailwindcss/postcss`) y necesita esa dependencia.

### Validacion

```powershell
Set-Location ..
$env:PYTHONPATH="backend;."
.venv\Scripts\python.exe -m pytest -q
Set-Location frontend
npx tsc --noEmit
npm test -- --run
npx playwright install chromium
```

Para las pruebas E2E de autenticación y generación, configura las credenciales de una cuenta
Supabase confirmada en la misma terminal:

```powershell
$env:E2E_EMAIL="cuenta-confirmada@example.com"
$env:E2E_PASSWORD="contraseña-de-prueba"
$env:E2E_SIGNUP_EMAIL="cuenta-nueva@example.com"
$env:E2E_SIGNUP_PASSWORD="otra-contraseña-de-prueba"
npm run test:e2e -- --config=playwright.config.ts --project=chromium
```

Las pruebas E2E usan Chromium únicamente. `E2E_EMAIL` debe ser una cuenta existente y
confirmada; `E2E_SIGNUP_EMAIL` debe ser una cuenta nueva si se prueba el registro.

No se deben copiar secretos reales a los archivos `.env.example` ni al cliente.

## Autenticación con Google y Microsoft

`/auth` ofrece **Continuar con Google** y **Continuar con Microsoft**, tanto
al iniciar sesión como al crear una cuenta. Correo y contraseña siguen disponibles.
El flujo usa Supabase Auth con PKCE; `/auth/callback` intercambia el código y
devuelve las cookies de sesión antes de llevar a `/generate`. Un rechazo, código
inválido o error vuelve al login con un mensaje seguro y permite reintentar.
No hay tablas, migraciones ni dependencias nuevas.

### URLs de retorno

Son dos direcciones distintas; no deben intercambiarse:

| Dónde se configura | URL |
|---|---|
| Google Cloud / Microsoft Entra, redirect URI del proveedor | `https://<project-ref>.supabase.co/auth/v1/callback` (copiar del dashboard Supabase) |
| Supabase Auth > URL Configuration > Redirect URLs | `http://localhost:3000/auth/callback` |
| Supabase Auth > URL Configuration > Redirect URLs, si usas IP | `http://127.0.0.1:3000/auth/callback` |
| Supabase Auth > URL Configuration > Redirect URLs, producción | `https://<dominio-de-la-app>/auth/callback` |

Configurar también **Site URL** con el origen canónico de producción. Si usas
otro puerto local, autorizar su URL exacta (por ejemplo
`http://localhost:5173/auth/callback`). Empezar y terminar en el mismo origen:
el verificador PKCE está en las cookies de ese navegador. No mezclar `localhost`
con `127.0.0.1`. Preferir URLs exactas a comodines amplios en producción.

### Google

1. Crear una aplicación web OAuth en Google Cloud / Google Auth Platform.
2. Configurar audiencia, pantalla de consentimiento y usuarios de prueba si la
   aplicación está en modo Testing. Usar solo `openid`, email y perfil básico.
3. Añadir los orígenes web locales/producción y el redirect URI de **Supabase**
   de la tabla anterior.
4. En Supabase Auth > Providers > Google, habilitar el proveedor y guardar el
   Client ID y Client Secret de esa aplicación.

### Microsoft

1. Registrar una aplicación en Microsoft Entra ID. Para admitir cuentas personales
   y laborales, elegir **Accounts in any organizational directory and personal
   Microsoft accounts**. Las restricciones de cada organización siguen aplicando.
2. Registrar una plataforma **Web** con el redirect URI de **Supabase**.
3. Crear un Client Secret y copiar su **Value**, no su identificador. Registrar
   su expiración para rotarlo antes de que venza.
4. En Supabase Auth > Providers > Azure, habilitar el proveedor y guardar
   Application (client) ID y el secreto. Usar el tenant
   `https://login.microsoftonline.com/common` para ambos tipos de cuentas;
   no limitarlo a un tenant organizacional si se necesitan cuentas personales.
5. Solicitar únicamente permisos de identidad básicos. La aplicación envía
   `scopes: "email"` porque Supabase necesita un correo válido de Microsoft.
   No requiere permisos Mail, Contacts ni Calendar de Microsoft Graph.
6. Configurar el claim opcional **`xms_edov`** según la
   [guía de Supabase para Azure](https://supabase.com/docs/guides/auth/social-login/auth-azure#guarding-against-unverified-email-domains),
   para que Supabase determine si el dominio de email fue verificado. No
   habilitar comportamientos que acepten dominios de correo sin verificar.

Los secretos de Google y Microsoft se guardan **solo en el dashboard de Supabase**;
no crear variables `NEXT_PUBLIC_*` para ellos ni ponerlos en `.env.example`.
La aplicación sigue usando únicamente la URL y anon key públicas existentes.
La asociación de identidades con el mismo email verificado depende de Supabase;
la app no fusiona cuentas ni transfiere CVs. El backend sigue validando el JWT
Supabase y la propiedad de cada recurso, independientemente del proveedor.

### Validación y diagnóstico

Desde `frontend`, ejecutar:

```powershell
npm test -- tests/auth-actions.test.ts tests/auth-page.test.tsx tests/auth-callback.test.ts tests/auth-callback-integration.test.ts tests/session-provider.test.tsx
npm run test:e2e -- --project=chromium social-login.spec.ts
```

Si no está instalado el Chromium de Playwright pero hay un Chrome disponible,
puedes reutilizarlo sin descargar navegadores (ajustar a su ruta real):

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run test:e2e -- --project=chromium social-login.spec.ts
```

Estas pruebas simulan proveedores y no consumen cuentas ni credenciales reales.
Antes del release, completar manualmente Google y Microsoft (personal y laboral
permitida), recargar la sesión, cerrar sesión y comprobar que cada cuenta conserva
solo su perfil/historial. Cancelar también el consentimiento y verificar reintento.

Si vuelve un error, revisar proveedor habilitado, client ID/secreto vigente,
audiencia/cuentas permitidas, email de Microsoft y ambas clases de redirect URI.
Usar los logs administrativos de Supabase sin copiar códigos, tokens ni datos
personales a tickets o archivos compartidos. El consentimiento real requiere
configuración administrativa externa y no queda certificado por pruebas simuladas.

## Historial de CVs

Cada generación exitosa se guarda automáticamente en `resumes`. Desde la cabecera,
**Historial** (`/history`) permite recorrer las versiones de la cuenta, revisar el
contenido original y descargarlo como ATS o visual. Cambiar el perfil actual no
reescribe las versiones antiguas. Los intentos fallidos no aparecen como documentos.

FastAPI expone `GET /api/resumes?offset=0&limit=20` y `GET /api/resumes/{id}`.
Ambos validan el bearer de Supabase y filtran por el dueño, incluso usando el cliente
admin. El detalle ajeno responde igual que uno inexistente. Las lecturas validan el
JSON almacenado sin llamar a Azure. No hace falta una migración adicional si ya está
aplicada `001_create_resumes.sql`.

Las fotos antiguas pueden haber sido eliminadas; en ese caso se mantiene el texto y
la descarga funciona sin foto. La UI descarta solicitudes pendientes al cambiar de
cuenta y los datos no se guardan en almacenamiento del navegador.

Pruebas específicas: `tests/integration/test_resume_history.py`,
`frontend/tests/resume-history.test.tsx` y `tests/e2e/resume-history.spec.ts`.

## Búsqueda de empleos en Argentina

**Empleos** (`/jobs`) muestra los CVs guardados de la cuenta. Al elegir uno, el backend
valida su propiedad y propone un puesto a partir de la experiencia; si falta, usa
habilidades técnicas del CV. El usuario puede corregir los términos y la ubicación
antes de pulsar **Buscar empleos**. Solo entonces se envían esos dos textos a la API
regional de Jooble. El CV completo, el email y el token de sesión no se envían al
proveedor. Las ofertas se abren en Jooble en una pestaña nueva.

Solicitar una clave para la región Argentina en
[Jooble Argentina](https://ar.jooble.org/api/about) y definir `JOOBLE_AR_API_KEY`
en el entorno del **backend**, tanto local como en producción. No usar una variable
`NEXT_PUBLIC_*` ni copiar la clave al repositorio. Sin clave, la búsqueda devuelve
`503` y la interfaz explica que aún no está configurada. La API puede tener una
cuota limitada; el servidor conserva cada consulta durante una hora en memoria para
reducir peticiones repetidas. La caché se pierde al reiniciar o cambiar de instancia.

Los endpoints son `GET /api/jobs/search-profile/{resume_id}` y
`POST /api/jobs/search`. Ambos requieren un bearer de Supabase y acceso al CV. El
segundo acepta `resumeId`, `keywords` y `location`, y devuelve hasta 20 ofertas sin
duplicados. La respuesta incluye `searchId` cuando se pudo persistir el conjunto de
ofertas; si falla esa persistencia, la búsqueda sigue disponible, pero Match no puede
analizarla. Las pruebas del conector usan un transporte HTTP simulado y no consumen la
cuota del proveedor.

Pruebas específicas: `tests/contract/test_jobs_api.py` y
`frontend/tests/jobs.test.tsx`. Para comprobar resultados reales hace falta una
clave regional válida y una consulta manual como en
[`specs/006-cv-job-search/quickstart.md`](../specs/006-cv-job-search/quickstart.md).

## Match de ofertas

En `/jobs`, después de buscar, se puede seleccionar un CV guardado y pulsar **Match**
para analizar únicamente las ofertas de esa búsqueda. No se vuelve a consultar Jooble.
El backend genera o reutiliza embeddings del CV y las ofertas con un deployment de
Azure OpenAI independiente del modelo de chat, compara los vectores mediante
`pgvector` y pide al modelo de chat hasta tres recomendaciones cualitativas (Alta o
Media) con coincidencias, requisitos no acreditados e información faltante. No se
presentan porcentajes ni probabilidades de contratación.

El análisis es sincrónico. `POST /api/jobs/match` calcula y guarda el resultado; si ya
existe uno, lo devuelve salvo que se solicite recalcular. `GET
/api/jobs/match/{searchId}?resumeId={resumeId}` recupera el resultado persistido.
Un fallo o timeout conserva el resultado anterior, y las llamadas simultáneas para la
misma búsqueda y CV se rechazan. Al volver a `/jobs`, la interfaz puede mostrar el
resultado guardado; si el CV cambió desde el análisis, lo indica antes de recalcular.

### Configuración de Match

El backend requiere `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` (deployment de embeddings,
por defecto `text-embedding-3-small`) y `AZURE_OPENAI_EMBEDDING_DIMENSIONS` (por
defecto `1536`). El deployment debe estar disponible en el recurso Azure configurado.
Los límites operativos, expresados en segundos salvo `MATCH_CANDIDATES_K`, son:

| Variable | Valor por defecto | Uso |
|---|---:|---|
| `MATCH_DEADLINE_SECONDS` | `75` | Tiempo máximo total del análisis |
| `MATCH_EMBEDDINGS_TIMEOUT_SECONDS` | `20` | Timeout de la llamada de embeddings |
| `MATCH_LLM_TIMEOUT_SECONDS` | `45` | Timeout del análisis con el modelo de chat |
| `MATCH_CANDIDATES_K` | `8` | Máximo de candidatos pgvector enviados al análisis |

El cliente cancela la petición después de 85 segundos. En Render free, un arranque en
frío puede consumir parte del límite total; `/jobs` muestra el aviso correspondiente
y solicita `/health` al abrir la pantalla. `backend/.env.example` contiene los valores
locales de referencia. Configura los mismos valores no secretos en el entorno de
Render; las claves de Azure y Supabase deben seguir siendo secretos gestionados allí,
nunca valores versionados.

### Migraciones de Match

Aplicar en Supabase y en este orden, antes de ejecutar Match:

1. `004_enable_pgvector.sql`: habilita la extensión `vector`.
2. `005_job_searches.sql`: crea las búsquedas persistidas y sus ofertas.
3. `006_match_results.sql`: crea los embeddings reutilizables, resultados y
   recomendaciones.
4. `007_match_functions.sql`: crea las funciones de búsqueda vectorial, guardado
   atómico y bloqueo de análisis concurrentes.

Las tablas nuevas están aisladas por usuario mediante RLS; el backend también filtra
por el usuario autenticado. Aplicar las migraciones antes de probar el flujo. Para el
procedimiento de validación y los escenarios esperados, consultar
[`specs/007-job-match-recommendations/quickstart.md`](../specs/007-job-match-recommendations/quickstart.md).

## Despliegue conjunto en Vercel Services

En **Settings → Build and Deployment**, seleccionar **Services** como framework y
dejar **Root Directory** en la raíz del repositorio. `vercel.json` define el
frontend Next.js en `frontend/` y el backend FastAPI en `backend/`. Las rutas
`/api/*` y `/health` llegan al backend; el resto llega al frontend. No configurar
comandos de instalación, build ni Output Directory manuales para el proyecto.

Definir en Vercel `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
para el navegador. El backend requiere `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `AZURE_OPENAI_ENDPOINT`,
`AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION` y `AZURE_OPENAI_DEPLOYMENT`.
Para habilitar la búsqueda de empleos agrega `JOOBLE_AR_API_KEY` solo al backend.
Para Match, configura además `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` y
`AZURE_OPENAI_EMBEDDING_DIMENSIONS`; usa `MATCH_DEADLINE_SECONDS`,
`MATCH_EMBEDDINGS_TIMEOUT_SECONDS`, `MATCH_LLM_TIMEOUT_SECONDS` y
`MATCH_CANDIDATES_K` para mantener los límites operativos documentados arriba.
No subir secretos al repositorio. Sin `NEXT_PUBLIC_BACKEND_URL`, el frontend
llama a `/api/*` en el mismo dominio; esa variable solo hace falta si se usa un
backend externo, como el servicio de Render. Tras cambiar la configuración,
iniciar un nuevo despliegue.

No copiar la URL local `http://localhost:8000` o `http://127.0.0.1:8000` a
las variables de producción. Con Vercel Services, dejar
`NEXT_PUBLIC_BACKEND_URL` vacía u omitirla. El cliente descarta una URL de
loopback cuando la página está en un dominio remoto y usa `/api/*` del mismo
dominio para perfil, generación, asistencia e historial. Esto evita consultar
el equipo del visitante. Las URLs de backends externos siguen siendo válidas;
en desarrollo local se conserva la configuración de localhost.
