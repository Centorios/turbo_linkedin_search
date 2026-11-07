# Implementation Plan: Filtro de belleza para foto de perfil

**Branch**: `018-photo-beauty-filter` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-photo-beauty-filter/spec.md`

## Summary

Al tomar una foto desde la cámara, la interfaz mostrará una revisión original y otra con suavizado sutil de piel, con un interruptor de fondo desenfocado activado inicialmente. La segmentación y el procesamiento se realizan localmente; el usuario elige una imagen antes de guardarla. Si falla la segmentación, las alternativas sin desenfoque disponibles siguen siendo seleccionables con un aviso.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19 y Next.js 15 (frontend existente).

**Primary Dependencies**: `@mediapipe/tasks-vision` ya instalado; modelos locales Face Landmarker y Selfie Segmenter; Canvas 2D nativo del navegador. No se agregan paquetes.

**Storage**: Sin cambios de almacenamiento. Las alternativas son temporales en memoria; solo la elegida continúa al flujo existente de guardado de perfil.

**Testing**: Vitest y React Testing Library, siguiendo `frontend/tests/camera-capture.test.tsx`; validación de tipos con el script de build existente si corresponde.

**Target Platform**: Navegadores modernos de escritorio y móviles con soporte para cámara; el procesamiento de imagen ocurre en el dispositivo.

**Project Type**: Aplicación web full-stack existente; esta entrega modifica solo el flujo de cámara y revisión del frontend.

**Performance Goals**: Generar la alternativa una sola vez por captura y reutilizar el resultado durante la revisión. Mantener la interfaz receptiva; ante demora o error de análisis, permitir seleccionar la original sin bloquear el flujo.

**Constraints**: Una imagen cuadrada de 640×640; desenfoque de fondo opcional de intensidad fija; suavizado de piel fijo y sutil; mantener nítida a la persona y no modificar rasgos; no enviar imágenes a servicios externos; no cambiar validación ni persistencia existentes.

**Scale/Scope**: Una captura temporal y hasta tres versiones derivadas por revisión de foto de perfil; sin cambios de backend, base de datos, APIs o contrato de guardado.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Estado | Evidencia |
|---|---|---|
| Mantener la arquitectura y el alcance de la entrega | PASS | El cambio queda en el frontend y usa el flujo de cámara/perfil existente; no incorpora servicios ni persistencia nuevos. |
| Procesar los datos localmente y proteger la foto | PASS | La foto original no se envía para aplicar el efecto; solo la alternativa que el usuario elige sigue al guardado ya existente. |
| Simplicidad verificable y sin dependencias injustificadas | PASS | Se reutilizan MediaPipe, sus recursos locales y Canvas 2D; no se agrega biblioteca o proveedor. |
| Validar las interfaces críticas | PASS | Se prueban la comparación, la selección, el descarte/reintento y el fallback; los selectores nuevos usan `data-testid` cuando las pruebas lo necesiten. |
| Persistencia/contrato del CV | N/A | No se cambia el modelo del CV, el backend ni sus endpoints. |

**Pre-design gate**: PASS. No se detectan desviaciones de la constitución.

## Project Structure

### Documentation (this feature)

```text
specs/018-photo-beauty-filter/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── photo-selection-ui.md
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── components/
│   │   ├── camera-capture.tsx       # Captura y revisión/selección de versiones
│   │   └── basic-profile-modal.tsx   # Integración con la selección de foto existente
│   └── lib/
│       ├── background-analyzer.ts   # Segmentación local de persona/fondo
│       ├── background-blur.ts       # Composición del fondo desenfocado
│       ├── face-analyzer.ts         # Acceso a landmarks locales
│       └── use-expression-check.ts  # Reutilización segura de análisis existente
└── tests/
    ├── background-blur.test.ts      # Máscara y composición local
    └── camera-capture.test.tsx      # Estados, selección y fallback
```

**Structure Decision**: Extender el flujo de cámara del frontend en sus componentes y analizador existentes, manteniendo el callback de foto como límite hacia el guardado del perfil. Añadir lógica pura de proyección/máscara y pruebas unitarias cercanas a `frontend/app/lib/` y `frontend/tests/` solo si el diseño final necesita separar esos cálculos.

## Constitution Check (Post-Design)

| Gate | Estado | Evidencia |
|---|---|---|
| Separación entre frontend, backend, almacenamiento y servicios externos | PASS | La transformación ocurre en el frontend; no se agregan llamadas ni contratos de red. |
| Datos profesionales y foto privados | PASS | La captura y ambas alternativas permanecen en memoria del navegador hasta que se elige una; el guardado sigue siendo explícito. |
| Complejidad adicional justificada | PASS | El suavizado local se limita al rostro detectado para proteger ojos, cejas, boca y fondo; solo se agrega el control de desenfoque, sin filtros adicionales ni servicio externo. |
| Pruebas de comportamiento e identificadores estables | PASS | Los estados accesibles y controles se cubren con Vitest/Testing Library y `data-testid` cuando corresponda. |

**Post-design gate**: PASS. No se identifican violaciones que requieran excepciones.

## Complexity Tracking

No hay violaciones de la constitución.
