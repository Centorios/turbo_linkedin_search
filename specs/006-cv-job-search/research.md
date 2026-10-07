# Research: Fuente de empleos para Argentina

## Decisión

Usar la [API REST de Jooble Argentina](https://ar.jooble.org/api/about) para la primera búsqueda. Jooble documenta búsqueda por `keywords` y `location`, resultados aptos para mostrar en un sitio propio y una clave específica por país. La [documentación técnica](https://help.jooble.org/es/support/solutions/articles/60001448238-documentaci%C3%B3n-de-la-api-rest) indica 500 solicitudes de por vida para el plan gratuito; por eso no se consulta automáticamente al abrir la página y se cachean consultas idénticas de forma temporal.

## Alternativas consideradas

- LinkedIn: las [permisiones abiertas](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) no incluyen buscar ofertas y su [Job Posting API](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview) publica puestos para socios autorizados. Sus [términos de crawling](https://www.linkedin.com/legal/crawling-terms) requieren permiso expreso. No se incorpora scraping.
- Adzuna: ofrece [búsqueda por palabras y ubicación](https://developer.adzuna.com/docs/search), pero no se comprobó cobertura argentina en su documentación. No se usa como fuente inicial.
- Greenhouse y Lever: sus APIs públicas listan puestos por empresa, no ofrecen una búsqueda amplia en Argentina sin mantener un catálogo de empresas.

## Riesgos y mitigaciones

- **Clave no disponible**: respuesta de configuración faltante; la UI explica que aún no puede consultar ofertas. No se usa una clave de otro país.
- **Cuota limitada**: una llamada por acción y caché temporal por proceso; antes de escalar habrá que acordar un plan del proveedor o una fuente con mayor cuota.
- **Datos incompletos**: se rechazan filas sin título, ID o enlace HTTPS; campos opcionales reciben un valor de presentación seguro.
- **Resultado textual**: no se presenta como afinidad calculada por embeddings.
