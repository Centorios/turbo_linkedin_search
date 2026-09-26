# Contract: Asistencia de trayectoria y competencias

## Reglas comunes

- Todas las peticiones se autentican con `Authorization: Bearer <access_token>` y derivan `user_id` exclusivamente del token validado.
- El cliente no envía ni recibe `user_id`; los cuerpos usan modelos estrictos y rechazan propiedades desconocidas.
- Las peticiones son síncronas, no crean historial y usan Azure OpenAI solo desde FastAPI.
- Las respuestas y errores no incluyen token, prompt del sistema, claves, URL de proveedor, cadena de conexión, traceback ni texto profesional que no sea parte de una propuesta que el usuario ya envió.
- Cada cita de evidencia de una propuesta factual debe ser una subcadena literal de `sourceText` o de algún `answers[].answer` de la petición actual.

## `POST /api/trajectory-assistance/turn`

Solicita el siguiente turno de asistencia para la trayectoria profesional y competencias. Cada turno vuelve a incluir el texto fuente y las respuestas confirmadas previas; el backend no mantiene ni persiste una sesión.

### Request

```json
{
  "sourceText": "Lideré la migración del sistema de facturación y redujimos los errores reportados por clientes.",
  "answers": [
    {
      "questionId": "follow-up-1",
      "question": "¿Cómo mediste el cambio en errores reportados?",
      "answer": "No tengo una cifra fiable, pero soporte recibió menos incidencias."
    }
  ]
}
```

`sourceText` es obligatorio y no puede estar vacío. `answers` es una lista ordenada, puede estar vacía y cada respuesta incluye el identificador y texto de la pregunta presentada. No se exige responder con una cifra ni completar una pregunta cuando el dato se desconoce.

### Response: más información necesaria

```json
{
  "state": "needs_input",
  "questions": [
    {
      "id": "follow-up-2",
      "text": "¿Qué responsabilidad concreta tuviste en la migración?"
    }
  ]
}
```

Se devuelven como máximo tres preguntas concretas por turno. No se incluyen propuestas de CV en este estado. La UI permite contestar, indicar que no se conoce el dato o continuar solo con la información existente.

### Response: propuestas listas para revisar

```json
{
  "state": "ready",
  "proposals": [
    {
      "proposalId": "proposal-1",
      "kind": "achievement",
      "text": "Lideré la migración del sistema de facturación, reduciendo las incidencias de facturación reportadas por clientes.",
      "competencyType": null,
      "evidence": [
        "Lideré la migración del sistema de facturación",
        "soporte recibió menos incidencias"
      ]
    },
    {
      "proposalId": "proposal-2",
      "kind": "competency",
      "text": "Gestión de migraciones de sistemas de facturación",
      "competencyType": "hard",
      "evidence": ["Lideré la migración del sistema de facturación"]
    }
  ],
  "developmentRecommendations": [
    {
      "competency": "Medición de calidad de servicio",
      "reason": "La experiencia menciona una mejora observada sin una métrica cuantificada.",
      "actions": ["Practicar la definición de métricas de incidencias antes y después de un cambio"]
    }
  ]
}
```

`proposals` son borradores no confirmados y pueden ser aceptados, editados o rechazados individualmente en el cliente. Cada propuesta factual incluye al menos una cita literal verificable. `developmentRecommendations` son ideas para aprender; nunca se presentan como capacidades poseídas ni se mapean a `skills`.

### Errors

- `401 Unauthorized`: token ausente, inválido o expirado; no se procesa la petición.
- `422 Unprocessable Entity`: texto vacío, respuestas inválidas, campos extra o esquema de salida incorrecto. El error usa `{"detail":{"code":"invalid_assistance_request","message":"..."}}` o `invalid_assistance_response` y no refleja valores del cuerpo.
- `502 Bad Gateway`: Azure OpenAI no responde o no produce JSON/evidencia válida; respuesta genérica y recuperable, sin datos de proveedor.
- `500 Internal Server Error`: fallo interno; mensaje seguro sin detalle técnico ni texto profesional.

## Revisión y generación final

- La UI mantiene propuestas y decisiones en memoria de la sesión. El estado del servidor no cambia al preguntar, proponer, aceptar o rechazar.
- Aceptar una propuesta conserva su texto; editarla conserva solo la edición aprobada por el usuario; rechazarla la excluye.
- Las competencias propuestas no se presentan como confirmadas. Solo una competencia que el usuario acepta explícitamente como demostrada puede agregarse a la entrada final del CV.
- Las recomendaciones de desarrollo y propuestas rechazadas o sin revisar nunca se agregan a la entrada de generación.
- Al pulsar generar, la UI compone el texto fuente con propuestas factuales aceptadas/editadas y llama al `POST /api/generate-cv` vigente usando su bearer e `Idempotency-Key`. El CV resultante se valida con el contrato actual; el servicio de asistencia no devuelve ni persiste un CV alternativo.
- Abandonar el diálogo, cerrar sesión, cambiar de usuario o completar la generación descarta preguntas, respuestas y decisiones temporales.
