---
name: playwright-explore-and-test
description: "Explorar y probar una aplicación web con el MCP de Playwright siguiendo un flujo obligatorio de exploración, escritura y ejecución. Usar para crear o depurar pruebas E2E sin inventar selectores."
argument-hint: "Indica la feature o los criterios de aceptación que quieres explorar y probar"
user-invocable: true
---

# Explorar y probar con Playwright

## Principio central

**Primero mirar, después escribir. Nunca inventar un selector.**

No crees ni modifiques archivos de pruebas hasta haber explorado la aplicación con el MCP de Playwright y obtenido un snapshot real de accesibilidad. Todo locator debe derivarse de la interfaz observada.

## Fase 1: Explorar

Completa esta fase antes de escribir cualquier prueba.

1. Verifica que `localhost:5173` responde. Si no responde, detén el flujo, informa el bloqueo y no inventes resultados ni archivos de prueba.
2. Usa el MCP de Playwright para navegar a `localhost:5173`.
3. Toma un snapshot de accesibilidad de la página después de que haya cargado.
4. Interactúa con la aplicación como lo haría un usuario: usa los controles visibles, navega por los estados necesarios y observa las respuestas de la interfaz.
5. Antes de cada interacción que requiera identificar un elemento, consulta el snapshot actual. Si la interacción cambia el DOM, toma un nuevo snapshot antes de seguir.
6. Reporta los elementos encontrados y las rutas relevantes, incluyendo para cada elemento su rol accesible y su `data-testid` cuando exista. Si un elemento no tiene `data-testid`, indícalo explícitamente.
7. Registra los criterios de aceptación que se puedan verificar y los estados inicial, intermedio y final observados.

No continúes a la Fase 2 si el snapshot no permite identificar de forma fiable los elementos necesarios.

## Fase 2: Escribir

Solo comienza después de completar la exploración y de contar con snapshots reales.

1. Crea los archivos de pruebas dentro de `tests/`.
2. Organiza un archivo por feature.
3. Escribe una prueba por cada criterio de aceptación.
4. Deriva cada locator del snapshot real observado. No fabriques nombres, roles, etiquetas ni `data-testid`.
5. Prefiere los locators en este orden: `getByRole`, después `getByLabel`, y después `getByTestId`.
6. No uses selectores CSS ni XPath.
7. No uses `waitForTimeout`; espera condiciones observables mediante aserciones o esperas específicas de Playwright.
8. Redacta en español los títulos de `describe` y de cada prueba.
9. Mantén las pruebas enfocadas en el comportamiento observable del usuario y conserva los criterios de aceptación separados.

## Fase 3: Ejecutar

1. Ejecuta exactamente:

   ```text
   npx playwright test --reporter=list
   ```

2. Reporta el resultado de cada archivo o prueba relevante.
3. Si algo falla, vuelve obligatoriamente a la Fase 1: navega nuevamente, toma un snapshot actualizado y revisa el DOM real antes de modificar la prueba.
4. Después de revisar el DOM, determina si la causa corresponde a la aplicación o al test y dilo explícitamente.
5. Si la causa es el test, modifica únicamente los locators, esperas o aserciones que contradigan el DOM observado y vuelve a ejecutar el mismo comando.
6. Si la causa es la aplicación, no disfraces el fallo modificando el test para aceptar un comportamiento incorrecto; reporta el defecto con el estado observado.
7. Repite el ciclo de exploración y ejecución hasta resolver el test o dejar documentado el bloqueo.

## Criterios de finalización

La skill termina solo cuando:

- La aplicación fue verificada en `localhost:5173` o se documentó por qué no responde.
- La exploración se basó en snapshots de accesibilidad reales.
- Los elementos utilizados por las pruebas fueron reportados con su rol y `data-testid` cuando existe.
- Las pruebas están en `tests/`, separadas por feature y por criterio de aceptación.
- No contienen selectores CSS, XPath ni `waitForTimeout`.
- Se ejecutó `npx playwright test --reporter=list`.
- Cada fallo restante está clasificado explícitamente como problema de la aplicación, problema del test o bloqueo del entorno.
