# Implementation Plan: Verificación de expresión neutra en la foto de cámara

**Branch**: `017-neutral-expression-photo` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-neutral-expression-photo/spec.md`

## Summary

Ampliar `CameraCapture` (spec 013) con un analizador de rostro basado en MediaPipe Face Landmarker que corre
en el navegador. Mientras la cámara está abierta muestra un indicador en vivo (sin rostro, varios rostros,
encuadre/orientación, ojos, boca, sonrisa, cejas, "Listo"). Al tocar "Tomar foto" evalúa una ventana de los
últimos 5 fotogramas: si es neutra, entrega el JPEG como hoy; si no, descarta la captura y muestra qué mejorar
sin cerrar la cámara. Nunca captura sola. Si el analizador no carga, la cámara funciona como hoy con un aviso.
No cambian backend, base de datos ni contratos; el video nunca sale del dispositivo.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19, Next.js 15 (App Router, componentes cliente)

**Primary Dependencies**: **nueva** `@mediapipe/tasks-vision` (Apache-2.0, versión exacta fijada, sin `^`); resto sin cambios

**Storage**: N/A (veredicto efímero en memoria; modelo `face_landmarker.task` y WASM versionados como estáticos en `frontend/public/mediapipe/`)

**Testing**: Vitest + Testing Library con un analizador falso inyectado; pruebas unitarias de las funciones puras de evaluación; Playwright E2E con cámara falsa de Chromium (ruta "sin rostro")

**Target Platform**: navegadores modernos con WebAssembly (GPU WebGL con respaldo a CPU); sin soporte → cámara sin verificar

**Project Type**: web application (frontend Next.js + backend FastAPI; solo cambia el frontend)

**Performance Goals**: análisis ~10 fps; indicador en vivo reacciona en < 1 s (SC-002); carga del analizador en paralelo al permiso de cámara, ≤ 3 s extra tras la primera carga (SC-007)

**Constraints**: AGENTS.md exige consultar antes de instalar dependencias (pendiente de aprobación); sin enviar video/imágenes a terceros; textos en rioplatense con voseo; `data-testid` estables; la cámara y el análisis se apagan juntos al desmontar

**Scale/Scope**: 1 módulo de lógica pura, 1 cargador del analizador, 1 hook, cambios en 1 componente, 1 test nuevo + ajustes al de cámara

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Etapas incrementales | ✅ | Mejora la ingesta de foto del CV (Etapa 1); el flujo texto → CV no cambia. |
| II. Contratos estructurados | ✅ | Sin cambios de esquema; la foto sigue entrando por la misma validación y subida (JPEG 640×640). |
| III. Renderizado en el cliente | ✅ | Todo en React/Next.js; el backend no participa. |
| IV. Seguridad y aislamiento | ✅ | El análisis es local; modelo y WASM se sirven desde la propia app; ningún fotograma se envía ni se guarda. Sin credenciales ni proveedor externo. |
| V. Simplicidad verificable | ✅ | Lógica de decisión pura y testeable; analizador inyectable; pruebas de comportamiento para la UI crítica. |
| Technology and Scope | ⚠️ Justificado | Agrega una librería cliente (no un proveedor/servicio). Pedida explícitamente por el usuario. Ver Complexity Tracking. |
| Quality gates | ✅ | `data-testid` estables definidos en `contracts/ui.md`. |

**Re-check post-design**: sin cambios; el diseño mantiene todo en el cliente y sin proveedores nuevos.

## Project Structure

### Documentation (this feature)

```text
specs/017-neutral-expression-photo/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui.md
├── checklists/
│   └── requirements.md
└── tasks.md              # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
frontend/
├── app/
│   ├── lib/
│   │   ├── expression-check.ts        # NUEVO: umbrales, evaluateFrame, summarizeWindow, mensajes (puro)
│   │   ├── face-analyzer.ts           # NUEVO: carga dinámica de MediaPipe y analyze(video, ts) → FrameSample
│   │   └── use-expression-check.ts    # NUEVO: hook (bucle ~10 fps, historial de 5, estado en vivo, check())
│   └── components/
│       └── camera-capture.tsx         # indicador en vivo, verificación al tomar foto, rechazo, aviso sin verificar
├── public/
│   └── mediapipe/
│       ├── face_landmarker.task       # NUEVO: modelo (~3.7 MB), versionado
│       └── wasm/                      # NUEVO: WASM de tasks-vision (~40 MB en disco, el navegador descarga una variante de ~14 MB), versionados; deben coincidir con la versión exacta de la dependencia
├── tests/
│   ├── expression-check.test.ts       # NUEVO: umbrales, ventana 4/5, prioridad de mensajes
│   ├── mediapipe-assets.test.ts       # NUEVO: los WASM de public/mediapipe/wasm coinciden con node_modules (versión y archivos)
│   └── camera-capture.test.tsx        # + escenarios con analizador falso
└── package.json                       # + dependencia (versión exacta)
```

**Structure Decision**: Web application existente; se mantiene la separación por capas del frontend
(`app/lib` para lógica, `app/components` para UI). La decisión de "neutra" vive en una función pura sin
dependencias de MediaPipe, de modo que el analizador sea reemplazable (p. ej. por un falso en pruebas).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Nueva dependencia cliente `@mediapipe/tasks-vision` (fuera de la lista literal del stack) | El usuario pidió MediaPipe para detectar expresión en el navegador sin enviar video a terceros | Un servicio en la nube enviaría imágenes a un tercero (contra FR-008); `face-api.js` fue descartada por el usuario |
| Binarios WASM (~40 MB) versionados en `public/mediapipe/wasm/` | MediaPipe necesita sus WASM servidos desde el mismo origen; así los colaboradores y Vercel no ejecutan scripts extra | Script `postinstall` (falla con `--ignore-scripts`) o CDN externo (privacidad y disponibilidad); riesgo de desfase mitigado fijando la versión exacta |
