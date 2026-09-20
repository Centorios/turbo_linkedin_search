---
name: "Convenciones de pruebas Playwright"
description: "Convenciones para escribir y mantener pruebas Playwright en archivos tests/**/*.spec.ts: locators accesibles, criterios de aceptación y títulos en español."
applyTo: "tests/**/*.spec.ts"
---
# Convenciones de pruebas Playwright

- Usa los locators en este orden de preferencia: `getByRole`, después `getByLabel`, y después `getByTestId`.
- No uses selectores CSS ni XPath.
- No uses `waitForTimeout`; espera condiciones observables mediante las aserciones o esperas específicas de Playwright.
- Escribe una prueba por cada criterio de aceptación.
- Redacta en español los títulos de los bloques `describe` y de las pruebas (`test`/`it`).
