# Implementation Plan: Certificados del perfil y foto editable del CV

**Branch**: `master` | **Feature directory**: `016-upload-certificates-cv-photo` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Especificación de `specs/016-upload-certificates-cv-photo/spec.md`. Se reutiliza la arquitectura existente de Next.js, FastAPI, Supabase y Azure OpenAI.

## Summary

Crear una biblioteca privada de certificados por usuario, con archivo original y datos validados. La generación y el editor muestran esa biblioteca, sin selección inicial; «Seleccionar todos» permite marcarla y los archivos recién cargados quedan seleccionados. El backend verifica propiedad, combina solo credenciales elegidas y ausentes con el CV estructurado, y guarda la versión con el flujo actual. El editor añade controles directos para agregar, reemplazar o quitar la foto y guarda una nueva versión sin tocar la anterior. La vista previa y descarga siguen usando las plantillas y `@react-pdf/renderer` existentes.

## Technical Context

**Language/Version**: Python >=3.11; TypeScript 5.7; Next.js 15 y React 19 actuales.

**Primary Dependencies**: FastAPI/Pydantic, `httpx`, `pypdf`, cliente Supabase Python; Supabase JS/SSR y `@react-pdf/renderer` ya presentes. No se requiere instalar dependencias para el diseño propuesto.

**Storage**: `public.user_certificates` y bucket privado `user-certificates` en Supabase; `public.resumes.data` conserva el snapshot de certificaciones y `personalInfo.photoPath`; bucket privado `profile-photos` para fotos con rutas inmutables.

**Testing**: `pytest` para servicio, API e integración; Vitest/Testing Library para UI; Playwright para generación, edición, vista previa y descarga.

**Target Platform**: Navegador servido por Vercel; FastAPI en Render; Supabase Auth, Postgres y Storage; Azure OpenAI configurado en el backend.

**Project Type**: Aplicación web full-stack existente.

**Performance Goals**: La selección de certificados existentes no agrega una llamada de IA; extracción por archivo con estado de progreso y sin bloquear la navegación. Mantener el objetivo existente de generación visible en <=60 s p90 para solicitudes válidas sin nuevas cargas.

**Constraints**: Certificado <=5 MiB; PDF de hasta 5 páginas con texto extraíble; JPEG/PNG legible; hasta 10 archivos por operación. La foto conserva el límite actual de 5 MiB y JPEG/PNG/WebP. Limitar lectura en streaming antes de procesar. El despliegue Azure configurado debe aceptar imágenes para admitir certificados JPEG/PNG; comprobarlo antes de habilitar esa ruta.

**Scale/Scope**: Una biblioteca de hasta 50 certificados por cuenta; selección por lote acotada a 10 certificados recién cargados y paginación de biblioteca. Sin OCR de PDF escaneado, verificación externa de emisores, modificación retroactiva de CVs ni anexos en el PDF.

## Constitution Check

*GATE: revisado antes de investigación y después del diseño.*

| Principio | Decisión y resultado |
|---|---|
| I. Etapas incrementales | Se amplía el MVP de CV; generación sigue sincrónica y matching queda fuera. Cumple. |
| II. Contratos estructurados | La extracción devuelve JSON restringido; Pydantic valida antes de guardar; el servidor resuelve IDs y evita datos inventados. Cumple. |
| III. Renderizado cliente | Se conservan `CvPreview`, `renderCvPdf` y plantillas cliente; el backend solo prepara datos. Cumple. |
| IV. Seguridad | Supabase Auth, RLS, bucket privado y `user_id` en cada consulta; el servidor valida rutas de foto e IDs de certificados. Secretos solo en backend. Cumple. |
| V. Integración verificable | Se prevén pruebas de contratos, autorización, persistencia, UI y PDF. Cumple. |

**Reevaluación posterior al diseño**: Sin proveedores adicionales, sin cambio al motor de matching y sin excepciones a la constitución. El soporte de imágenes usa el despliegue Azure OpenAI existente solo tras una verificación de capacidad; si no admite visión, es un requisito de configuración para completar la feature, no un motivo para aceptar archivos sin procesarlos.

## Project Structure

### Documentation (this feature)

```text
specs/016-upload-certificates-cv-photo/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── certificates-api.md
│   └── cv-integration.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
backend/
├── app/api/                  # certificates.py; extender generate_cv.py y cv_imports.py
├── app/models/               # certificado de perfil; GenerateCvRequest y StructuredCv actuales
├── app/services/             # extracción, repositorio, combinación y validación de fotos
├── supabase/migrations/      # 010_user_certificates.sql; metadatos de idempotencia en resumes
└── tests/                    # contratos, servicios e integración
frontend/
├── app/generate/page.tsx
├── app/components/           # selector de certificados; cv-import-editor; basic-profile-modal
├── app/lib/                  # cliente de certificados; generate-cv-client; cv-pdf; profile-photo-client
├── app/types/                # tipos de certificado y CV
└── tests/                    # controles y PDF
tests/e2e/                    # flujo completo en navegador
```

**Structure Decision**: Mantener los módulos `api`, `models` y `services` de FastAPI, los componentes/clients de Next.js y las migraciones Supabase numeradas. El archivo de certificado se almacena una vez por perfil; `resumes.data` guarda una copia de sus datos estructurados para que cada CV histórico permanezca estable. La foto usa rutas inmutables del bucket actual; no borrar objetos que un CV pueda referenciar.

## Design Sequence

1. Migrar tabla/bucket y políticas de propiedad. Agregar repositorio y endpoints de biblioteca. La carga valida tamaño, firma, tipo, páginas, extracción, duplicados e idempotencia antes de publicar el registro.
2. Extender `/api/generate-cv` con IDs seleccionados, resolverlos por propietario y fusionar datos después de validar la respuesta IA y antes de persistir. En reintentos devolver exactamente el snapshot guardado.
3. Reutilizar `/api/resumes/{id}/versions` y `/api/cv-imports/{id}/versions` para guardar una versión con certificaciones seleccionadas y cambio de foto. El servidor aplica la combinación desde certificados propios y valida cualquier `photoPath` antes de guardar; la IA de edición no reescribe esas decisiones.
4. Añadir selector compartido a generación/editor y control de foto al editor. Resolver URL firmada para la vista previa; mantener `photoUrl` fuera de los payloads persistidos. Ajustar el manejo de foto de perfil y la política de Storage para no borrar archivos aún referenciados por CVs.
5. Probar aislamiento entre usuarios, duplicados y concurrencia, conflicto de idempotencia, imagen/PDF inválidos, versión original intacta y consistencia entre vista previa y descarga.

## Phase 0 and Phase 1 Outputs

- Decisiones y alternativas: [research.md](./research.md).
- Entidades, reglas y estados: [data-model.md](./data-model.md).
- Contratos de biblioteca y CV: [certificates-api.md](./contracts/certificates-api.md) y [cv-integration.md](./contracts/cv-integration.md).
- Validación manual y automatizada: [quickstart.md](./quickstart.md).
