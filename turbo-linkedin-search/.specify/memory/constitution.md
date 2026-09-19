<!--
Sync Impact Report
- Version change: 1.1.0 -> 1.1.1
- Modified principles: IV. Seguridad y aislamiento de datos; Technology and Scope
- Added sections: ninguna
- Removed sections: ninguna sección sustantiva previa
- Follow-up TODOs: confirmar RATIFICATION_DATE
-->

# Generador de CV con IA Constitution

## Core Principles

### I. MVP enfocado y alcance explícito
La Etapa 1 MUST centrarse en transformar información profesional no estructurada en un CV
estructurado, revisable y exportable a PDF. Scraping, Apify, Celery, Redis, `pgvector`,
embeddings y cualquier funcionalidad de matching de la Etapa 2 quedan fuera de esta etapa.
El alcance explícito evita complejidad prematura y mantiene verificable el objetivo del MVP.

### II. Contratos estructurados y validación en los límites
FastAPI MUST enviar a Azure OpenAI un System Prompt que exija exclusivamente JSON estructurado,
sin texto explicativo. El backend MUST validar el JSON antes de persistirlo o devolverlo, y el
frontend MUST renderizar únicamente el objeto validado. El esquema MUST cubrir información
personal, experiencia con logros, educación y habilidades blandas y duras. Los contratos
explícitos reducen respuestas ambiguas y mantienen interoperables las plantillas.

### III. Renderizado y exportación en el cliente
Las plantillas y la exportación del PDF MUST ejecutarse exclusivamente en React/Next.js mediante
`@react-pdf/renderer`. Los componentes de plantilla MUST recibir datos solo a través del JSON
validado y MUST conservar el contenido al cambiar entre las plantillas ATS y visual. El backend
MUST concentrarse en autenticación, orquestación, validación y persistencia para evitar trabajo
visual innecesario y permitir una vista previa antes de descargar.

### IV. Seguridad y aislamiento de datos
La autenticación MUST gestionarse con Supabase Auth y cada registro de `resumes` MUST quedar
vinculado al usuario autenticado. Las claves maestras y privadas, incluida
`SUPABASE_SERVICE_ROLE_KEY`, las claves de API de Azure, las cadenas de conexión de PostgreSQL y
cualquier credencial privilegiada, MUST residir exclusivamente en variables de entorno del
servidor o en un gestor de secretos, y MUST permanecer fuera del cliente, del repositorio, de las
respuestas y de los logs. La clave pública `NEXT_PUBLIC_SUPABASE_ANON_KEY` y los tokens JWT de
acceso de sesión de corta duración emitidos por Supabase Auth para el usuario autenticado MAY be
expuestos en el frontend únicamente para autenticar peticiones contra el backend; no conceden
permiso para sustituir la autorización del backend. Cada endpoint MUST validar el token, autorizar
el acceso al recurso solicitado y mantener aislados los datos de usuarios diferentes. Estas reglas
protegen la información profesional y distinguen configuración pública de secretos privilegiados.

### V. Simplicidad verificable y calidad de integración
Cada cambio MUST preservar la separación entre frontend, FastAPI, Supabase y Azure OpenAI.
Los flujos que cambien contratos, autenticación, persistencia o comunicación entre servicios
MUST incluir pruebas de integración; las interfaces de usuario críticas MUST contar con pruebas
de comportamiento. La complejidad adicional MUST justificarse por una necesidad del MVP y no
por una capacidad futura no implementada.

## Technology and Scope

La implementación MUST limitarse al stack aprobado: React/Next.js en el frontend, con
`@react-pdf/renderer` para PDF; Python con FastAPI en el backend; PostgreSQL, Supabase Auth y
Supabase para datos y persistencia operativa del MVP; Azure OpenAI Service para IA; Vercel para
frontend, Render para backend y Supabase para base de datos y autenticación. El flujo principal
MUST ser sincrónico:
autenticación en Supabase, envío al endpoint `/api/generate-cv`, estructuración mediante Azure
OpenAI, validación y persistencia en `resumes`, y devolución del JSON al frontend. No se deben
introducir proveedores o servicios alternativos sin una enmienda de esta constitución.

## Development Workflow and Quality Gates

Toda historia MUST definir su contrato de entrada, salida y persistencia antes de implementarse.
Los cambios MUST validar, como mínimo, el esquema JSON, el aislamiento de usuario, la vista
previa y la descarga PDF cuando afecten ese flujo. Las pruebas MUST usar identificadores estables
como `data-testid` cuando necesiten localizar elementos de interfaz. Antes de desplegar, el equipo
MUST ejecutar las pruebas relevantes y verificar que no haya secretos en el cliente ni en archivos
compartidos.

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

Esta constitución prevalece sobre prácticas locales incompatibles. Una enmienda MUST describir el
motivo, el impacto sobre principios y contratos, las migraciones necesarias y la estrategia de
validación. El versionado sigue SemVer: MAJOR para eliminar o redefinir reglas de forma
incompatible, MINOR para añadir o ampliar principios o secciones de manera sustantiva, y PATCH
para aclaraciones sin cambio semántico. Toda revisión de código y todo cambio de despliegue MUST
comprobar el cumplimiento de esta constitución. La revisión de cumplimiento se realizará en cada
feature y antes de cada release; cualquier excepción MUST quedar documentada y aprobada junto
con su fecha de caducidad.

**Version**: 1.1.1 | **Ratified**: TODO(RATIFICATION_DATE): confirmar fecha de adopción original | **Last Amended**: 2026-09-19
