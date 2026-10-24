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

## Migraciones de Supabase

Las migraciones viven en `backend/supabase/migrations/` y **no se aplican solas**: el deploy
del backend no las ejecuta. Cada feature que agrega una migración tiene que aplicarla a mano en
Supabase (**SQL Editor** → pegar el archivo → **Run**) antes de usarse en local o en producción.
Todas están escritas para poder correrse más de una vez (`if not exists`, `drop policy if exists`,
`on conflict`).

Si una función nueva falla con un error genérico 500, revisar primero que su migración esté
aplicada. Por ejemplo, sin `009_cv_import_sources.sql` la importación de CVs responde
"No se pudo importar el CV" porque faltan la tabla `cv_sources`, la columna `resumes.source_id`
y el bucket `cv-sources`. Los errores del backend se imprimen con su tipo
(`cv_import_failed error_type=APIError`); solo se muestran campos seguros (`error_type`,
`issues`), nunca datos del usuario.

## Autenticación con Google

`/auth` ofrece **Continuar con Google**, tanto al iniciar sesión como al crear
una cuenta. El acceso con Microsoft se descartó porque el equipo no tiene acceso
al portal de Microsoft Entra para registrar la aplicación. Correo y contraseña
siguen disponibles.
El flujo usa Supabase Auth con PKCE; `/auth/callback` intercambia el código y
devuelve las cookies de sesión antes de llevar a `/generate`. Un rechazo, código
inválido o error vuelve al login con un mensaje seguro y permite reintentar.
No hay tablas, migraciones ni dependencias nuevas.

### URLs de retorno

Son dos direcciones distintas; no deben intercambiarse:

| Dónde se configura | URL |
|---|---|
| Google Cloud, redirect URI del proveedor | `https://<project-ref>.supabase.co/auth/v1/callback` (copiar del dashboard Supabase) |
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

Los secretos de Google se guardan **solo en el dashboard de Supabase**;
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
Antes del release, completar manualmente el acceso con Google, recargar la sesión, cerrar sesión y comprobar que cada cuenta conserva
solo su perfil/historial. Cancelar también el consentimiento y verificar reintento.

Si vuelve un error, revisar proveedor habilitado, client ID/secreto vigente,
audiencia/usuarios de prueba y ambas clases de redirect URI.
Usar los logs administrativos de Supabase sin copiar códigos, tokens ni datos
personales a tickets o archivos compartidos. El consentimiento real requiere
configuración administrativa externa y no queda certificado por pruebas simuladas.

## Plantillas de PDF

La vista previa y la descarga son **el mismo PDF**: ambas llaman a `renderCvPdf`
(`frontend/app/lib/cv-pdf.tsx`) y la vista previa lo muestra en un `iframe`. En
navegadores sin visor de PDF integrado se muestra solo un enlace para abrirlo.

Hay dos plantillas, **Minimalista ATS** y **Creativo PDF**, y esta última tiene cinco
estilos: Clásico, Barra lateral, Encabezado de color, Elegante serif y Línea de tiempo.

| Qué | Dónde |
|---|---|
| Lista de plantillas y estilos, nombres de archivo | `frontend/app/templates/registry.ts` |
| Elige el documento según la plantilla y arma el nombre del archivo | `frontend/app/templates/cv-pdf-document.tsx` |
| Un documento por estilo | `frontend/app/templates/pdf/` |
| Textos, títulos y datos comunes | `frontend/app/templates/pdf/shared.tsx` |
| Selector de plantilla y estilo | `frontend/app/components/template-selector.tsx` |

Para agregar un estilo:

1. Sumar un id a `CreativeStyle` y una entrada a `CREATIVE_STYLES` (etiqueta, color de muestra, sufijo de archivo).
2. Crear su documento en `templates/pdf/` reutilizando `shared.tsx`, y añadir su `case` en `cv-pdf-document.tsx`.
3. Los tests recorren `CV_TEMPLATES`, así que el contenido, la foto y los nombres de archivo se prueban solos. Revisar el resultado con un CV corto y uno largo.

Reglas para los estilos:

- Usar solo las fuentes integradas (Helvetica, Times, Courier): sin archivos de fuente que descargar.
- Evitar un `letterSpacing` grande (más de 1): hace que el texto se extraiga como "T R A Y E C T O R I A".
- En una fila con texto y foto o columnas, dar **ancho explícito** al texto y poner `flexShrink: 0` a la foto y a las columnas fijas; si no, el texto no se ajusta y se pisa con la foto o la barra lateral.
- Las entradas llevan `wrap={false}` para no cortarse entre páginas.
- Los estilos creativos no muestran fechas ni identificador de las certificaciones.

