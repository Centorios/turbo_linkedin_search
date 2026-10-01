# Resume History API

Bearer obligatorio; propietario exclusivamente desde require_user_id. No cambios al POST /api/generate-cv: persiste automáticamente cada generación exitosa.

## GET /api/resumes?offset=0&limit=20
200: `{items:[{id,createdAt,fullName,summary}],offset,limit,hasMore}`. Orden created_at DESC, id DESC. Sin datos completos ni user_id en la lista. Offset 0..100000, limit 1..50. Página vacía: items=[], hasMore=false. 401 sin sesión válida; 422 parámetros inválidos; 500 error genérico sin detalles de almacenamiento ni CV.

## GET /api/resumes/{resume_id}
UUID requerido. 200: `{id,createdAt,data:StructuredCv}` validado y original. 404 idéntico para ID inexistente o ajeno. 401 no autenticado; 422 UUID inválido; 500 lectura/validación falla sin detalles privados. Nunca consulta Azure ni perfil actual.

## UI
Historial accesible desde cabecera, ruta /history protegida. Testids: history-navigation, history-loading, history-empty, history-error, history-retry, history-item-{id}, history-next, history-previous, history-detail-loading, history-detail-error. Reutiliza cv-preview, template-ats, template-creative, pdf-download. Cambio de cuenta limpia datos y aborta solicitudes. Foto no disponible no bloquea lectura del texto.
