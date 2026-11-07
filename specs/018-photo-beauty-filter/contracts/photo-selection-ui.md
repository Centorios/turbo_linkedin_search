# Contrato de interfaz: selección de foto de perfil

## Alcance

Contrato interno entre la captura de cámara, la revisión de alternativas y el flujo existente de edición del perfil. No se agregan endpoints, formatos de red ni cambios en el contrato de guardado.

## Flujo y estados observables

| Estado | Interfaz requerida | Acciones |
|---|---|---|
| Captura lista | Vista de cámara y acción para tomar la foto | Tomar foto o cancelar |
| Procesando | Indicador accesible de generación, sin controles repetidos de captura | Esperar; cancelar si el flujo existente lo permite |
| Comparación disponible | Imágenes etiquetadas «Original» y «Embellecida»; el interruptor de desenfoque empieza activado y afecta ambas imágenes; en móvil se pueden alternar | Cambiar desenfoque, usar original, usar embellecida, tomar otra o cancelar |
| Suavizado no disponible | Original con o sin fondo desenfocado, aviso de que no se pudo suavizar la piel | Cambiar desenfoque, usar original, tomar otra o cancelar |
| Segmentación no disponible | Captura sin desenfoque y, si está disponible, versión embellecida; aviso y control desactivado | Usar una versión disponible, tomar otra o cancelar |
| Confirmada | El callback de foto existente recibe el archivo seleccionado y la captura se cierra | Continúa al flujo de perfil |

## Reglas

- La revisión debe distinguir visualmente y mediante texto alternativo/etiquetas cuál foto es original y cuál está embellecida.
- La selección es explícita; ninguna alternativa se confirma automáticamente al terminar el procesamiento.
- «Tomar otra» descarta ambas versiones temporales y vuelve a la cámara sin conservar una selección previa.
- «Cancelar» descarta ambas versiones temporales y no llama al callback de selección.
- La cámara se detiene durante la comparación; las URLs temporales se liberan al confirmar, repetir, cancelar o desmontar.
- El desenfoque es opcional, comienza activado en cada captura y se aplica a ambas alternativas; solo «Embellecida» suaviza la piel.
- Si falla la segmentación, la captura sin efectos permanece seleccionable y el aviso no bloquea la continuación.
- Los controles deben ser utilizables con teclado y lectores de pantalla, y conservar los mensajes en español rioplatense.

## Límite con el flujo existente

El callback de captura/selección recibe un `File` JPEG cuando la persona confirma una alternativa. El consumidor actual sigue validando y mostrando la foto seleccionada; la subida ocurre únicamente cuando se guarda el perfil, sin enviar la foto original al procesador.
