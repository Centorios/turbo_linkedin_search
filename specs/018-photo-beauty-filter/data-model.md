# Modelo de datos: Filtro de belleza para foto de perfil

El flujo no introduce persistencia ni entidades de servidor. Los datos siguientes son estado efímero de revisión en el navegador; una vez confirmada o cancelada la revisión, las referencias temporales se liberan.

## Entidades

### Captura original

- **file**: JPEG cuadrado capturado, 640×640; inmutable durante la revisión.
- **previewUrl**: URL temporal para mostrar la foto; se revoca al terminar el flujo.
- **source**: cámara.

### Foto con fondo desenfocado

- **file**: JPEG derivado de la captura, con la persona en primer plano y el fondo desenfocado.
- **previewUrl**: URL temporal de vista previa; se revoca al terminar el flujo.
- **availability**: disponible cuando la segmentación local de persona finaliza correctamente.

### Foto original de piel

- **file**: captura sin suavizado de piel, con o sin desenfoque según el interruptor.
- **relationship**: captura original o versión derivada mediante segmentación.

### Foto embellecida

- **file**: JPEG derivado de la captura, con suavizado sutil y con o sin desenfoque según el interruptor.
- **previewUrl**: URL temporal de vista previa; se revoca al terminar el flujo.
- **availability**: disponible o no disponible. Solo es disponible si los landmarks son válidos y el procesamiento local finaliza correctamente.
- **failureReason**: error de procesamiento, falta de un único rostro válido o falta de soporte del filtro; se muestra como aviso, no como una alternativa seleccionable.

### Foto seleccionada

- **file**: exactamente una de las alternativas confirmadas por el usuario.
- **relationship**: referencia lógica a la variante original o embellecida con el estado de desenfoque elegido.
- **lifecycle**: temporal hasta continuar al flujo existente de perfil; solo este archivo se valida, previsualiza y sube.

## Estados de revisión

```text
camera-ready -> processing -> review-ready -> selected
review-ready -> retake -> camera-ready
review-ready -> cancel -> closed
```

## Invariantes y validación

- La captura original no se modifica; el fondo desenfocado se crea en una alternativa derivada.
- La foto seleccionada debe ser exactamente la versión elegida y pasar por la validación de foto de perfil existente (JPEG, PNG o WebP; máximo 5 MB).
- El resultado procesado no debe incorporar información facial inferida ni almacenarla aparte de la propia foto seleccionada.
- Si falla la segmentación, la captura y, cuando sea posible, la versión embellecida sin desenfoque siguen siendo utilizables con un aviso.
- Si no hay un rostro único o faltan landmarks requeridos, la alternativa embellecida no se genera; la foto con fondo desenfocado sigue siendo utilizable.
- Ninguna alternativa sin confirmar continúa al guardado.
- Las URLs temporales se revocan al salir de revisión o desmontar el componente.
