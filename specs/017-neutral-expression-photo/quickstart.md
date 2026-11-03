# Quickstart: validar la verificación de expresión neutra

## Prerrequisitos

- Dependencia `@mediapipe/tasks-vision` instalada (`npm install` en `frontend/`).
- Modelo en `frontend/public/mediapipe/face_landmarker.task` y WASM en `frontend/public/mediapipe/wasm/` (ambos versionados).
- Backend y frontend levantados como en [docs/levantar-entorno-demo.md](../../docs/levantar-entorno-demo.md); sesión iniciada.

## Pruebas automáticas

```powershell
cd frontend
npm test            # Vitest: expression-check y camera-capture
npm run test:e2e    # Playwright: ruta "sin rostro" con cámara falsa
```

Resultado esperado: todas en verde; `camera-capture.test.tsx` cubre captura aceptada, rechazo, no evaluable,
verificación no disponible y apagado de la cámara.

## Validación manual (cámara real)

1. Abrir Editar perfil → "Usar cámara" y dar permiso. El indicador `camera-expression-status` aparece en menos de 3 s.
2. Cara neutra de frente: el indicador muestra "Listo, expresión neutra". No se toma ninguna foto sola.
3. Sonreír ampliamente: el indicador pide relajar la sonrisa en menos de 1 s. Tocar "Tomar foto": aparece `camera-expression-rejection`, la cámara sigue activa y no se carga ninguna foto.
4. Sonrisa muy leve con labios cerrados: la foto se acepta.
5. Tapar la cámara o salir de cuadro y tocar "Tomar foto": se rechaza con el mensaje de más luz / mostrar el rostro.
6. Repetir 5 rechazos seguidos: nunca aparece una opción para usar la foto rechazada.
7. Neutra de frente + "Tomar foto": se carga la foto y se sigue el flujo normal (guardar perfil).
8. Bloquear la carga de `/mediapipe/*` (DevTools → bloquear URL): aparece el aviso de que no se verificará y la foto se puede tomar igual.
9. "Buscar" sigue subiendo un archivo sin verificación.
10. Cerrar o cancelar la cámara: la luz de la cámara se apaga.

## Calibración de umbrales

Registrar ~20 capturas (neutras, sonrisa leve/amplia, boca abierta, ojos cerrados) y comprobar SC-003
(≥ 95 % de claramente no neutras rechazadas, ≥ 90 % de claramente neutras aceptadas). Ajustar solo
`EXPRESSION_THRESHOLDS`.
