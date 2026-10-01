# Research

- **Decision**: CSS y Tailwind actuales, con decoración estática y clases acotadas.
  **Rationale**: El repositorio ya dispone de tokens y layout responsive; no requiere instalación.
  **Alternatives considered**: Librería UI o animación externa, descartadas por coste y falta de necesidad.
- **Decision**: Mantener `--color-surface` blanco y aplicar color al chrome.
  **Rationale**: `CvPreview` y plantillas comparten tokens globales; tintarlos cambiaría documentos.
  **Alternatives considered**: Tema oscuro global, descartado por alcance.
- Investigación delegada de Speckit-plan confirmó estos puntos en los componentes locales. No hay incógnitas pendientes ni hooks en `.specify/extensions.yml`.
