# Feature Specification: Acceso con Google y Microsoft

> **Actualización 2026-10-16:** el acceso con Microsoft (User Story 2 y la parte de Microsoft de FR-001) se descartó porque el equipo no tiene acceso al portal de Microsoft Entra para registrar la aplicación. Solo se mantiene Google; el resto de este documento queda como registro histórico.

**Feature Branch**: `feature_GoogleLogin`
**Created**: 2026-10-14
**Status**: Ready for planning
**Input**: User description: "Login using google account and microsoft account"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acceder con Google (Priority: P1)

Como usuario quiero acceder con mi cuenta Google sin crear otra contraseña.

**Why this priority**: Reduce la fricción del acceso inicial y recurrente.
**Independent Test**: Elegir Google, autorizar y llegar al generador con una sesión.

**Acceptance Scenarios**:

1. **Given** una persona sin sesión, **When** elige Google y autoriza, **Then** accede al generador con su propia cuenta.
2. **Given** una cuenta Google nueva, **When** completa el acceso, **Then** conserva el flujo existente de completar su perfil.
3. **Given** una sesión iniciada con Google, **When** recarga o cierra sesión, **Then** la sesión se restaura o el acceso privado queda bloqueado, respectivamente.

### User Story 2 - Acceder con Microsoft (Priority: P1)

Como usuario quiero acceder con mi cuenta Microsoft personal o laboral permitida por mi organización.

**Why this priority**: Ofrece la segunda alternativa solicitada sin depender de Google.
**Independent Test**: Elegir Microsoft, autorizar y llegar al generador con una sesión.

**Acceptance Scenarios**:

1. **Given** una persona sin sesión, **When** elige Microsoft y autoriza, **Then** accede al generador con su propia cuenta.
2. **Given** una restricción organizacional o autorización rechazada, **When** vuelve a la aplicación, **Then** ve un mensaje en español y puede reintentar.

### User Story 3 - Recuperarse de errores sin perder alternativas (Priority: P2)

Como usuario quiero entender si el acceso externo falla y seguir pudiendo usar correo y contraseña.

**Why this priority**: Evita bloquear el acceso por fallas de configuración o cancelaciones.
**Independent Test**: Simular rechazo, retorno incompleto y falla de red; comprobar mensajes y reintento.

**Acceptance Scenarios**:

1. **Given** una autorización cancelada o fallida, **When** retorna, **Then** no obtiene acceso privado y ve un error seguro sin detalles sensibles.
2. **Given** un inicio de acceso pendiente, **When** intenta otra acción de acceso, **Then** no se inician solicitudes concurrentes.
3. **Given** la página de acceso o registro, **When** usa correo y contraseña, **Then** conserva el comportamiento previo.

### Edge Cases

- Proveedor deshabilitado o falla de red al iniciar: mensaje y reintento.
- Retorno sin código, código inválido, vencido o reutilizado: no dar acceso y volver al login con mensaje.
- Rechazo explícito: no mostrar datos del proveedor ni credenciales.
- Retorno manipulado: el destino siempre es interno y fijo.
- Visitas repetidas o recarga del retorno: no producir intercambios duplicados en un mismo montaje.
- Cuentas con el mismo correo: delegar la política de identidad al gestor existente; no fusionar ni transferir datos en la aplicación.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La página de acceso y registro MUST ofrecer botones identificados para Google y Microsoft.
- **FR-002**: Cada botón MUST iniciar la autorización del proveedor correspondiente y regresar a la misma aplicación.
- **FR-003**: Un retorno exitoso MUST establecer la sesión existente y llevar al generador; no navegar como autenticado antes de completar el acceso.
- **FR-004**: Los errores de inicio, cancelación o retorno MUST mostrarse en español, sin códigos, tokens ni mensajes externos sin filtrar, y permitir reintentar.
- **FR-005**: Mientras una operación de acceso esté pendiente, las acciones de acceso MUST quedar deshabilitadas.
- **FR-006**: Correo/contraseña, restauración de sesión, cierre de sesión y captura inicial de perfil MUST conservar su comportamiento.
- **FR-007**: El acceso externo MUST mantener el aislamiento de perfiles y CVs por usuario sin introducir almacenamiento alternativo de identidad.
- **FR-008**: Las credenciales privadas de los proveedores MUST permanecer fuera del navegador y del repositorio.
- **FR-009**: La entrega MUST documentar los pasos de habilitación de ambos proveedores y las direcciones de retorno para desarrollo y producción.

### Key Entities

- **Usuario**: Identidad de la aplicación, propietaria de su perfil y CVs.
- **Identidad externa**: Cuenta Google o Microsoft asociada por el gestor de autenticación.
- **Sesión**: Acceso autenticado que reutiliza los permisos y ciclo de vida actuales.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las dos alternativas están disponibles y cada una inicia su proveedor correcto con un solo clic.
- **SC-002**: El 100% de los casos controlados de retorno válido llega al generador; ninguno de los retornos inválidos obtiene acceso privado.
- **SC-003**: El 100% de los casos controlados de cancelación, retorno incompleto y falla al iniciar muestra un mensaje seguro y permite reintentar.
- **SC-004**: Las pruebas de regresión de correo/contraseña y ciclo de sesión continúan pasando.

## Assumptions

- Se reutiliza el gestor de autenticación existente, incluida su política de asociación de cuentas.
- Microsoft incluye cuentas personales y organizacionales cuando el administrador habilita ambas; las políticas corporativas siguen aplicando.
- La administración debe habilitar proveedores y registrar aplicaciones externas antes de una prueba real de consentimiento.
- No se solicitan permisos de correo, contactos, calendario ni datos laborales externos.
- Quedan fuera de alcance vinculación manual de cuentas, cambios de contraseña y nuevas reglas de autorización.
