# Investigación: Filtro de belleza para foto de perfil

## Decisión

Generar en el dispositivo una sola alternativa con suavizado sutil usando Canvas 2D nativo y una máscara basada en landmarks del rostro provistos por MediaPipe Face Landmarker. La máscara cubre el interior del óvalo facial y excluye ojos, cejas y boca; la imagen original permanece intacta. El radio de suavizado y la mezcla deben ser fijos y conservadores, ajustados visualmente en la implementación sin exponer controles al usuario.

Si no se obtiene un único rostro con landmarks válidos, el navegador no soporta el filtro requerido o se produce un error de procesamiento, no se presenta una versión suavizada: se informa el problema y se conserva la opción original.

## Rationale

- `frontend/app/lib/face-analyzer.ts` ya carga `@mediapipe/tasks-vision` dinámicamente, usa el modelo `frontend/public/mediapipe/face_landmarker.task` y puede intentar GPU con fallback a CPU.
- El proyecto ya contiene el modelo y los archivos WASM localmente; no requiere descargar recursos del proveedor durante la captura ni incorporar paquetes nuevos.
- `frontend/app/components/camera-capture.tsx` ya recorta a 640×640 y genera JPEG mediante Canvas 2D, que puede producir la alternativa en el mismo dispositivo.
- La máscara facial evita aplicar el suavizado a toda la foto y reduce la pérdida de detalle en rasgos que deben conservarse.
- Un único procesamiento por captura mantiene el costo limitado; se conserva el resultado mientras el usuario compara las imágenes.
- Ante falta de landmarks, una imagen original seleccionable es más segura que aplicar un desenfoque global que altere ojos, labios, pelo o fondo.

## Alternatives Considered

- **Desenfocar toda la foto**: descartado porque reduce el detalle de ojos, cejas, boca y fondo, y no satisface el objetivo de suavizar solo la piel.
- **Filtro bilateral escrito en JavaScript o procesamiento píxel a píxel**: descartado porque agrega complejidad y puede bloquear el hilo de interfaz en móviles sin aportar una necesidad de alcance para el efecto sutil solicitado.
- **WebGL o shaders**: descartado por el costo de implementación y pruebas, desproporcionado para un efecto fijo de baja intensidad.
- **SDK o biblioteca de belleza de terceros**: descartado para evitar una dependencia nueva, controles o efectos fuera del alcance, y procesamiento externo no necesario.
- **Procesamiento en backend/servicio**: descartado porque la aclaración exige procesar la foto en el dispositivo.
- **Suavizado sin rostro detectable**: descartado para evitar editar regiones equivocadas; se mantiene la alternativa original con un mensaje.

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
- Revisar visualmente en navegadores de escritorio y móviles que el efecto sea sutil y no difumine los rasgos protegidos; las pruebas automatizadas no deben afirmar calidad visual a partir de mocks de Canvas.
