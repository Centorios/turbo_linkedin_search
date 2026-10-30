# Implementation Plan: Dictado por voz con botón de micrófono

**Branch**: `feat/dictado-por-voz` | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-voice-dictation/spec.md`

## Summary

Agregar un botón de micrófono reutilizable (`VoiceInputField`) que usa el reconocimiento de voz del
navegador (Web Speech API, `SpeechRecognition` / `webkitSpeechRecognition`) para dictar en español
de Argentina y **agregar** cada frase confirmada al final de un campo de texto. Se integra en el campo
principal de `/generate` (US1) y en cada respuesta del asistente de trayectoria (US2). Todo ocurre en el
frontend; no cambian backend, base de datos ni contratos.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19, Next.js 15 (App Router, componentes cliente)

**Primary Dependencies**: ninguna nueva. API del navegador `SpeechRecognition` (con prefijo `webkit` en Chrome/Edge/Safari)

**Storage**: N/A (estado efímero en memoria)

**Testing**: Vitest + Testing Library (jsdom, con un `SpeechRecognition` falso); Playwright E2E con un reconocedor falso inyectado por `addInitScript`

**Target Platform**: navegadores modernos; Chrome/Edge/Safari con dictado, Firefox sin botón

**Project Type**: web application (frontend Next.js + backend FastAPI; solo cambia el frontend)

**Performance Goals**: el texto confirmado aparece en el campo en el mismo evento `result` (sin esperas propias)

**Constraints**: contexto seguro (HTTPS o `localhost`) para el micrófono; sin dependencias nuevas (AGENTS.md); textos en rioplatense con voseo (docs/desarrollo.md#textos-y-tono)

**Scale/Scope**: 1 hook, 1 componente, 1 ícono, 2 pantallas integradas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Etapas incrementales | ✅ | Mejora la ingesta de la Etapa 1; el flujo texto → CV no cambia. |
| II. Contratos estructurados | ✅ | El dictado produce texto plano que entra al mismo `/api/generate-cv` y al mismo asistente. Sin cambios de esquema. |
| III. Renderizado en el cliente | ✅ | Todo en React/Next.js; el backend no participa. |
| IV. Seguridad y aislamiento | ⚠️ Justificado | La app no recibe, guarda ni registra audio. El reconocedor es del navegador; en Chrome el audio lo procesa el servicio del fabricante del navegador. No hay credenciales, SDK ni integración del proyecto con un proveedor, por eso no se considera "proveedor adicional" del stack; se documenta en `docs/desarrollo.md` para la revisión de privacidad (ver Complexity Tracking). |
| V. Simplicidad verificable | ✅ | Sin dependencias; pruebas de comportamiento (Vitest) y E2E para la UI crítica de ingreso. |
| Technology and Scope | ✅ | Solo React/Next.js. Flujo de generación sincrónico intacto. |
| Quality gates | ✅ | `data-testid` estables: `voice-input-<id>`, `voice-input-status-<id>`, `voice-input-error-<id>`. |

**Re-check post-design**: sin cambios; el diseño (research.md, contracts/ui.md) mantiene todo en el cliente.

## Project Structure

### Documentation (this feature)

```text
specs/015-voice-dictation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── lib/
│   │   └── speech-dictation.ts          # NUEVO: detección, hook useSpeechDictation, appendDictation, mensajes
│   ├── components/
│   │   ├── voice-input-field.tsx       # NUEVO: botón de micrófono + estado/errores accesibles
│   │   ├── icons.tsx                    # + MicrophoneIcon
│   │   └── trajectory-assistant.tsx     # US2: micrófono por respuesta
│   ├── generate/page.tsx                # US1: micrófono en "Biografía o experiencia profesional"
│   └── globals.css                      # animación de "escuchando"
└── tests/
    ├── speech-dictation.test.ts         # NUEVO
    └── voice-input-field.test.tsx      # NUEVO
tests/e2e/
└── voice-dictation.spec.ts              # NUEVO
docs/desarrollo.md                       # nueva sección "Dictado por voz"
```

**Structure Decision**: aplicación web existente; el cambio es solo de `frontend/`, siguiendo el patrón de
`camera-capture.tsx` (detección de soporte después de montar, liberar el dispositivo siempre, mensajes por
nombre de error).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Audio procesado por el servicio de voz del navegador (principio IV, datos fuera de la app) | Es la única forma de dictar sin dependencias, claves ni backend nuevos | Azure AI Speech desde FastAPI exige SDK, credenciales, endpoint de subida de audio y una enmienda de constitución por proveedor nuevo; desproporcionado para un botón de dictado. Queda como evolución si se requiere que el audio no salga del stack. |
