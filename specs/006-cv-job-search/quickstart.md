# Quickstart: Buscar empleos desde un CV

1. Obtener una clave regional en [Jooble Argentina](https://ar.jooble.org/api/about) y configurar `JOOBLE_AR_API_KEY` **solo** en el entorno del backend. No pegarla en el repositorio ni en variables `NEXT_PUBLIC_*`.
2. Iniciar frontend y backend con la configuración existente.
3. Iniciar sesión y generar un CV con un puesto profesional; comprobar que aparece en el historial.
4. Abrir **Empleos**, elegir ese CV, revisar término y ubicación y pulsar **Buscar empleos**.
5. Comprobar título, empresa, ubicación, fuente y enlace de cada oferta. Abrir una oferta y verificar que navega al origen.
6. Quitar temporalmente la clave en un entorno de prueba: la búsqueda debe mostrar el estado de configuración faltante sin perder los términos.

La consulta real requiere la clave regional y consume la cuota del proveedor. Las pruebas automatizadas usan un proveedor falso y no consumen cuota.
