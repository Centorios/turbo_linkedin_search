# Research: Edición de CV existente desde PDF con IA

**Date**: 2026-10-14  
**Scope**: Extracción de texto de PDFs no confiables en el backend, persistencia privada y reutilización del flujo actual.

## Decision 1: Extraer texto en el backend con `pypdf`

- **Decision**: Proponer `pypdf` como dependencia de ejecución para extraer texto de PDFs sin OCR, usando manejo explícito de errores y sin modo estricto para documentos con defectos recuperables.
- **Rationale**: Es una biblioteca Python pura, evita binarios nativos y herramientas de compilación, y utiliza una licencia permisiva. Reduce complejidad de despliegue respecto de opciones basadas en MuPDF.
- **Alternatives considered**:
  - **PyMuPDF**: puede reparar automáticamente algunos documentos y ofrece capacidades adicionales, pero usa MuPDF nativo y requiere considerar licencia AGPL/comercial y el ciclo de actualizaciones de un parser nativo.
  - **OCR**: descartado para esta entrega; no es necesario para PDFs con texto y agrega coste y complejidad. Los documentos escaneados se rechazan con un mensaje claro.
- **Sources**: [pypdf robustness](https://pypdf.readthedocs.io/en/stable/user/robustness.html), [pypdf encryption](https://pypdf.readthedocs.io/en/stable/user/encryption-decryption.html), [PyMuPDF feature matrix and licensing](https://pymupdf.readthedocs.io/en/latest/about.html), [PyMuPDF OCR guide](https://pymupdf.readthedocs.io/en/latest/recipes-ocr.html).
- **Approval gate**: El usuario debe autorizar añadir `pypdf` al manifiesto y cualquier instalación. No se instala durante la fase de plan.

## Decision 2: Validar los límites antes de procesar y extraer texto de forma controlada

- **Decision**: Aceptar únicamente archivos que declaren `application/pdf` y comiencen con la firma PDF; limitar el cuerpo a 10 MiB y a 20 páginas; rechazar archivos cifrados, dañados o sin texto utilizable. No almacenar ni enviar a IA archivos rechazados.
- **Rationale**: El parser no impone por sí mismo límites operativos para tamaño ni páginas. Validar antes de procesar y verificar el resultado extraído reduce consumo no acotado y permite errores comprensibles. La confirmación de texto extraíble distingue PDFs digitales de documentos escaneados.
- **Alternatives considered**:
  - **Aceptar cualquier tamaño y número de páginas**: descartado por consumo de memoria/CPU y límites de entrada del modelo.
  - **Intentar OCR automático**: descartado por alcance, coste y dependencia adicional.
- **Sources**: [pypdf robustness](https://pypdf.readthedocs.io/en/stable/user/robustness.html), [pypdf text extraction](https://pypdf.readthedocs.io/en/stable/user/extract-text.html).

## Decision 3: Conservar el PDF en almacenamiento privado existente

- **Decision**: Crear un bucket privado de Supabase Storage para archivos fuente; usar una ruta derivada del usuario y del identificador de fuente, y servir descargas desde la API después de comprobar propiedad.
- **Rationale**: El proyecto ya usa Supabase Storage y el backend ya valida usuarios y accede a Supabase. No se expone una URL pública ni se envía el binario a Azure OpenAI.
- **Alternatives considered**:
  - **Guardar el PDF como base64 en PostgreSQL**: descartado por duplicación y tamaño de filas.
  - **Almacenamiento temporal del frontend**: descartado porque no conservaría el original después de la sesión.

## Decision 4: Mantener propuestas temporales y persistir únicamente al confirmar

- **Decision**: Devolver la propuesta validada sin persistirla; el frontend permite revisarla, editarla o descartarla. Al confirmar, el backend crea una fila nueva en el historial de CVs, enlazada a la fuente y a la versión base.
- **Rationale**: Preserva el comportamiento de confirmación explícita y reutiliza el historial `resumes`; propuestas abandonadas no contaminan el historial.
- **Alternatives considered**:
  - **Sobrescribir la fila del CV existente**: descartado porque altera la versión de origen.
  - **Persistir cada borrador**: descartado para la primera entrega por aumentar el estado y la complejidad de limpieza.

## Decision 5: Reutilizar el proveedor Azure OpenAI y validar el contrato completo

- **Decision**: Añadir métodos de importación/edición al proveedor Azure OpenAI existente; solicitar JSON estricto compatible con `StructuredCv`, pedir aclaraciones cuando falte información y validar toda respuesta en FastAPI.
- **Rationale**: Mantiene el proveedor autorizado y el contrato JSON ya consumido por las plantillas y exportación PDF. Solo se envía texto extraído y la CV estructurada base, no el archivo.
- **Alternatives considered**:
  - **Proveedor nuevo o salida libre**: descartado por principios de arquitectura, privacidad y validación estructurada.

## Decision 6: Eliminar la fuente y sus versiones como una sola operación de usuario

- **Decision**: Añadir una operación autenticada de eliminación de fuente que elimine las versiones relacionadas y el objeto privado. La implementación debe compensar una falla parcial de almacenamiento/persistencia y no exponer si la fuente pertenece a otra cuenta.
- **Rationale**: El PDF contiene información personal y se conserva explícitamente; la eliminación debe retirar tanto el documento como las versiones asociadas en vez de dejar objetos huérfanos.
- **Alternatives considered**:
  - **Eliminar solo una fila de historial**: descartado para la acción de eliminar fuente, porque dejaría el PDF original y posibles versiones derivadas.
  - **Dejar la limpieza para una tarea manual**: descartado por falta de una garantía clara de borrado y por el riesgo de retención accidental.
