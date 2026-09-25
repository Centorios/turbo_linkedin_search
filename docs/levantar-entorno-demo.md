# Cómo levantar el proyecto en modo prueba/demo

Guía rápida para correr el backend (FastAPI) y el frontend (Next.js) en
local con fines de demo, en Linux y en Windows.

## Requisitos previos

- Python 3.11+
- Node.js LTS
- Un proyecto Supabase configurado (URL + keys)
- Archivos `.env` completos:
  - `backend/.env` (a partir de `backend/.env.example`)
  - `frontend/.env.local` (a partir de `frontend/.env.example`)

Sin estas credenciales el login y la generación de CV no van a funcionar,
aunque los servidores levanten igual.

## Puertos usados por defecto

| Servicio | Puerto | URL |
| --- | --- | --- |
| Backend (FastAPI) | 8000 | http://127.0.0.1:8000 |
| Frontend (Next.js) | 3000 | http://127.0.0.1:3000 |

`frontend/.env.local` apunta a `NEXT_PUBLIC_BACKEND_URL` y `backend/.env`
restringe `CORS_ORIGINS` a `http://localhost:3000`. Si cambiás alguno de
los dos puertos, actualizá el otro archivo para que coincidan (ver
sección "Puerto 8000 ocupado" más abajo).

---

## Linux / macOS (bash)

### 1. Backend

```bash
cd backend
python3 -m venv ../.venv        # solo la primera vez
source ../.venv/bin/activate
pip install -e ".[test]"
PYTHONPATH=. uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Comprobación: `curl http://127.0.0.1:8000/health` debe responder
`{"status":"ok"}`.

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abrir `http://127.0.0.1:3000/auth`.

> Si ya tenías `frontend/node_modules` de antes, volvé a correr
> `npm install`: la interfaz usa Tailwind CSS (`tailwindcss` +
> `@tailwindcss/postcss`) y necesita esa dependencia.

---

## Windows (PowerShell)

### 1. Backend

```powershell
Set-Location ..
python -m venv .venv
.venv\Scripts\Activate.ps1
Set-Location backend
pip install -e ".[test]"
$env:PYTHONPATH="."
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Comprobación: abrir `http://127.0.0.1:8000/health` en el navegador,
debe responder `{"status":"ok"}`.

### 2. Frontend

En otra terminal de PowerShell:

```powershell
Set-Location frontend
npm install
npm run dev -- --hostname 127.0.0.1
```

Abrir `http://localhost:3000/auth`.

---

## Puerto 8000 ocupado

Si el puerto 8000 ya está en uso por otro proceso (pasa seguido en
entornos compartidos o contenedores con servicios preexistentes),
levantá el backend en otro puerto y decíselo al frontend con una
variable de entorno, sin tocar `.env.local`:

**Linux/macOS:**

```bash
PYTHONPATH=. uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
# en la terminal del frontend:
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8010 npm run dev -- --hostname 127.0.0.1 --port 3000
```

**Windows (PowerShell):**

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
# en la terminal del frontend:
$env:NEXT_PUBLIC_BACKEND_URL="http://127.0.0.1:8010"
npm run dev -- --hostname 127.0.0.1
```

Las variables `NEXT_PUBLIC_*` exportadas en la shell tienen prioridad
sobre las definidas en `.env.local`, así que no hace falta editar el
archivo para una prueba puntual.

Antes de asumir que el puerto está "roto", verificá qué responde:

```bash
curl http://127.0.0.1:8000/health
```

Si la respuesta no es `{"status":"ok"}` (por ejemplo
`{"status":"healthy","service":"backend"}` o cualquier otro payload),
ese proceso no es el backend de este proyecto y conviene no matarlo a
ciegas: usá otro puerto en su lugar.

---

## Detener los servicios

- Si corriste los comandos en primer plano: `Ctrl+C` en cada terminal.
- Si los lanzaste en segundo plano (Linux/macOS):

```bash
pkill -f "uvicorn app.main:app"
pkill -f "next dev"
```

## Ver más

Para tests unitarios, de integración y E2E (Playwright), ver
[desarrollo.md](desarrollo.md).
