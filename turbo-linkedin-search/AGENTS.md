# AGENTS.md

## Proyecto

CV8 es una webapp inteligente para asistir al usuario en la búsqueda laboral mediante modelos de IA.

## MVP

- El usuario ingresa por texto o archivo información sobre sus características, experiencia, estudios, habilidades y otros datos relevantes de su perfil profesional.
- La aplicación envía esa información a un modelo de IA mediante una API.
- El modelo analiza el perfil y genera diferentes versiones de CV.
- La aplicación muestra las versiones para que el usuario elija la más adecuada.

## Producto final

- Incorporar un agente o modelo capaz de buscar ofertas laborales que coincidan con el perfil del usuario.
- Evaluar la integración con plataformas de búsqueda laboral, por ejemplo LinkedIn, mediante una API disponible o automatización web, según corresponda.
- Mostrar al usuario las ofertas encontradas.
- Permitir que el usuario seleccione las oportunidades que le interesen.
- Asistir o automatizar la postulación o comunicación con la empresa, según las posibilidades y restricciones de la plataforma utilizada.

## Reglas de desarrollo

- No instalar dependencias sin consultar antes al usuario.
- Agregar `data-testid` a todo elemento que una prueba necesite identificar.

