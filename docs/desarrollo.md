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
duplicados. La búsqueda no ejecuta scraping ni calcula afinidad semántica; el
historial, los favoritos y el matching quedan para entregas posteriores. Las pruebas
del conector usan un transporte HTTP simulado y no consumen la cuota del proveedor.

Pruebas específicas: `tests/contract/test_jobs_api.py` y
`frontend/tests/jobs.test.tsx`. Para comprobar resultados reales hace falta una
clave regional válida y una consulta manual como en
[`specs/006-cv-job-search/quickstart.md`](../specs/006-cv-job-search/quickstart.md).

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
Para habilitar la búsqueda de empleos agregar `JOOBLE_AR_API_KEY` solo al backend.
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