## Modo claro y oscuro

El botón **sol/luna** (`frontend/app/components/theme-toggle.tsx`) está en el header y en la pantalla de acceso.

- **Cómo funciona:** el tema vive en `<html data-theme="light|dark">`. Los colores son tokens (`--color-surface`, `--color-text`, `--color-primary`…) definidos en `frontend/app/globals.css`; el modo oscuro **redefine los mismos tokens** en `:root[data-theme="dark"]`. Por eso los componentes no saben nada del tema: usan `bg-surface`, `text-text-muted`, `border-border`, etc. y cambian solos.
- **Reglas para componentes nuevos:** usar siempre clases de token y **no** colores fijos (`bg-white`, `text-indigo-100`, hex). Para un color nuevo, agregar el token en las dos paletas. Los efectos que no son un color plano (sombras, degradados) van como variables (`--card-shadow`, `--canvas-glow-1`…).
- **Preferencia:** una elección guardada (`localStorage`, clave `cv8-theme`) gana sobre el sistema; sin elección se sigue `prefers-color-scheme`, también mientras la página está abierta. Si el navegador bloquea el almacenamiento, la elección dura solo esa visita.
- **Sin destello:** un script en `<head>` (`THEME_INIT_SCRIPT` en `frontend/app/lib/theme.ts`) aplica el tema **antes de pintar**. El cambio se anima un instante (`html.theme-transition`), salvo con "reducir movimiento".
- **Qué no cambia:** el PDF del CV y su vista previa siguen blancos: es un documento para enviar o imprimir. El panel de marca ya era oscuro.
- **Contraste:** `frontend/tests/theme-contrast.test.ts` lee los tokens de `globals.css` y exige 4.5:1 (WCAG AA) en los pares de texto del tema oscuro. El tema claro conserva sus colores; algunos pares ya estaban por debajo de 4.5:1 y quedan listados en el test para que no empeoren (`text-faint` sobre `subtle` y `canvas`, y `success`, `warning` y `danger` sobre sus fondos).
- **Header en pantallas angostas:** a partir de 360 px entra en una fila; por debajo, el botón y "Cerrar sesión" pasan a una segunda fila.

## Idioma del CV

Al generar un CV, si el texto **no menciona ningún idioma**, la sección "Idiomas" lleva el idioma en el que está escrito, por ejemplo "Español", en lugar de "Sin idiomas registrados".

- `backend/app/services/language_detection.py` cuenta palabras funcionales frecuentes (artículos, preposiciones, conjunciones) y reconoce **Español, Inglés y Portugués**, sin dependencias ni llamadas a la IA. Si el texto es muy corto (menos de 8 palabras), no hay evidencia suficiente o el resultado es parejo, **no agrega nada**: es mejor la sección vacía que un idioma equivocado.
- Se agrega sin nivel (`proficiency` vacío): escribir en un idioma no dice qué nivel se tiene.
- Si la IA ya encontró idiomas en el texto, no se toca nada. La importación de PDF y las ediciones no cambian.
- Para sumar un idioma, agregar su lista de palabras en `_FUNCTION_WORDS` y un texto de ejemplo en `tests/integration/test_language_detection.py`.

## Textos y tono

Los textos de la interfaz están en **español rioplatense, con voseo y tono profesional**:
"Ingresá tu correo", "Intentá de nuevo", "Podés descargar el CV", "Elegí una versión".
Los botones en infinitivo ("Iniciar sesión", "Generar CV") y "tu/tus" no cambian.

- Aplica a la interfaz (`frontend/app`), a los mensajes del backend que se muestran en pantalla y a lo que la IA le dice a la persona.
- Los prompts de `backend/app/services/azure_openai.py` que generan preguntas y recomendaciones para la persona (asistente de trayectoria, edición de un CV importado y Match) piden español rioplatense con voseo. No cambia el esquema JSON.
- El **contenido del CV** (resumen, logros, títulos) sigue siendo impersonal y fiel a la fuente.
- `No conozco ese dato.` es una frase fija: el backend la reconoce como "no sé", así que no se traduce ni se modifica.
- **Nada en inglés a la vista.** Los errores de Supabase Auth llegan en inglés ("Invalid login credentials"): `getAuthErrorMessage` (`frontend/app/auth/actions.ts`) los traduce por `error.code` y, si el código no se conoce, muestra un mensaje genérico en español, nunca el texto original. Las páginas 404 y de error son propias (`app/not-found.tsx` y `app/error.tsx`) y `<html lang>` es `es-AR`. Para agregar un error nuevo, sumar su código al mapa.
- **No usar `<input type="file">` a la vista:** su "Browse… No file selected." depende del idioma del navegador y no se puede traducir. Usar `FilePickerButton` (`frontend/app/components/file-picker-button.tsx`), que deja el input oculto pero accesible y muestra el botón **"Buscar"**.
- Al escribir textos nuevos, evitar el tuteo (`puedes`, `introduce`, `inténtalo`, `selecciona`) y el vocabulario peninsular.

