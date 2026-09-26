# Quickstart: Enriquecimiento de trayectoria y competencias

## Prerrequisitos

- Python 3.11+, entorno virtual y dependencias existentes según [docs/desarrollo.md](../../docs/desarrollo.md).
- Node.js LTS y dependencias existentes de `frontend/`.
- Variables locales de Supabase y Azure OpenAI configuradas en backend; frontend con sus variables públicas actuales. No copiar valores secretos a artefactos o logs.
- Para Playwright, Chromium instalado con la guía de desarrollo y una cuenta Supabase confirmada; los tests de contrato/integración usan proveedores y repositorios simulados y no requieren llamadas pagadas.

## Arranque local

Backend, desde la raíz en una terminal PowerShell:

```powershell
Set-Location backend
$env:PYTHONPATH="."
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend, desde la raíz en otra terminal:

```powershell
Set-Location frontend
npm run dev -- --hostname 127.0.0.1
```

Abrir `http://localhost:3000/auth` y entrar al flujo de generación.

## Validación automatizada

Desde la raíz:

```powershell
$env:PYTHONPATH="backend;."
.venv\Scripts\python.exe -m pytest tests/contract/test_trajectory_assistance.py tests/integration/test_trajectory_assistance.py tests/contract/test_generate_cv.py tests/integration/test_generate_cv.py -q
```

Desde `frontend/`:

```powershell
npm test -- --run
npx playwright test --reporter=list
```

Usar IDs accesibles derivados de snapshots actuales; seguir `.github/instructions/playwright-tests.instructions.md` para locators y títulos en español.

## Escenarios de aceptación

1. Enviar una trayectoria con tarea y resultado sin métrica; comprobar que el sistema pregunta por la medida, no inventa una cifra y permite responder que no se conoce.
2. Responder a una pregunta y obtener propuestas; comprobar que cada logro/competencia factual incluye una cita que aparece literalmente en el texto fuente o en la respuesta confirmada.
3. Comprobar que la lista diferencia propuestas factuales de recomendaciones de desarrollo; rechazar una propuesta e indicar que no debe incorporarse al CV.
4. Editar y aceptar una propuesta factual, dejar otra pendiente y aceptar una acción de desarrollo; generar el CV y comprobar que solo la versión factual aceptada/editada se agrega al texto final, que la propuesta pendiente/rechazada y la acción de desarrollo se excluyen, y que el CV pasa el schema actual.
5. Enviar texto vacío, un campo extra o respuesta del proveedor con cita inexistente; comprobar un error recuperable que no refleje el texto profesional ni detalles internos.
6. Probar token inválido/expirado y fallo de Azure; confirmar `401`/error seguro y que no se persiste un CV ni una conversación.
7. Cerrar o cambiar la sesión durante el diálogo; confirmar que preguntas, respuestas y decisiones anteriores desaparecen y no se recuperan en la cuenta siguiente.

## Resultado esperado

El usuario puede mejorar la redacción de hechos reales, responder preguntas cuando faltan datos y revisar competencias con evidencia. Solo contenido factual aceptado/editado entra al CV final; las recomendaciones de aprendizaje y las propuestas no confirmadas se mantienen fuera.
