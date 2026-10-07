# Data Model: Búsqueda de empleos desde un CV

## CV guardado

Se lee de `resumes` mediante `user_id` e `id`. El JSON se valida con `StructuredCv` antes de derivar sugerencias. No se modifica la tabla.

## Perfil de búsqueda

Objeto transitorio: `resumeId`, `suggestedKeywords` (2-120 caracteres o vacío), `suggestedLocation` (2-100 caracteres) y `skills` (hasta seis habilidades técnicas del CV). El puesto de la primera experiencia no vacía es la sugerencia inicial; si no hay puesto, se unen hasta tres habilidades técnicas. La ubicación proviene del CV o usa `Argentina`.

## Solicitud de búsqueda

`resumeId` UUID obligatorio, `keywords` de 2 a 120 caracteres y `location` de 2 a 100 caracteres. Se recortan espacios. La propiedad del CV se valida incluso cuando el usuario edita la consulta. No contiene datos personales.

## Oferta normalizada

`id` de fuente, `title`, `company`, `location`, `snippet`, `url`, `source` y `updatedAt` opcional. Identificadores duplicados se eliminan en la respuesta. En esta entrega no se persisten ofertas ni perfiles de búsqueda.
