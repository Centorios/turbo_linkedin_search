---
name: ado-work-items
description: "Trabajar con el backlog de Azure DevOps mediante el MCP de ADO: consultar Work Items, planificar Features y User Stories, crear la jerarquía Feature -> User Story con aprobación explícita y reportar sus IDs."
argument-hint: "Describe qué elementos del backlog quieres consultar o proponer"
user-invocable: true
---

# Work Items de Azure DevOps

## Cuándo usar esta skill

Usa esta skill cuando el usuario necesite consultar o gestionar el backlog del proyecto en Azure DevOps mediante el MCP de ADO, incluyendo Features y User Stories.

## Reglas obligatorias

- Antes de crear cualquier Work Item, muestra el plan completo y espera una aprobación explícita del usuario. No interpretes una respuesta ambigua como aprobación.
- Crea primero todas las Features y, solo después de obtener sus IDs, crea las User Stories correspondientes como hijas de sus Features.
- Nunca borres ni cierres Work Items. Si el usuario lo solicita, explica que esta skill no permite esas operaciones.
- Al terminar cualquier creación, reporta los Work Items creados en una tabla con, como mínimo, tipo, ID, título y relación padre.
- No hardcodees nombres de herramientas del MCP de Azure DevOps: pueden cambiar entre versiones. Antes de operar, lista las herramientas disponibles del MCP de ADO y utiliza las que correspondan según sus descripciones y esquemas actuales.

## Procedimiento

1. Identifica el proyecto, equipo, área, iteración y demás datos necesarios. Si falta información que impida operar, solicítala antes de continuar.
2. Lista las herramientas disponibles del MCP de ADO. No supongas nombres, parámetros ni resultados de herramientas que no estén disponibles en la sesión.
3. Consulta el backlog o los Work Items existentes cuando sea necesario para evitar duplicados y confirmar el contexto. Las consultas no requieren aprobación de creación.
4. Prepara un plan de creación que incluya:
   - Features a crear, con título y descripción.
   - User Stories a crear bajo cada Feature, con título, descripción y criterios de aceptación.
   - La relación padre-hija prevista.
   - Los campos obligatorios y sus valores.
5. Presenta el plan al usuario y detén el flujo. Solo continúa cuando el usuario lo apruebe explícitamente.
6. Tras la aprobación, crea primero las Features usando las herramientas disponibles que correspondan.
7. Verifica que cada Feature se creó correctamente y registra su ID.
8. Crea las User Stories como hijas de las Features recién creadas, usando los IDs registrados para establecer la relación padre-hija.
9. Verifica los resultados y presenta una tabla final con una fila por Work Item creado:

| Tipo | ID | Título | ID del padre |
|---|---:|---|---|
| Feature | ... | ... | — |
| User Story | ... | ... | ... |

10. Si una operación falla, informa qué elementos se crearon, cuáles no y los IDs disponibles. No intentes borrar, cerrar ni revertir Work Items para compensar el fallo.

## Límites

- No crees ningún Work Item sin aprobación explícita previa.
- No crees User Stories antes de que las Features correspondientes existan y tengan ID.
- No borres ni cierres Work Items bajo ninguna circunstancia.
- No inventes herramientas, nombres de operaciones, campos ni IDs del MCP de ADO.
