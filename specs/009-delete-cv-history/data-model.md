# Modelo de datos: Eliminar CVs del historial de la cuenta

## Versión de CV

Registro existente de `resumes`, identificado por `id` y vinculado a `user_id`.

- El propietario se deriva de la sesión autenticada.
- El cliente solo selecciona el ID de la versión.
- El borrado requiere simultáneamente el ID solicitado y el usuario autenticado.
- No se cambia la estructura ni la validación del JSON `data`.

## Datos derivados

Conjunto de registros vinculados a una versión mediante claves foráneas:

- búsquedas de empleo iniciadas desde la versión;
- embedding de la versión;
- resultados de matching de esas búsquedas;
- recomendaciones contenidas en los resultados.

Al eliminar la versión, se eliminan sus dependencias según las relaciones en cascada ya definidas. Los CVs no relacionados permanecen intactos. No se borran el perfil de cuenta ni las imágenes que puedan usarse fuera de la versión eliminada.

## Solicitud y resultado

La solicitud contiene únicamente el UUID del CV en la ruta y una sesión válida. No acepta `user_id` del cliente.

- Éxito: respuesta vacía y el historial deja de exponer el CV.
- No encontrado o ajeno: mismo resultado observable, sin modificación.
- Error de persistencia: la operación se informa como fallida; la interfaz conserva el CV y permite reintentar.

## Estado de interfaz

`idle → confirming → deleting → deleted | error`

- Cancelar `confirming` vuelve a `idle` sin cambiar datos.
- El registro se conserva mientras está `deleting`.
- `deleted` retira el elemento y cierra la vista previa si corresponde.
- `error` conserva el elemento, muestra un mensaje y permite volver a `confirming`.
