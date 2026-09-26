# Implementation Plan: Enriquecimiento de trayectoria y competencias

**Branch**: `002-enriquecimiento-trayectoria` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-enriquecimiento-trayectoria/spec.md`

## Summary

Añadir asistencia síncrona para aclarar trayectoria, proponer redacciones fieles y relacionar competencias con evidencia del usuario. Las propuestas se revisan antes de incorporarse al CV; las competencias inferidas y acciones de desarrollo se mantienen separadas de las capacidades confirmadas. Se reutilizan el proveedor Azure OpenAI, FastAPI, Pydantic, el estado temporal React y el endpoint actual de generación; no se persisten conversaciones ni se añaden dependencias.

## Technical Context

**Language/Version**: Python 3.11+ para FastAPI; TypeScript para Next.js 15 y React 19.

**Primary Dependencies**: FastAPI, Pydantic 2, httpx, cliente Azure OpenAI REST existente, Next.js y clientes Supabase existentes; no se agregan paquetes.

**Storage**: No se añade almacenamiento conversacional. Se mantiene la persistencia existente de `resumes` para el CV final aceptado.

**Testing**: pytest para modelos/contrato e integración; Vitest para transformaciones y estado de propuestas; Playwright para turnos, revisión, aceptación/rechazo y generación final.

**Target Platform**: Navegadores modernos; FastAPI en Render y Next.js en Vercel, con Azure OpenAI ya configurado.

**Project Type**: Aplicación web full-stack existente con API síncrona y CV JSON validado.

**Performance Goals**: Mantener el límite actual del proveedor Azure (60 segundos por petición); mostrar estado de carga en cada turno; no introducir llamadas vectoriales, jobs o servicios adicionales.

**Constraints**: Todas las peticiones usan bearer autenticado; no persistir preguntas/respuestas; nunca aceptar credenciales desde navegador; salida de asistencia estricta y separada del CV; toda cita de evidencia debe estar en texto de usuario; solo propuestas aceptadas/editadas se agregan a la generación; no inventar datos ni cambiar los campos del schema CV.

**Scale/Scope**: Una sesión temporal por usuario y formulario abierto, preguntas acotadas, propuestas de trayectoria/competencias con evidencia y acciones de desarrollo; sin historial de conversación, generación de perfiles ficticios, matching ni consulta externa de empleos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Estado | Justificación |
|---|---|---|
| MVP enfocado | PASS | Amplía la confección/revisión del CV; excluye perfiles ficticios, matching, scraping, embeddings y jobs. |
| Contrato estructurado | PASS | La asistencia usa DTOs JSON estrictos propios; el CV final mantiene el contrato `StructuredCv` vigente y su validación. |
| Veracidad de afirmaciones | PASS | Cada propuesta factual aporta citas literales verificables; aceptación explícita del usuario es necesaria antes de enviarla a generación. |
| Separación de responsabilidades | PASS | React administra el diálogo temporal; FastAPI autentica, valida citas y coordina Azure; Azure solo propone datos estructurados. |
| Privacidad | PASS | No se persiste conversación ni se expone secreto; cada turno va asociado a bearer autenticado y el texto solo se envía a Azure por backend. |
| Stack y complejidad | PASS | Reutiliza Azure OpenAI, FastAPI, Pydantic, React y persistencia existente, sin dependencias ni servicios nuevos. |

### Re-evaluación post-diseño

| Gate | Estado | Evidencia del diseño |
|---|---|---|
| Separación de contratos | PASS | `trajectory-assistance.md` define `needs_input`/`ready`; ninguna salida de asistencia se tipa ni persiste como `StructuredCv`. |
| Evidencia verificable | PASS | Cada propuesta factual incluye citas literales que el backend valida contra texto fuente/respuestas; una cita inválida no se devuelve como competencia demostrada. |
| Revisión humana | PASS | Solo redacción aceptada/editada se agrega al texto de generación; propuestas pendientes/rechazadas y acciones de desarrollo quedan fuera. |
| No-fabricación | PASS | La spec prohíbe afirmaciones no aportadas/confirmadas y el contrato separa inferencias con evidencia de recomendaciones de aprendizaje. |
| Privacidad y titularidad | PASS | Cada turno usa bearer; el estado reside en memoria cliente y se descarta en salida/cambio de usuario; no hay tabla nueva ni historial. |
| Compatibilidad e idempotencia | PASS | El texto final reutiliza `POST /api/generate-cv` con su validación, persistencia e `Idempotency-Key` vigentes. |
| Stack/scope | PASS | Azure OpenAI permanece solo en backend; no se agregan proveedores, dependencias, vector DB, jobs ni matching. |

## Project Structure

### Documentation (this feature)

```text
specs/002-enriquecimiento-trayectoria/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/trajectory-assistance.md
```

### Source Code (repository root)

```text
backend/
├── app/api/trajectory_assistance.py
├── app/models/trajectory_assistance.py
├── app/services/trajectory_assistance.py
└── app/services/azure_openai.py

frontend/
└── app/
    ├── generate/page.tsx
    ├── components/trajectory-assistant.tsx
    ├── lib/trajectory-assistance-client.ts
    └── types/trajectory-assistance.ts

tests/
├── contract/test_trajectory_assistance.py
├── integration/test_trajectory_assistance.py
└── e2e/trajectory-assistance.spec.ts
```

**Structure Decision**: Se amplía el generador existente sin alterar el esquema de CV. FastAPI añade modelos y una operación de asistencia protegida; el servicio utiliza Azure OpenAI y valida evidencia de cada propuesta. Next.js mantiene diálogo, turnos y decisiones temporalmente en memoria y agrega solo texto factual aceptado/editado al texto que ya envía a la generación existente. La salida final sigue validándose como `StructuredCv` y se persiste solo en el flujo actual.

## Complexity Tracking

> No hay violaciones de la constitución que requieran justificación.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
