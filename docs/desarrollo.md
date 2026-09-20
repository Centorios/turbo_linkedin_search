# CV8 - Generador de CV con IA

MVP para transformar texto profesional en un CV estructurado, validado y exportable a PDF.

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
