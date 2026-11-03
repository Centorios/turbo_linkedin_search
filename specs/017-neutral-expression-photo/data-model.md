# Data Model: Verificación de expresión neutra

Sin persistencia. Todos los tipos viven en memoria en el frontend (`app/lib/expression-check.ts`).

## FrameSample (salida del analizador por fotograma)

| Campo | Tipo | Notas |
|-------|------|-------|
| `faceCount` | number | 0, 1 o ≥ 2 |
| `blendshapes` | `Record<string, number>` \| null | Solo con 1 rostro; valores 0–1 por nombre de MediaPipe |
| `pose` | `{ yaw: number; pitch: number; roll: number }` \| null | Grados, desde la matriz de transformación |
| `box` | `{ cx: number; cy: number; width: number }` \| null | Normalizado 0–1 respecto del cuadro |

## ExpressionIssue (motivo)

`no-face` \| `multiple-faces` \| `too-far` \| `too-close` \| `off-center` \| `head-turned` \| `head-tilted` \| `eyes-closed` \| `eyes-wide` \| `mouth-open` \| `smiling` \| `brows-raised` \| `frowning` \| `not-evaluable`

## FrameAssessment

| Campo | Tipo | Regla |
|-------|------|-------|
| `ok` | boolean | `true` si no hay motivo |
| `issue` | `ExpressionIssue` \| null | Motivo de mayor prioridad (orden definido en research R3) |

## ExpressionVerdict (resultado al tocar "Tomar foto")

| Campo | Tipo | Regla |
|-------|------|-------|
| `status` | `"neutral"` \| `"rejected"` | `neutral` si ≥ 4 de 5 fotogramas pasan y menos de 2 no tienen rostro |
| `issue` | `ExpressionIssue` \| null | Motivo principal si `rejected` |
| `message` | string \| null | Texto en rioplatense para el motivo principal |

## LiveStatus (estado del indicador)

`loading` \| `unavailable` \| `no-face` \| `multiple-faces` \| `adjust` \| `ready`

- `adjust` lleva el `ExpressionIssue` vigente y su mensaje.
- Transiciones: `ready` exige 3 fotogramas válidos seguidos; abandonarlo exige 2 inválidos seguidos.
- `unavailable` es terminal para esa apertura de cámara.
