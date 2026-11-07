# Investigación: Filtro de belleza para foto de perfil

## Decisión

Generar en el dispositivo versiones con y sin fondo desenfocado mediante MediaPipe Image Segmenter (Selfie Segmenter) y Canvas 2D, con un interruptor activado por defecto. Aplicar el suavizado sutil, limitado por landmarks de MediaPipe Face Landmarker, solo a la alternativa embellecida. La segmentación usa el modelo local `frontend/public/mediapipe/selfie_segmenter.tflite`, obtenido de [Google MediaPipe Model Storage](https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite) (249,537 bytes); no se carga desde la red durante el uso.

Si falla la segmentación, se informa y se ofrecen las variantes disponibles sin desenfoque. Si falla el suavizado, se conserva la original con y sin desenfoque cuando sea posible. Si solo falla el suavizado de la variante desenfocada, se informa y se puede desactivar el desenfoque para elegir la embellecida.

## Rationale

- `frontend/app/lib/face-analyzer.ts` ya carga `@mediapipe/tasks-vision` dinámicamente, usa el modelo `frontend/public/mediapipe/face_landmarker.task` y puede intentar GPU con fallback a CPU.
- `@mediapipe/tasks-vision` expone `ImageSegmenter`; el modelo de selfie segmentation se incluye junto al modelo facial y los archivos WASM, sin descargar recursos durante la captura ni incorporar paquetes nuevos.
- `frontend/app/components/camera-capture.tsx` ya recorta a 640×640 y genera JPEG mediante Canvas 2D, que puede producir la alternativa en el mismo dispositivo.
- La máscara de persona permite desenfocar el fondo y conservar a la persona; la máscara facial limita el suavizado para reducir la pérdida de detalle en ojos, cejas y boca.
- Un único procesamiento por captura mantiene el costo limitado; se conserva el resultado mientras el usuario compara las imágenes.
- Ante falta de segmentación, una captura original seleccionable es más segura que aplicar un desenfoque global que altere a la persona.

## Alternatives Considered

- **Desenfocar toda la foto**: descartado porque reduce el detalle de ojos, cejas, boca y fondo, y no satisface el objetivo de suavizar solo la piel.
- **Filtro bilateral escrito en JavaScript o procesamiento píxel a píxel**: descartado porque agrega complejidad y puede bloquear el hilo de interfaz en móviles sin aportar una necesidad de alcance para el efecto sutil solicitado.
- **WebGL o shaders**: descartado por el costo de implementación y pruebas, desproporcionado para un efecto fijo de baja intensidad.
- **SDK o biblioteca de belleza de terceros**: descartado para evitar una dependencia nueva, controles o efectos fuera del alcance, y procesamiento externo no necesario.
- **Procesamiento en backend/servicio**: descartado porque la aclaración exige procesar la foto en el dispositivo.
- **Suavizado sin rostro detectable**: descartado para evitar editar regiones equivocadas; se mantiene la alternativa original con un mensaje.
- **Desenfocar toda la foto**: descartado porque perdería nitidez en la persona; se segmenta el primer plano y se recompone sobre el fondo desenfocado.

## Riesgos y mitigaciones

- **Máscara visible o con halo**: difuminar suavemente el borde de la máscara y revisar el resultado en distintos tonos de piel y tamaños de pantalla.
- **Landmarks incompletos o fuera de posición**: validar el único rostro y los contornos necesarios antes de crear la alternativa; ante datos inválidos, usar el fallback original.
- **Demora en móviles**: limitar la detección y el renderizado a una sola operación por captura; mostrar un estado de procesamiento y mantener la selección original disponible.
- **Compatibilidad del filtro Canvas**: comprobar que el contexto admite el efecto requerido; si no, no generar la alternativa y mostrar la original.
- **Liberación de recursos**: cerrar la cámara al pasar a revisión y revocar URLs temporales al seleccionar, cancelar, repetir la captura o desmontar el componente.

## Testing Approach

- Probar las transiciones de captura, procesamiento, comparación, selección, cancelación y repetición con React Testing Library.
- Probar como lógica pura la proyección de landmarks y exclusión de ojos, cejas y boca usando fixtures, si esa lógica se separa.
- Simular falta de rostro, landmarks inválidos, fallo de Canvas y ausencia de soporte; en cada caso comprobar que la foto original puede seleccionarse.
- Probar máscara de persona válida, máscara inválida y fallback a la captura sin efectos cuando falla la segmentación.
- Revisar visualmente en navegadores de escritorio y móviles que el efecto sea sutil y no difumine los rasgos protegidos; las pruebas automatizadas no deben afirmar calidad visual a partir de mocks de Canvas.
