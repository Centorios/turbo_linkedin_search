# Data Model: Dictado por voz

No hay entidades persistidas: no cambian tablas, migraciones ni contratos del backend.

## DictationState (efímero, en el navegador)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `status` | `"idle" \| "listening" \| "error"` | Empieza en `idle`. `start()` → `listening`. Evento `end` → `idle` (salvo que haya error). Error distinto de `aborted` → `error`. |
| `interim` | `string` | Texto provisorio de la sesión actual. Se vacía al confirmar una frase, al terminar y al detener. Nunca se escribe en el campo. |
| `error` | `string \| null` | Mensaje en rioplatense (ver research.md R6). Se limpia al volver a empezar. |
| `supported` | `boolean` | `false` hasta montar; luego, si existe el constructor de reconocimiento. |

## Transiciones

```text
idle --toggle()--> listening --toggle()/disabled/unmount--> idle
listening --result(isFinal)--> listening   (onTranscript(chunk) al padre)
listening --error(code≠aborted)--> error --toggle()--> listening
listening --end--> idle
```

## Regla de agregado

`appendDictation(current: string, chunk: string): string` — ver research.md R3.
