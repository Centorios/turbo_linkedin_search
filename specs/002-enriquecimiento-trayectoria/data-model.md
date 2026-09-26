# Data Model: Enriquecimiento de trayectoria y competencias

## AssistanceTurn

Representa una llamada síncrona de asistencia. No se persiste; el navegador reenvía contexto de turnos anteriores hasta aceptar/rechazar propuestas o abandonar el flujo.

| Campo | Tipo lógico | Obligatorio | Regla |
|---|---|---:|---|
| `sourceText` | string | Sí | Texto original de trayectoria aportado por el usuario; no se reescribe en almacenamiento durante la asistencia. |
| `answers` | array de `FollowUpAnswer` | Sí | Respuestas confirmadas en esta sesión temporal, en orden; puede estar vacío. |
| `questionId` | string | Sí por respuesta | Identifica la pregunta de seguimiento que originó la respuesta. |
| `question` | string | Sí por respuesta | Texto de la pregunta presentada al usuario. |
| `answer` | string | Sí por respuesta | Respuesta aportada por el usuario; puede no confirmar una afirmación y solo se usa como contexto fuente. |

La identidad del usuario procede del bearer validado y nunca del payload. Las llamadas no generan una entidad persistida ni reanudable.

## AssistanceResult

La salida usa un campo `state` para distinguir dos formas mutuamente excluyentes:

- `needs_input`: una lista acotada de preguntas necesarias para aclarar un dato antes de formular una afirmación. No contiene resultados que puedan enviarse al CV.
- `ready`: propuestas de redacción factuales con evidencia y recomendaciones de desarrollo claramente separadas. No contiene preguntas pendientes.

## TrajectoryProposal

Propuesta opcional de reformulación para trayectoria, logro o competencia demostrada.

| Campo | Tipo lógico | Obligatorio | Regla |
|---|---|---:|---|
| `proposalId` | string | Sí | Identificador estable dentro de la respuesta actual para la decisión del usuario. |
| `kind` | enum | Sí | `trajectory`, `achievement` o `competency`. |
| `text` | string | Sí | Redacción propuesta; puede mejorar estilo, pero no agregar hechos. |
| `competencyType` | enum o null | Sí | `hard`, `soft` o null; solo se usa cuando `kind` es `competency`. |
| `evidence` | array de string | Sí | Una o más citas textuales que deben ser subcadenas de `sourceText` o de alguna respuesta previa. |

Toda propuesta factual tiene como estado inicial `proposed`. En memoria del cliente, el usuario la puede `accepted`, `edited` o `rejected`. Un texto editado se trata como contenido aprobado por el usuario, pero no como afirmación verificada de forma independiente.

## DevelopmentRecommendation

Sugerencia de aprendizaje sobre una competencia que la persona desea fortalecer; no representa una habilidad que ya posee.

| Campo | Tipo lógico | Obligatorio | Regla |
|---|---|---:|---|
| `competency` | string | Sí | Competencia a desarrollar, no añadida a las skills del CV. |
| `reason` | string | Sí | Motivo relacionado con el objetivo profesional o brecha expresada; no afirma experiencia que no se aportó. |
| `actions` | array de string | Sí | Acciones concretas de práctica o aprendizaje. |

## State transitions and final CV mapping

```text
sourceText + answers -> needs_input -> user answers -> needs_input or ready
ready -> user accepts/edits/rejects each proposal
accepted/edited factual proposals + original sourceText -> existing CV generation request
rejected proposals + development recommendations -> never added to CV generation text
```

- Cada competencia demostrada propuesta necesita al menos una evidencia literal validada contra las entradas del usuario.
- Las `DevelopmentRecommendation` no se copian a `skills.hard`, `skills.soft`, experiencia, certificaciones ni otras secciones del CV.
- El generador existente sigue siendo responsable de validar el `StructuredCv` final antes de persistirlo o devolverlo.
- La sesión temporal, preguntas, respuestas y decisiones se eliminan al completar la generación, abandonar el flujo, cerrar sesión o cambiar de usuario.
