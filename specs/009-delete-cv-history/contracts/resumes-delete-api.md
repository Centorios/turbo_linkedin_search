# Contrato API: Eliminar una versión de CV

## `DELETE /api/resumes/{resume_id}`

Requiere `Authorization: Bearer <token de sesión Supabase>`. No recibe cuerpo. La identidad y propiedad se resuelven en el backend.

### Respuesta exitosa

`204 No Content`, sin cuerpo. La versión ya no está disponible en lista ni detalle. Las búsquedas, embeddings y análisis dependientes se eliminan por las relaciones existentes. No se eliminan imágenes compartidas del perfil.

### Errores

| HTTP | Código | Comportamiento |
|---|---|---|
| 401 | `unauthorized` | No hay sesión válida; no se modifica ningún dato. |
| 404 | `resume_not_found` | UUID inexistente o perteneciente a otra cuenta; respuesta indistinguible en ambos casos. |
| 422 | validación | El UUID de ruta no es válido. |
| 500 | `resume_delete_failed` | Fallo genérico, sin detalles de la persistencia ni del CV. |

La búsqueda del recurso y la autorización deben limitarse por el ID del CV y el `user_id` autenticado. No se devuelve información del CV eliminado.
