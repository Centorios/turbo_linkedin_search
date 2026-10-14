# Implementation Plan: Eliminar CVs del historial de la cuenta

**Branch**: `009-delete-cv-history` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

## Summary

Permitir que una persona elimine permanentemente un CV individual de su historial. La solicitud se autoriza con la sesión existente y la propiedad del CV; la confirmación informa que también se borrarán búsquedas y análisis dependientes. El historial actualiza su vista tras el éxito y conserva el CV visible cuando la operación falla. Se reutiliza la cascada de claves foráneas existente, sin una migración nueva.

## Technical Context

**Language/Version**: Python 3.11+, TypeScript, React 19, Next.js 15.

**Primary Dependencies**: FastAPI, Pydantic, Supabase, Next.js y React existentes. No se agregan dependencias.

**Storage**: Supabase PostgreSQL, tabla `resumes` existente. Las relaciones de búsquedas, embeddings y resultados de matching ya declaran borrado en cascada.

**Testing**: pytest para la integración del repositorio y la API; Vitest y Testing Library para el historial; TypeScript con `tsc --noEmit`.

**Target Platform**: FastAPI en Render, frontend en Vercel y datos en Supabase.

**Project Type**: Aplicación web full-stack.

**Performance Goals**: Una acción confirmada elimina una versión y sus dependencias dentro de una petición; no se cargan documentos completos para listar o confirmar la acción.

**Constraints**: Se debe derivar el usuario exclusivamente del token; usar filtro combinado por usuario e ID; igualar la respuesta para un CV ajeno o inexistente; no revelar detalles de persistencia; no eliminar fotos compartidas del perfil; no agregar papelera ni recuperación. Al cambiar de cuenta se descarta la respuesta de eliminación pendiente, aunque una petición ya recibida por el servidor pueda completarse.

**Scale/Scope**: Una versión por operación, dentro de la página privada `/history`; se conserva el listado, vista previa, exportación y comportamiento actual del historial.

## Constitution Check

Constitución v1.3.0.

| Principio | Evaluación | Estado |
|---|---|---|
| I. Etapas incrementales y alcance explícito | Se amplía el historial existente con eliminación de una versión; no cambia la generación de CV | PASS |
| II. Contratos estructurados y validación en límites | UUID y sesión se validan en la API; no se modifica el esquema del CV | PASS |
| III. Renderizado y exportación en cliente | La vista previa y la exportación permanecen en el cliente | PASS |
| IV. Seguridad y aislamiento | La API autoriza por usuario autenticado y no distingue ID ajeno de inexistente | PASS |
| V. Simplicidad y calidad | Se reutilizan repositorio, ruta y pruebas existentes; no hay dependencias ni migraciones nuevas | PASS |

**Gate**: aprobado. No hay aclaraciones técnicas pendientes ni excepciones a la constitución.

## Project Structure

### Documentation (this feature)

```text
specs/009-delete-cv-history/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── resumes-delete-api.md
│   └── resumes-delete-ui.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/app/
├── api/resumes.py                         # DELETE autenticado
└── services/resume_repository.py           # borrado filtrado por usuario e ID
frontend/app/
├── history/page.tsx                        # confirmación y estado del historial
└── lib/resume-history-client.ts             # cliente DELETE con sesión
tests/integration/
└── test_resume_history.py                  # propietario, cascada y errores
frontend/tests/
└── resume-history.test.tsx                 # confirmación, estados y conservación
```

**Structure Decision**: Extender la API, el repositorio y la página de historial existentes. Las tablas relacionadas ya declaran `ON DELETE CASCADE`; no se introduce un repositorio, página, tabla o infraestructura nuevos.

## Complexity Tracking

Sin excepciones a la constitución.
