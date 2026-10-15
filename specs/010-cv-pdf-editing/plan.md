# Implementation Plan: Edición de CV existente desde PDF con IA

**Branch**: `010-cv-pdf-editing` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-cv-pdf-editing/spec.md`

## Summary

Permitir que un usuario autenticado importe un CV PDF, lo convierta al contrato `StructuredCv` existente, solicite cambios a Azure OpenAI, revise la propuesta y guarde una versión nueva sin alterar el PDF ni la versión fuente. Se amplían las capas existentes de FastAPI, Supabase y la pantalla de generación; los PDFs se procesan sin OCR, con límites, y se conservan en almacenamiento privado.

## Technical Context

**Language/Version**: Python 3.11 o superior; TypeScript con React 19 y Next.js 15.  
**Primary Dependencies**: FastAPI, Pydantic, Supabase SDK, Azure OpenAI vía el proveedor HTTP actual; `pypdf` propuesto para extraer texto del PDF (nueva dependencia de ejecución, pendiente de aprobación).  
**Storage**: Supabase PostgreSQL para metadatos y CVs estructurados; bucket privado de Supabase Storage para el PDF fuente.  
**Testing**: pytest para contratos e integración del backend; Vitest para componentes del frontend; Playwright para el flujo de usuario.  
**Target Platform**: Aplicación web desplegada en Vercel y API Python desplegada en Render.  
**Project Type**: Aplicación web con frontend, API y persistencia.  
**Performance Goals**: Responder la importación y la propuesta de edición en menos de 60 segundos para documentos dentro de los límites definidos; imponer límites para evitar que el análisis del PDF o el envío al modelo bloquee recursos sin cota.  
**Constraints**: PDF de hasta 10 MiB y 20 páginas; nombre original recibido mediante `X-Original-Filename`, decodificado/saneado y nunca usado como ruta de almacenamiento; solo texto extraíble, sin OCR en esta entrega; no guardar una propuesta antes de la confirmación del usuario; validar toda salida contra `StructuredCv`; no enviar el archivo binario a Azure OpenAI, únicamente el texto extraído; aislar filas y objetos por usuario; eliminar de forma consistente la fuente y todas sus versiones cuando el usuario confirme su eliminación. La incorporación de `pypdf` requiere aprobación explícita y no se instalará hasta recibirla.  
**Scale/Scope**: Flujo síncrono para una importación y una propuesta por solicitud; una fuente puede tener una versión inicial y versiones confirmadas posteriores. No incluye OCR, edición colaborativa, procesamiento en background ni nuevos proveedores.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Resultado | Evidencia |
|------|-----------|----------|
| Mantener etapas incrementales y alcance explícito | PASS | La entrega cubre únicamente la importación y edición de un CV existente; no incorpora matching ni trabajos de scraping. |
| Validar contratos estructurados en límites | PASS | Importación y edición producen `StructuredCv`, validado con los modelos Pydantic existentes antes de persistir o devolver. |
| Renderizar y exportar en el cliente | PASS | La vista previa y descarga reutilizan las plantillas y `@react-pdf/renderer` existentes. |
| Seguridad y aislamiento por usuario | PASS | Los endpoints exigen la identidad autenticada; consultas de origen/versiones filtran por `user_id`; el PDF se conserva en un bucket privado con acceso mediado por la API. |
| Separación de frontend, FastAPI, Supabase y Azure | PASS | No se agrega un proveedor externo; la API orquesta extracción, IA y persistencia. |
| Validación de flujos integrados | PASS | Se proponen pruebas de contrato, integración, UI y E2E para autenticación, extracción, propuesta, persistencia y exportación. |
| Dependencia nueva | CONDITIONAL | `pypdf` es una propuesta necesaria para extracción en backend. No instalar ni modificar manifiestos antes de obtener aprobación del usuario, conforme a la constitución del repositorio. |

No hay violaciones arquitectónicas conocidas. El gate de dependencia es una condición de autorización, no una excepción a la constitución.

## Project Structure

### Documentation (this feature)

```text
specs/010-cv-pdf-editing/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cv-imports.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── api/
│   │   └── cv_imports.py
│   ├── models/
│   │   └── cv_import.py
│   └── services/
│       ├── azure_openai.py
│       ├── cv_import.py
│       └── cv_import_repository.py
├── pyproject.toml
└── supabase/migrations/
    └── 009_cv_import_sources.sql

frontend/app/
├── generate/page.tsx
├── components/
│   └── cv-import-editor.tsx
├── lib/
│   └── cv-import-client.ts
└── types/
    └── cv-import.ts

tests/
├── contract/test_cv_import.py
├── integration/test_cv_import.py
└── e2e/cv-import-edit.spec.ts

frontend/tests/
└── cv-import-editor.test.tsx
```

**Structure Decision**: Se integra con el proyecto web existente, sin crear un nuevo servicio o aplicación. El frontend reutiliza la página de generación, el contrato `StructuredCv`, los componentes de vista previa/descarga y el proveedor Azure OpenAI. FastAPI recibe el archivo binario como cuerpo `application/pdf` para evitar añadir `python-multipart`; la extracción, persistencia y autorización permanecen en el backend.

## Complexity Tracking

No se identifican violaciones constitucionales que requieran justificación.

## Phase 0: Research

Las decisiones sobre extracción, validación y límites están documentadas en [research.md](./research.md). Se descartan OCR y bibliotecas nativas para mantener la primera entrega acotada y reducir superficie de despliegue.

## Phase 1: Design & Contracts

- [data-model.md](./data-model.md) define la fuente PDF, las versiones estructuradas y la propuesta temporal.
- [contracts/cv-imports.openapi.yaml](./contracts/cv-imports.openapi.yaml) define los endpoints protegidos de importación, propuesta de edición, guardado de versión, descarga y eliminación del original.
- [quickstart.md](./quickstart.md) especifica cómo validar los flujos de extremo a extremo.

### Constitution Check (post-design)

| Gate | Resultado | Evidencia |
|------|-----------|----------|
| Flujo síncrono y acotado | PASS | El parser limita tamaño y páginas; las llamadas de IA conservan límites de tiempo explícitos y no se introduce una cola. |
| JSON validado | PASS | La extracción inicial y cada propuesta se validan contra `StructuredCv`; la versión solo se guarda tras confirmación. |
| Datos privados y autorización | PASS | El origen se identifica por usuario; el objeto usa un bucket privado y su descarga se autoriza en backend. |
| Compatibilidad con historial existente | PASS | Las filas `resumes` existentes mantienen sus campos; las nuevas columnas de relación son anulables para las CVs históricas. |
| PDF de origen preservado | PASS | El binario se conserva sin modificación; cada edición confirmada crea una versión estructurada nueva. |
| Dependencia `pypdf` | CONDITIONAL | Aprobación del usuario requerida antes de incorporarla al manifiesto o instalarla. |