## Foto de perfil con la cámara

En **Editar perfil**, la foto se elige con **Buscar** (un archivo JPEG, PNG o WebP de hasta 5 MB) o con
**Usar cámara**, que muestra la cámara dentro del mismo campo y toma la foto con **Tomar foto**.

- La captura se guarda como un recorte cuadrado de 640×640 en JPEG (`foto-camara.jpg`) y entra por el mismo camino que un archivo: misma validación, vista previa, "Quitar foto" y subida al bucket `profile-photos` al guardar el perfil.
- **Usar cámara** aparece solo si el navegador ofrece `navigator.mediaDevices.getUserMedia`, que requiere HTTPS o `localhost`. Si no se da el permiso o no hay cámara, se explica el motivo y sigue disponible **Buscar**.
- La cámara se apaga siempre (todas las pistas con `stop()`): al tomar la foto, al cancelar, al guardar, al cerrar el diálogo, y también si el permiso llega después de cerrar. Escape cierra la cámara, no el diálogo.
- Los E2E usan la cámara falsa de Chromium (`--use-fake-device-for-media-stream`), así que no necesitan una cámara real.

## Confirmaciones de acciones destructivas

Las acciones que borran datos (eliminar un CV del historial, eliminar un CV importado) usan
`ConfirmDialog` (`frontend/app/components/confirm-dialog.tsx`) y no el cartel del navegador
(`window.confirm`). Es un `alertdialog` accesible: el foco inicial queda en **Cancelar**,
Tab no sale del diálogo, Escape o el clic en el fondo cancelan y, al cerrar, el foco vuelve al botón
que lo abrió. Los `data-testid` son `confirm-dialog`, `confirm-dialog-confirm` y
`confirm-dialog-cancel`. Para una acción nueva, pasar `title`, `description` y `confirmLabel`.

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

Desde cada versión del historial se puede solicitar su eliminación permanente.
`DELETE /api/resumes/{id}` requiere sesión, valida la propiedad y responde igual para
un ID ajeno o inexistente. Antes de enviar la petición, la interfaz informa que también
se eliminarán las búsquedas y los resultados de matching asociados; las relaciones
existentes aplican la cascada. No se eliminan el perfil ni las fotos compartidas. Si la
operación falla, el CV permanece visible y puede reintentarse.

Las fotos antiguas pueden haber sido eliminadas; en ese caso se mantiene el texto y
la descarga funciona sin foto. La UI descarta solicitudes pendientes al cambiar de
cuenta y los datos no se guardan en almacenamiento del navegador.

Pruebas específicas: `tests/integration/test_resume_history.py`,
`frontend/tests/resume-history.test.tsx` y `tests/e2e/resume-history.spec.ts`.

## Editar una versión del historial

En **Historial**, al abrir una versión aparece **Editar CV** junto a "Descargar PDF". Lleva a
`/generate?editar=<resumeId>#editar-cv`, donde "Editá un CV existente" abre esa versión ya cargada.
El flujo es el mismo que con un PDF importado: se le piden cambios a la IA, responde preguntas si
le faltan datos, se revisa la propuesta y se guarda.

- Guardar crea **siempre una versión nueva** (`parent_resume_id` = la versión editada). La original no se modifica y la nueva aparece primera en el Historial.
- Si la versión venía de un PDF importado, la nueva conserva su `source_id`. Si venía de un CV generado, queda con `source_id` nulo.
- Endpoints (mismo servicio que la importación, `CvImportService`):
  - `POST /api/resumes/{resume_id}/edits` con `instruction`, `answers` y `currentCv` opcional. Responde `needs_input` o `ready`, como `/api/cv-imports/{id}/edits`.
  - `POST /api/resumes/{resume_id}/versions` con `Idempotency-Key` y `{ "data": StructuredCv }`. Responde la versión creada.
  - Una versión inexistente o de otra cuenta responde 404 `resume_not_found`, sin distinguir los dos casos.
- No requiere migraciones nuevas: usa las columnas de `009_cv_import_sources.sql`.

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
