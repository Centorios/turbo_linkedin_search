# Quickstart: Dictado por voz

## Probar a mano

1. `cd frontend && npm run dev -- --hostname 127.0.0.1` y abrir `http://localhost:3000/generate` en Chrome o Edge (el micrófono requiere `localhost` o HTTPS).
2. Tocar el micrófono junto a "Biografía o experiencia profesional" y aceptar el permiso.
3. Decir: "Trabajé cinco años como diseñadora en Acme". Ver "Escuchando…" con el texto provisorio y, al confirmar, la frase al final del campo.
4. Tocar de nuevo el micrófono: se detiene. Tocar "Generar CV" durante un dictado: también se detiene.
5. Bloquear el permiso del micrófono en el candado de la barra de direcciones y volver a tocar: aparece "No diste permiso para usar el micrófono…".
6. En Firefox: el micrófono no aparece.
7. Abrir "Mejorar trayectoria y competencias"; si hay preguntas, cada respuesta tiene su micrófono.

## Pruebas automáticas

```powershell
Set-Location frontend
npx tsc --noEmit
npm test -- --run
npm run test:e2e -- --config=playwright.config.ts --project=chromium voice-dictation
```

Las E2E usan un reconocedor falso inyectado en la página; no necesitan micrófono ni credenciales reales
(se configura `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` con cualquier valor y las rutas se mockean).
