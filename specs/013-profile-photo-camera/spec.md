# Feature Specification: Foto de perfil con botón "Buscar" y cámara

**Feature Branch**: `feat/foto-perfil-camara`
**Created**: 2026-10-23
**Status**: Implemented
**Input**: "En Editar perfil, que la foto no use el botón 'Browse' sino 'Buscar', y poder usar la cámara para tomar una foto en el momento."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir un archivo con "Buscar" (Priority: P1)

Como usuario quiero elegir mi foto con un botón en español y con los colores de la app.

**Acceptance Scenarios**:

1. **Given** el diálogo Editar perfil, **When** lo abro, **Then** veo el botón "Buscar" y "Ningún archivo seleccionado", sin el "Browse… No file selected." del navegador.
2. **Given** que elijo un archivo válido, **When** termino, **Then** veo su nombre y su vista previa, y puedo quitarla.
3. **Given** un archivo que no es JPEG, PNG o WebP o pesa más de 5 MB, **When** lo elijo, **Then** veo el motivo en español.

### User Story 2 - Tomar la foto con la cámara (Priority: P1)

Como usuario quiero tomarme una foto en el momento y usarla como foto de perfil.

**Acceptance Scenarios**:

1. **Given** un navegador con cámara, **When** toco "Usar cámara" y doy permiso, **Then** me veo en la cámara y puedo tocar "Tomar foto".
2. **Given** la foto tomada, **When** guardo el perfil, **Then** se sube y queda como mi foto de perfil.
3. **Given** que no di permiso, no hay cámara o está en uso, **When** intento abrirla, **Then** me explican el motivo y puedo usar "Buscar".
4. **Given** la cámara abierta, **When** cancelo, guardo o cierro el diálogo, **Then** la cámara se apaga.

### User Story 3 - Textos siempre en español rioplatense (Priority: P2)

Como usuario quiero que ningún mensaje aparezca en inglés ni en español neutro.

**Acceptance Scenarios**:

1. **Given** un error de inicio de sesión o registro, **When** lo veo, **Then** está en español con voseo.
2. **Given** una página que no existe o una falla de la app, **When** se muestra, **Then** la pantalla está en español con la marca de la app.

## Requirements *(mandatory)*

- **FR-001**: Los selectores de archivo usan `FilePickerButton` ("Buscar"); el input nativo queda oculto pero accesible.
- **FR-002**: La captura de la cámara se convierte en un JPEG cuadrado de 640×640 y entra por la misma validación y subida que un archivo.
- **FR-003**: "Usar cámara" aparece solo si el navegador ofrece `getUserMedia`.
- **FR-004**: La cámara se apaga en todos los casos de cierre, incluso si el permiso llega tarde.
- **FR-005**: Los errores de Supabase Auth se muestran traducidos por código; los desconocidos usan un mensaje genérico en español.
- **FR-006**: Las páginas 404 y de error son propias y el documento declara `lang="es-AR"`.

## Assumptions

- La cámara frontal se usa por defecto; en un dispositivo con una sola cámara se usa esa.
- No se guarda ninguna imagen hasta que la persona guarda el perfil.
