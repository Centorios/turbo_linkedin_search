# Contrato de interfaz: Eliminar desde el historial

## Acción por CV

- Cada elemento propio del historial presenta una acción accesible **Eliminar CV**.
- Antes de enviar la solicitud, se muestra una confirmación nativa que incluye el nombre del CV e informa que la eliminación es permanente y que también se borrarán búsquedas y resultados asociados.
- Cancelar no cambia la lista ni la vista previa.
- Mientras una solicitud está en curso, la acción para ese CV queda deshabilitada.

## Éxito

- El elemento se retira solo después de recibir la respuesta exitosa.
- Si ese CV estaba abierto, se cierra su vista previa.
- Si la página queda sin elementos y no es la primera, se carga la página anterior; si no quedan CVs, se muestra el estado vacío existente.
- Los demás elementos y el detalle del CV no relacionado permanecen intactos.

## Error y cambio de cuenta

- Ante un error, el elemento permanece en el historial y se muestra un mensaje explícito con opción de reintento.
- Un cambio o cierre de sesión limpia inmediatamente los datos de la cuenta anterior y descarta respuestas tardías de eliminación; la interfaz no promete revertir una petición que el servidor ya recibió.
- La interfaz debe exponer `data-testid` estables para el botón de eliminación por CV y el estado de error, siguiendo las convenciones existentes de la página.
