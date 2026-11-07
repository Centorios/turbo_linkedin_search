# Modelo de datos: Filtro de belleza para foto de perfil

El flujo no introduce persistencia ni entidades de servidor. Los datos siguientes son estado efímero de revisión en el navegador; una vez confirmada o cancelada la revisión, las referencias temporales se liberan.

## Entidades

### Foto original

- **file**: JPEG cuadrado capturado, 640×640; inmutable durante la revisión.
- **previewUrl**: URL temporal para mostrar la foto; se revoca al terminar el flujo.
- **source**: cámara.

### Foto embellecida

- **file**: JPEG derivado de la foto original, con suavizado sutil en la región de piel detectada.
- **previewUrl**: URL temporal de vista previa; se revoca al terminar el flujo.
- **availability**: disponible o no disponible. Solo es disponible si los landmarks son válidos y el procesamiento local finaliza correctamente.
- **failureReason**: error de procesamiento, falta de un único rostro válido o falta de soporte del filtro; se muestra como aviso, no como una alternativa seleccionable.

### Foto seleccionada

- **file**: exactamente una de las alternativas confirmadas por el usuario.
- **relationship**: referencia lógica a Foto original o Foto embellecida.
- **lifecycle**: temporal hasta continuar al flujo existente de perfil; solo este archivo se valida, previsualiza y sube.

## Estados de revisión

```text
camera-ready -> processing -> comparison-ready -> selected
                         \-> original-only -> selected
comparison-ready -> retake -> camera-ready
comparison-ready -> cancel -> closed
original-only -> retake -> camera-ready
original-only -> cancel -> closed
```

## Invariantes y validación

- La foto original no se modifica al crear la alternativa.
- La foto seleccionada debe ser exactamente la versión elegida y pasar por la validación de foto de perfil existente (JPEG, PNG o WebP; máximo 5 MB).
- El resultado procesado no debe incorporar información facial inferida ni almacenarla aparte de la propia foto seleccionada.
- Si no hay un rostro único o faltan landmarks requeridos, la foto embellecida no se genera; la original sigue siendo utilizable.
- Ninguna alternativa sin confirmar continúa al guardado.
- Las URLs temporales se revocan al salir de revisión o desmontar el componente.
