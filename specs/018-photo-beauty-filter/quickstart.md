# Guía de validación rápida: Filtro de belleza para foto de perfil

## Prerrequisitos

- Node.js y dependencias del frontend instaladas según `frontend/package.json`.
- Acceso a una cámara en el navegador si se valida manualmente la captura real.
- Los recursos locales de MediaPipe presentes en `frontend/public/mediapipe/`.

## Pruebas automatizadas

Desde `frontend/`, ejecutar:

```powershell
npm test -- tests/skin-smoothing.test.ts tests/camera-capture.test.tsx tests/basic-profile-modal.test.tsx
npx tsc --noEmit
npm run build
```

Resultado verificado: 3 archivos de prueba, 45 pruebas aprobadas; la verificación TypeScript y el build de producción también finalizaron correctamente. Las pruebas cubren la captura existente y las transiciones de comparación, selección, reintento desde comparación y fallback, cancelación y limpieza de recursos sin depender de un servicio externo.

La validación visual manual de cámara real en dispositivos móviles y de escritorio queda pendiente; las pruebas automatizadas no miden la calidad visual del suavizado.

## Validación manual de extremo a extremo

1. Iniciar el frontend desde `frontend/` con `npm run dev` y abrir el flujo de edición de perfil en un navegador con permiso de cámara.
2. Elegir «Usar cámara», tomar una foto válida y esperar la preparación de la revisión.
3. Confirmar que «Original» y «Embellecida» se distinguen claramente y que el efecto conserva nítidos ojos, cejas y boca.
4. Seleccionar cada alternativa en intentos separados y comprobar que la vista previa del perfil corresponde a la elegida.
5. Repetir y cancelar la revisión; confirmar que no se selecciona ni guarda una imagen pendiente.
6. Probar sin un rostro detectable o con el filtro no disponible; confirmar que se muestra un aviso y se puede continuar con la original.
7. Guardar el perfil y confirmar que solo se procesa/sube la foto elegida mediante el flujo actual.

## Resultados esperados

- La elección de la foto embellecida no cambia el archivo original.
- Un fallo de procesamiento nunca bloquea el uso de la imagen original.
- Repetir, cancelar y desmontar liberan la cámara y las vistas previas temporales.
- No se requieren cambios de backend, base de datos, secretos o dependencias.
