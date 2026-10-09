# Contrato de UI (`/jobs`)

Descripción exacta junto al botón: «Recibí hasta tres recomendaciones de las ofertas encontradas que mejor se adapten a tu perfil profesional».

| data-testid | Elemento |
|---|---|
| `match-button` | Botón "Match" (deshabilitado sin `searchId` o mientras analiza) |
| `match-description` | Texto descriptivo |
| `match-status` | Estado: Analizando… (con spinner) / Completado / Error o tiempo agotado |
| `match-cold-start-warning` | Aviso del posible arranque en frío de Render |
| `match-recalculate` | Botón "Recalcular" |
| `match-retry` | Botón "Reintentar" (en error o timeout) |
| `match-resume-changed` | Aviso "El CV cambió desde este análisis" |
| `match-empty` | Sin ofertas adecuadas |
| `match-recommendation-{rank}` | Tarjeta de recomendación |
| `match-affinity-{rank}` | Etiqueta Alta/Media |
| `match-matches-{rank}` | Coincidencias del CV con la oferta |
| `match-unmet-requirements-{rank}` | Requisitos no acreditados en el CV |
| `match-missing-info-{rank}` | Información faltante para evaluar |
| `match-link-{rank}` | Enlace a la oferta original (`target="_blank"`, `rel="noopener noreferrer"`) |

Comportamiento: al abrir `/jobs`, se solicita `GET /health` sin bloquear la interfaz para iniciar el servicio en Render; una sola petición Match con `AbortController` (85 s); mientras carga se muestra "Analizando…" y el botón queda deshabilitado; en timeout o error se muestra mensaje claro con "Reintentar" y se conserva el resultado previo; al volver a la pantalla se muestran las recomendaciones guardadas; no se muestran porcentajes.
