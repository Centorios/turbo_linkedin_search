@echo off
setlocal
set "ROOT=%~dp0"

if /I "%~1"=="--backend" goto backend
if /I "%~1"=="--frontend" goto frontend

set "MISSING=0"
if not exist "%ROOT%backend\.env" (
  echo Missing backend\.env. Copy backend\.env.example and fill in the required values.
  set "MISSING=1"
)
if not exist "%ROOT%frontend\.env.local" (
  echo Missing frontend\.env.local. Copy frontend\.env.example and fill in the required values.
  set "MISSING=1"
)
if not exist "%ROOT%frontend\node_modules\.bin\next.cmd" (
  echo Frontend dependencies are missing. Run npm ci inside frontend.
  set "MISSING=1"
)
if not exist "%ROOT%frontend\node_modules\@tailwindcss\postcss\package.json" (
  echo Tailwind PostCSS is missing. Run npm ci inside frontend.
  set "MISSING=1"
)
if not exist "%ROOT%frontend\node_modules\tailwindcss\package.json" (
  echo Tailwind CSS is missing. Run npm ci inside frontend.
  set "MISSING=1"
)

call :find_python
if errorlevel 1 (
  set "MISSING=1"
) else (
  "%PYTHON%" --version >nul 2>&1
  if errorlevel 1 (
    echo Python runtime is missing. backend\.venv points to a removed Python installation.
    echo Install Python 3.11 and recreate backend\.venv.
    set "MISSING=1"
  ) else (
    "%PYTHON%" -c "import fastapi, uvicorn, supabase" >nul 2>&1
    if errorlevel 1 (
      echo Backend dependencies are missing. Install backend/test dependencies into backend\.venv.
      set "MISSING=1"
    )
  )
)
if "%MISSING%"=="1" goto fail

start "CV8 API" "%ComSpec%" /k call "%~f0" --backend
start "CV8 Web" "%ComSpec%" /k call "%~f0" --frontend
echo Starting API at http://127.0.0.1:8765 and web app at http://localhost:3100
timeout /t 3 /nobreak >nul
start "" "http://localhost:3100/auth"
exit /b 0

:fail
echo.
echo Setup is incomplete. Press any key to close this window.
pause >nul
exit /b 1

:find_python
if exist "%ROOT%backend\.venv\Scripts\python.exe" (
  set "PYTHON=%ROOT%backend\.venv\Scripts\python.exe"
  exit /b 0
)
echo Missing backend\.venv. Create it with py -3.11 -m venv backend\.venv.
exit /b 1

:backend
call :find_python
if errorlevel 1 exit /b 1
cd /d "%ROOT%backend"
set "CORS_ORIGINS=http://localhost:3100"
"%PYTHON%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8765
exit /b %errorlevel%

:frontend
cd /d "%ROOT%frontend"
set "NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8765"
call npm run dev -- --hostname localhost --port 3100
exit /b %errorlevel%
