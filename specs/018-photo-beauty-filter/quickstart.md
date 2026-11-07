# Guía de validación rápida: Filtro de belleza para foto de perfil

## Prerrequisitos

- Node.js y dependencias del frontend instaladas según `frontend/package.json`.
- Acceso a una cámara en el navegador si se valida manualmente la captura real.
- Los recursos locales de MediaPipe presentes en `frontend/public/mediapipe/`, incluido `selfie_segmenter.tflite`.

## Pruebas automatizadas

Desde `frontend/`, ejecutar:

```powershell
npm test -- tests/background-analyzer.test.ts tests/background-blur.test.ts tests/skin-smoothing.test.ts tests/camera-capture.test.tsx tests/basic-profile-modal.test.tsx
npx tsc --noEmit
npm run build
```

Resultado verificado: 5 archivos de prueba, 56 pruebas aprobadas; la verificación TypeScript y el build de producción finalizaron correctamente. Las pruebas cubren segmentación, máscara/composición del fondo, suavizado de piel, interruptor, selección, fallback, reintento, cancelación y limpieza de recursos sin depender de un servicio externo.

La comprobación de inferencia del modelo y la validación visual manual de cámara real en dispositivos móviles y de escritorio quedan pendientes; las pruebas automatizadas usan máscaras simuladas y no miden la calidad visual de los efectos. El servidor de desarrollo requerido para la prueba de navegador no estaba activo en `localhost:5173`.

## Validación manual de extremo a extremo

1. Iniciar el frontend desde `frontend/` con `npm run dev` y abrir el flujo de edición de perfil en un navegador con permiso de cámara.
2. Elegir «Usar cámara», tomar una foto válida y esperar la preparación de la revisión.
3. En escritorio, confirmar que «Original con fondo desenfocado» y «Embellecida» se muestran lado a lado en tamaño amplio; en móvil, cambiar entre ambas con el selector y verificar que la vista previa ocupa el ancho disponible. Confirmar que la persona permanece nítida y que la versión embellecida conserva ojos, cejas y boca.
4. Desactivar y reactivar «Desenfocar fondo» y comprobar ambas vistas, incluyendo la vista móvil seleccionada. En intentos separados, elegir cada alternativa con y sin desenfoque y comprobar la vista previa del perfil.
5. Repetir y cancelar la revisión; confirmar que no se selecciona ni guarda una imagen pendiente.
6. Probar sin una persona detectable o con la segmentación no disponible; confirmar que se muestra un aviso y se puede continuar con la foto sin efectos. Si solo falla el suavizado de piel, comprobar que sigue disponible la versión con fondo desenfocado.
7. Guardar el perfil y confirmar que solo se procesa/sube la foto elegida mediante el flujo actual.

## Resultados esperados

- El desenfoque empieza activado y puede desactivarse para ambas alternativas; el suavizado de piel solo aparece en «Embellecida».
- Un fallo de procesamiento nunca bloquea el uso de la imagen original.
- Repetir, cancelar y desmontar liberan la cámara y las vistas previas temporales.
- No se requieren cambios de backend, base de datos, secretos o dependencias.
