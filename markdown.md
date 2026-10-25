# Contexto del Proyecto: Monorrepo Escalable con Turborepo, Docker y pnpm

Actúa como un Arquitecto de Software Senior experto en JavaScript/TypeScript, Docker y Monorrepositorios. Quiero construir la base de código inicial para una aplicación web altamente escalable utilizando **Turborepo** y **pnpm** como gestor de paquetes. 

Todo el entorno de desarrollo debe correr de manera aislada y fiable dentro de **Docker**, garantizando que herramientas como `pnpm` y la ejecución de tareas de `turbo` ocurran exclusivamente dentro de los contenedores para mantener la paridad con producción y evitar problemas de dependencias locales.

## Estructura del Monorrepo
El proyecto debe organizarse de la siguiente manera:
- `apps/frontend`: Aplicación **Next.js** (App Router, React, TypeScript) que consumirá la API.
- `apps/backend`: API REST en **Node.js con Express** y TypeScript.
- `packages/database`: Paquete compartido que centraliza el cliente de **Prisma ORM** y las migraciones para **PostgreSQL**.
- `packages/auth`: Lógica o utilitarios compartidos para la autenticación basada en **JWT**.

## Requerimientos Clave de la Arquitectura

1. **Documentación de la API (Backend):** Integrar **Swagger / OpenAPI** en el backend (`apps/backend`) utilizando `swagger-jsdoc` y `swagger-ui-express`. La documentación debe autogenerarse a partir de comentarios JSDoc directamente en las rutas/controladores y exponerse en `/docs`.
2. **Estrategia de Mocks (Frontend):** Configurar **MSW (Mock Service Worker)** junto con `@faker-js/faker` en el frontend (`apps/frontend`). Los mocks deben activarse condicionalmente mediante la variable de entorno `NEXT_PUBLIC_API_MOCKING=true` y deben tiparse utilizando los tipos automáticos generados por Prisma desde `packages/database` para garantizar la compatibilidad estricta de los datos.
3. **Orquestación con Docker:** Un archivo `Dockerfile.dev` multi-etapa o de raíz que habilite `pnpm` mediante Corepack, instale las dependencias aislando los `node_modules` del host, y un `docker-compose.yml` que levante el contenedor de la base de datos (PostgreSQL 15-alpine) junto con el contenedor del monorrepo con soporte para *Hot Reload* en tiempo real.
4. **Configuración de Turborepo (`turbo.json`):** Debe incluir la canalización (`pipeline`) para tareas como `build`, `dev` (sin caché y persistente), `db:generate` (con caché basada en el esquema de Prisma) y `db:migrate`.

## Tarea
Por favor, genera el código fuente inicial, los archivos de configuración y los scripts necesarios para inicializar por completo este entorno, enfocándote en:
1. El archivo `apps/backend/src/index.ts` con la configuración base de Express y Swagger.
2. La infraestructura de handlers de MSW en `apps/frontend/src/mocks/` alineada a un modelo conceptual de "Usuario".
3. Las instrucciones exactas de los comandos a ejecutar para levantar el entorno por primera vez usando `docker compose`.