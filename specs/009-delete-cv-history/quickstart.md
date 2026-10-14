# Quickstart: Verificar eliminación de CVs del historial

## Pruebas automatizadas

Desde la raíz del repositorio:

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) 'backend')
.\.venv\Scripts\python.exe -m pytest .\tests\integration\test_resume_history.py -q
```

Desde `frontend`:

```powershell
npm run test -- tests/resume-history.test.tsx
.\node_modules\.bin\tsc.cmd --noEmit
```

Las pruebas deben validar la autorización por propietario, la cascada declarada, las respuestas iguales para CV ajeno/inexistente, la confirmación/cancelación, error y reintento, la vista previa abierta y la conservación de otros CVs.

## Comprobación manual

1. Iniciar sesión con una cuenta que tenga al menos dos CVs guardados.
2. Abrir **Historial** e iniciar la eliminación de uno; confirmar que el diálogo identifica el CV y explica que se borrarán búsquedas y resultados asociados.
3. Cancelar y comprobar que el CV sigue listado y puede abrirse.
4. Volver a iniciar la eliminación y confirmarla; comprobar que desaparece el CV, que su detalle ya no se abre y que los otros CVs siguen disponibles.
5. Abrir un CV distinto antes de borrar una versión y verificar que la vista previa de la versión distinta permanece.
6. Simular un error del backend y comprobar que el CV permanece visible, se informa el fallo y se puede reintentar.
7. Con otra cuenta autenticada, probar el ID de la cuenta anterior y confirmar que no se modifica ni se revela el documento.

## Contratos

Ver [contrato API](./contracts/resumes-delete-api.md), [contrato UI](./contracts/resumes-delete-ui.md) y [modelo de datos](./data-model.md).
