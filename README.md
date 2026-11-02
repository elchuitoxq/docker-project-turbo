# 🚀 ERP Venezuela - Monorrepo en Docker

Sistema ERP modular para el mercado venezolano, construido con **NestJS**, **Next.js**, **Drizzle ORM** y **PostgreSQL**.

> **Nota:** Este proyecto está en desarrollo activo. La documentación se actualiza constantemente.

---

## 📋 Tabla de Contenidos

- [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Desarrollo con Docker](#-desarrollo-con-docker)
- [Desarrollo Local (sin Docker)](#-desarrollo-local-sin-docker)
- [Comandos Esenciales](#-comandos-esenciales)
- [Drizzle Kit Studio](#-drizzle-kit-studio)
- [Estructura de Carpetas](#-estructura-de-carpetas)
- [Servicios y Puertos](#-servicios-y-puertos)
- [Base de Datos](#-base-de-datos)
- [Documentación de la API](#-documentación-de-la-api)
- [Pruebas](#-pruebas)
- [Análisis estático y formato](#-análisis-estático-y-formato)
- [Hooks de Git](#-hooks-de-git)
- [Solución de Problemas](#-solución-de-problemas)

---

## 🏗 Arquitectura del Proyecto

Este proyecto utiliza una arquitectura de **monorrepo** gestionada con **Turborepo** y **pnpm**.

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose                             │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                     mono-app                          │  │
│  │                     (Node 26)                        │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │              Turborepo                          │ │  │
│  │  │                                                │ │  │
│  │  │  apps/frontend    (Next.js :3000)             │ │  │
│  │  │  apps/backend     (NestJS :4000)               │ │  │
│  │  │  packages/database (esquema de Drizzle)           │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    mono-postgres                       │  │
│  │                    (PostgreSQL 18.4)                  │  │
│  │                    Puerto: 5432                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Módulos del servidor (20+)

| Módulo                           | Prefijo de API   | Descripción                          |
| -------------------------------- | ---------------- | ------------------------------------ |
| **Autenticación (Auth)**         | `/v1/auth`       | Inicio de sesión, JWT y recuperación |
| **Usuarios (Users)**             | `/v1/users`      | Gestión de usuarios                  |
| **Facturación (Billing)**        | `/v1/billing`    | Facturación (crítica)                |
| **Tesorería (Treasury)**         | `/v1/treasury`   | Pagos, cuentas y métodos             |
| **RR. HH. (HR)**                 | `/v1/hr`         | Nómina y empleados                   |
| **Inventario**                   | `/v1/inventory`  | Productos y existencias              |
| **Pedidos (Orders)**             | `/v1/orders`     | Pedidos                              |
| **Socios (Partners)**            | `/v1/partners`   | Clientes y proveedores               |
| **Productos (Products)**         | `/v1/products`   | Catálogo                             |
| **Configuración**                | `/v1/settings`   | Bancos, monedas y conceptos          |
| **Contabilidad**                 | `/v1/accounting` | Asientos contables                   |
| **Préstamos (Loans)**            | `/v1/loans`      | Préstamos                            |
| **Informes (Reports)**           | `/v1/reports`    | Informes fiscales                    |
| **Auditoría (Audit)**            | `/v1/audit`      | Registros de auditoría               |
| **Inteligencia de negocio (BI)** | `/v1/bi`         | Indicadores y paneles                |
| **Tareas programadas**           | `/v1/cron`       | Tareas programadas                   |
| **Sucursales**                   | `/v1/branches`   | Sucursales                           |

---

## 🛠 Tecnologías Utilizadas

| Tecnología          | Versión                                           | Propósito                    |
| ------------------- | ------------------------------------------------- | ---------------------------- |
| **Node.js**         | `26-alpine3.23`                                   | Entorno de ejecución         |
| **pnpm**            | `10.0.0`                                          | Gestor de paquetes           |
| **Turborepo**       | `2.11.10`                                         | Orquestador de tareas        |
| **Next.js**         | `16.4.3`                                          | Interfaz (App Router)        |
| **React**           | `19.3.1`                                          | Biblioteca de interfaz       |
| **NestJS**          | `12.2.0`                                          | Servidor (API REST)          |
| **TypeScript**      | `7.0.2` (compilador) + `6.0.2` (API para tooling) | Tipado estático              |
| **Drizzle ORM**     | `0.45.4`                                          | Mapeador objeto-relacional   |
| **Drizzle Kit**     | `0.31.11`                                         | Herramienta de migraciones   |
| **PostgreSQL**      | `18.4-alpine3.23`                                 | Base de datos                |
| **Swagger/OpenAPI** | `7.4.2`                                           | Documentación de la API      |
| **Vitest**          | `5.0.5`                                           | Pruebas unitarias            |
| **Tailwind CSS**    | `4.3.3`                                           | Estilos                      |
| **Playwright**      | `1.64.1`                                          | Pruebas de extremo a extremo |
| **ESLint**          | `9.39.5`                                          | Análisis estático            |
| **Prettier**        | `3.9.10`                                          | Formato de código            |
| **Husky**           | `9.1.7`                                           | Hooks de Git                 |
| **Docker**          | Compose v2                                        | Contenedores                 |

> **TypeScript 7 en paralelo con la API de TypeScript 6.** El compilador es
> `typescript@7.0.2`, instalado como `@typescript/native` y expuesto en
> `node_modules/.bin/tsc`. Como TypeScript 7 no publica API de compilador, los
> paquetes declaran además `"typescript": "npm:@typescript/typescript6@6.0.2"` para
> que `typescript-eslint`, `openapi-typescript` y Next.js sigan funcionando
> ([guía oficial](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0)).
> Consecuencias prácticas: el backend usa `module`/`moduleResolution` `nodenext`
> (`node10` ya no existe en TS 7) y `packages/database` emite declaraciones porque
> su `types` apunta a `dist/index.d.ts`.

---

## ✅ Requisitos Previos

### Para desarrollo con Docker

- **Docker Desktop** (Windows/macOS) o Docker Engine (Linux)
  - [Descargar Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Para desarrollo local (sin Docker)

- **Node.js** `26.x` o superior
- **pnpm** `10.x` o superior
- **PostgreSQL** `18.x` ejecutándose en puerto `5432`
  - O usar PostgreSQL de Docker: `docker run -d -p 5432:5432 postgres:18.4`

> **Nota:** No es necesario tener ambas opciones. Elige la que prefieras.

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd docker-project-turbo
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env  # Si existe el archivo de ejemplo
```

El archivo `.env` ya viene configurado con valores por defecto:

```env
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mydb?schema=public
JWT_SECRET=cambia-por-una-clave-secreta-segura
JWT_EXPIRES_IN=7d
PORT=4000
BCV_API_URL=https://www.bcv.org.ve
```

---

## 🐳 Desarrollo con Docker

### Desarrollo completo con Docker (todos los servicios)

```bash
pnpm dev:docker:up          # Inicia los servicios principales (PostgreSQL, db-setup, servidor e interfaz)
# Alternativa
docker compose up -d

# Herramientas opcionales (pgAdmin, Drizzle Studio y el simulador Prism)
pnpm dev:docker:tools
```

Servicios que se inician:

| Servicio                                                  | Contenedor      | Puerto del equipo | URL                                                    |
| --------------------------------------------------------- | --------------- | ----------------- | ------------------------------------------------------ |
| **PostgreSQL**                                            | `mono-postgres` | 5432              | `localhost:5432`                                       |
| **Servidor** (NestJS + Swagger)                           | `mono-backend`  | 4000              | `http://localhost:4000` · `http://localhost:4000/docs` |
| **Interfaz** (Next.js)                                    | `mono-frontend` | 3000              | `http://localhost:3000`                                |
| **Simulador Prism** (perfil `tools`)                      | `mono-mock`     | 4010              | `http://localhost:4010`                                |
| **Drizzle Studio** (perfil `tools`)                       | `mono-drizzle`  | 4983              | `https://local.drizzle.studio/?host=localhost:4983`    |
| **pgAdmin** (perfil `tools`)                              | `mono-pgadmin`  | 5050              | `http://localhost:5050`                                |
| **db-setup** (tarea puntual: migración + datos iniciales) | `mono-db-setup` | —                 | Finaliza con `exit 0`                                  |

**Orden de inicio:** `postgres` (comprobación de disponibilidad) → `db-setup` (migraciones + carga inicial; finaliza) →
`backend` (comprobación de estado en `/health`) → `frontend` (comprobación de estado en `/`). Las
herramientas del perfil `tools` se inician por separado con `pnpm dev:docker:tools`.

**Comunicación entre servicios:**

- La interfaz (servicio `frontend` dentro de Docker) se comunica con el servidor (servicio `backend`) mediante `http://backend:4000` (nombre del servicio en la red de Compose).
- `mock` lee el archivo `openapi.json` generado por el servidor desde el volumen compartido `apps/backend/docs/`.
- `drizzle-studio` se conecta a `postgres:5432` a través de la red interna de Compose.
- Desde el **equipo local**, abre `https://devtools.nestjs.com`; se conectará a `ws://localhost:8000` (puerto publicado en el equipo).

> ⚠️ **Limitación de DevTools:** la interfaz pública `devtools.nestjs.com` necesita acceder a `ws://localhost:8000` del equipo local. Funciona en **Docker Desktop (Windows/macOS)**. En una instalación estándar de **Linux** no funciona; como alternativa, agrega `network_mode: host` al servicio `backend` y elimina `ports: 8000:8000`.

### Entorno mínimo con Docker

```bash
docker compose up postgres backend frontend
```

Inicia solo los tres servicios esenciales. Es útil cuando no necesitas Prism Mock ni Drizzle Studio.

### Comandos de Docker

| Comando                                               | Descripción                                              |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev:docker:up` o `docker compose up`            | Iniciar todos los servicios                              |
| `pnpm dev:docker:build` o `docker compose up --build` | Reconstruir las imágenes e iniciar los servicios         |
| `pnpm dev:docker:down` o `docker compose down`        | Detener y eliminar los contenedores                      |
| `docker compose down -v`                              | ⚠️ Eliminar también los volúmenes (se pierden los datos) |
| `pnpm dev:docker:logs` o `docker compose logs -f`     | Ver los registros en tiempo real                         |
| `pnpm dev:docker:ps` o `docker compose ps`            | Consultar el estado de los contenedores                  |
| `docker compose logs -f backend`                      | Ver solo los registros del servidor                      |
| `docker compose exec backend sh`                      | Abrir una consola dentro del contenedor del servidor     |

### Recarga automática

Los montajes selectivos sincronizan el código local con los contenedores:

- **Servidor**: los cambios en `apps/backend/src/` y `packages/*/src/` se reflejan al instante (modo de vigilancia de NestJS).
- **Interfaz**: los cambios en `apps/frontend/{app,components,lib,public,styles}/` y en la configuración se reflejan automáticamente.
- ⚠️ Si agregas una dependencia (`pnpm add ...`), no estará disponible dentro del contenedor. Ejecuta: `docker compose exec backend pnpm install`.

---

## 💻 Desarrollo Local (sin Docker)

### Requisitos

1. **Node.js 26+** y **pnpm 10+**
2. **PostgreSQL 18** corriendo en puerto `5432`

### Configuración inicial

```bash
# Instalar las dependencias
pnpm install

# Generar las migraciones (solo la primera vez)
pnpm --filter database db:generate

# Aplicar las migraciones
pnpm --filter database db:migrate

# Cargar los datos iniciales de roles y permisos
pnpm --filter database db:seed:core

# Iniciar el entorno de desarrollo
pnpm turbo dev
```

### Base de datos local

Si no tienes PostgreSQL instalado, puedes usar Docker solo para la base de datos:

```bash
# Solo PostgreSQL
docker run -d \
  --name erp-postgres \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=mydb \
  -p 5432:5432 \
  postgres:18.4-alpine3.23
```

---

## 📌 Comandos Esenciales

### Dentro del contenedor Docker

Usa `docker compose exec backend` para ejecutar comandos dentro del contenedor:

```bash
# Consola interactiva
docker compose exec backend sh

# Turborepo
docker compose exec backend pnpm turbo run build
docker compose exec backend pnpm turbo run db:generate

# Pruebas
docker compose exec backend pnpm --filter backend test
docker compose exec backend pnpm --filter database test
```

### En el equipo local (desarrollo sin Docker)

```bash
# Dependencias
pnpm install
pnpm add --filter backend <paquete>
pnpm add --filter frontend <paquete>

# Desarrollo (todas las tareas en paralelo)
pnpm turbo dev
pnpm turbo build

# Desarrollo por herramienta (en terminales separadas)
pnpm dev:api         # Servidor + Swagger (http://localhost:4000)
pnpm dev:devtools    # NestJS DevTools (https://devtools.nestjs.com)
pnpm dev:mock        # Servidor simulado de Prism (http://localhost:4010)
pnpm dev:frontend    # Interfaz Next.js (http://localhost:3000)
pnpm dev:db          # Drizzle Studio (https://local.drizzle.studio/?host=127.0.0.1:4983)

# OpenAPI y tipos compartidos
pnpm openapi:export  # Regenera apps/backend/docs/openapi.json
pnpm sync:types      # Regenera packages/shared-types/src/api-types.ts

# Base de datos
pnpm --filter database db:generate
pnpm --filter database db:migrate
pnpm --filter database db:seed:core

# Calidad
pnpm lint
pnpm typecheck
pnpm format:check

# Pruebas
pnpm test
pnpm test --filter backend
pnpm test --filter database
pnpm test:e2e        # Playwright (inicia la interfaz automáticamente)
pnpm test:coverage

# Análisis estático y formato
pnpm lint
pnpm lint:fix
pnpm format
```

---

## 🗄 Drizzle Kit Studio

Drizzle Kit Studio es una interfaz web para visualizar y editar la base de datos.

### Ejecutar Studio

```bash
pnpm --filter database db:studio
```

> El puerto `4983` expone el servidor local al que se conecta Studio; la interfaz
> web se sirve desde `local.drizzle.studio`. No abras `http://localhost:4983` como
> si fuera una página: esa ruta no sirve la interfaz y puede responder `404`.

#### Con Docker Compose

El servicio `drizzle-studio` se inicia junto con el resto de servicios mediante
`pnpm dev:docker:up`. Accede a la interfaz con esta URL:

```text
https://local.drizzle.studio/?host=localhost:4983
```

Comprueba que PostgreSQL y Studio estén activos con:

```bash
docker compose ps postgres drizzle-studio
docker compose logs --tail 30 drizzle-studio
```

#### Ejecución directa en el equipo local

Asegúrate de que PostgreSQL esté accesible en `localhost:5432`, luego ejecuta:

```bash
pnpm dev:db
```

Abre la URL que imprime Drizzle Kit, o usa:

```text
https://local.drizzle.studio/?host=127.0.0.1:4983
```

### Comandos relacionados

```bash
# Studio
pnpm --filter database db:studio

# Studio con registros detallados
pnpm --filter database db:studio:verbose

# Generar las migraciones
pnpm --filter database db:generate

# Aplicar las migraciones
pnpm --filter database db:migrate
```

---

## 📁 Estructura de Carpetas

```
docker-project-turbo/
├── apps/
│   ├── frontend/                 # Next.js 16 (App Router)
│   │   ├── app/                # Páginas y diseños
│   │   ├── src/               # Componentes, hooks y bibliotecas
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── backend/                # NestJS 12
│       ├── src/
│       │   ├── modules/       # Módulos funcionales
│       │   │   ├── auth/      # Inicio de sesión y JWT
│       │   │   ├── billing/   # Facturas
│       │   │   ├── treasury/   # Pagos
│       │   │   ├── hr/        # Nómina
│       │   │   └── ...       # (20+ módulos)
│       │   ├── common/        # Decoradores y guardias
│       │   └── main.ts        # Punto de entrada
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── database/               # Drizzle ORM
│       ├── src/
│       │   └── index.ts      # Esquema y cliente
│       ├── scripts/           # Datos iniciales y utilidades
│       ├── drizzle.config.ts  # Configuración de Drizzle Kit
│       └── package.json
│
├── docs/                      # Documentación
│   └── DATABASE.md            # Catálogo de tablas
│
├── docker-compose.yml         # Orquestación de servicios
├── Dockerfile.dev              # Imagen para desarrollo
├── .env                       # Variables de entorno
├── .dockerignore
├── package.json              # Configuración raíz del monorrepo
├── pnpm-workspace.yaml       # Espacios de trabajo de pnpm
├── turbo.json                # Flujos de tareas de Turborepo
└── README.md
```

---

## 🔌 Servicios y Puertos

### En Docker (todos los servicios integrados)

| Servicio       | Contenedor      | Puerto Local | Descripción      |
| -------------- | --------------- | ------------ | ---------------- |
| **Interfaz**   | `mono-app`      | `3000`       | Next.js          |
| **Servidor**   | `mono-app`      | `4000`       | NestJS + Swagger |
| **PostgreSQL** | `mono-postgres` | `5432`       | Base de datos    |

### En desarrollo local (herramientas incluidas en NestJS)

| Servicio                    | Puerto | URL                                                             | Script              | Descripción                                                                    |
| --------------------------- | ------ | --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| **API del servidor**        | 4000   | `http://localhost:4000`                                         | `pnpm dev:api`      | NestJS con la interfaz de Swagger                                              |
| └ Interfaz de Swagger       | 4000   | `http://localhost:4000/docs`                                    | (incluida)          | Documentación interactiva                                                      |
| └ OpenAPI JSON              | 4000   | `http://localhost:4000/docs-json`                               | (incluido)          | Especificación OpenAPI 3.0 disponible en ejecución                             |
| **NestJS DevTools**         | 8000   | `https://devtools.nestjs.com` (conecta a `ws://localhost:8000`) | `pnpm dev:devtools` | Grafo de módulos en vivo, seguimiento de solicitudes y análisis de rendimiento |
| **Servidor simulado Prism** | 4010   | `http://localhost:4010`                                         | `pnpm dev:mock`     | Simulación del servidor generada desde `openapi.json`                          |
| **Interfaz** (Next.js)      | 3000   | `http://localhost:3000`                                         | `pnpm dev:frontend` | Usa la simulación o el servidor real según `NEXT_PUBLIC_API_URL`               |
| **Drizzle Studio**          | 4983   | `https://local.drizzle.studio/?host=localhost:4983`             | `pnpm dev:db`       | Interfaz gráfica para la base de datos                                         |

> **Consejo:** abre cada herramienta en una terminal separada con su comando `pnpm dev:*`. Para que la interfaz use la simulación: `NEXT_PUBLIC_API_URL=http://localhost:4010`. Para que use el servidor real: `http://localhost:4000`.

### Flujo de desarrollo habitual

```bash
# Terminal 1: servidor
pnpm dev:api            # → http://localhost:4000/docs

# Terminal 2: DevTools (opcional)
pnpm dev:devtools       # → https://devtools.nestjs.com

# Terminal 3: servidor simulado (opcional, si la interfaz no usa el backend real)
pnpm --filter backend openapi:export
pnpm dev:mock           # → http://localhost:4010

# Terminal 4: interfaz
NEXT_PUBLIC_API_URL=http://localhost:4010 pnpm dev:frontend

# Terminal 5: Drizzle Studio (opcional)
pnpm dev:db             # → https://local.drizzle.studio
```

### Regeneración de tipos compartidos

Cuando cambies un DTO del servidor:

```bash
pnpm openapi:export     # regenera apps/backend/docs/openapi.json
pnpm sync:types         # regenera packages/shared-types/src/api-types.ts
```

---

## 🗃 Base de Datos

### Datos de conexión

| Variable            | Valor                                                |
| ------------------- | ---------------------------------------------------- |
| `POSTGRES_USER`     | `myuser`                                             |
| `POSTGRES_PASSWORD` | `mypassword`                                         |
| `POSTGRES_DB`       | `mydb`                                               |
| `DATABASE_URL`      | `postgresql://myuser:mypassword@localhost:5432/mydb` |

### Catálogo de Tablas

Consulta el archivo completo en [`docs/DATABASE.md`](docs/DATABASE.md).

**Resumen de esquemas:**

| Esquema               | Tablas  | Descripción                          |
| --------------------- | ------- | ------------------------------------ |
| Seguridad y auditoría | 8       | Usuarios, roles y permisos           |
| Núcleo                | 6       | Sucursales, monedas y socios         |
| Inventario            | 7       | Productos, existencias y movimientos |
| Pedidos y facturación | 7       | Pedidos, facturas y notas de crédito |
| Tesorería             | 7       | Pagos, cuentas y retenciones         |
| Recursos humanos      | 15      | Empleados y nóminas                  |
| Contabilidad          | 4       | Plan de cuentas y asientos           |
| Préstamos             | 2       | Préstamos                            |
| **Total**             | **56+** |                                      |

### Flujo de trabajo

```bash
# 1. Modificar el esquema en packages/database/src/index.ts

# 2. Generar la migración SQL
pnpm --filter database db:generate

# 3. Revisar la migración en packages/database/drizzle/

# 4. Aplicar la migración
pnpm --filter database db:migrate
```

### Respaldos

```bash
# Crear un respaldo (desde el equipo local)
docker exec mono-postgres pg_dump -U myuser -d mydb -F c > backup.dump

# Restaurar el respaldo
docker exec -i mono-postgres pg_restore -U myuser -d mydb < backup.dump
```

---

## 📖 Documentación de la API

La API está documentada con Swagger/OpenAPI.

### Acceso

👉 [http://localhost:4000/docs](http://localhost:4000/docs)

### Versionado

Todos los puntos de acceso usan el prefijo `/v1/`:

```
/v1/auth/login
/v1/billing/invoices
/v1/treasury/payments
/v1/hr/employees
...
```

### Ejemplo de punto de acceso documentado

```typescript
/**
 * @swagger
 * /v1/billing/invoices:
 *   post:
 *     summary: Crear factura en modo borrador
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInvoiceDto'
 *     responses:
 *       201:
 *         description: Factura creada
 */
@Post()
async create(@Body() dto: CreateInvoiceDto) { ... }
```

---

## 🔐 Autenticación y sesión

La sesión se mantiene mediante una **cookie `httpOnly`** (`erp_token`, `SameSite=Lax`), no en
`localStorage`. El JWT también se devuelve en el cuerpo por compatibilidad con los clientes existentes.

| Ruta                            | Descripción                                                       | Acceso     |
| ------------------------------- | ----------------------------------------------------------------- | ---------- |
| `POST /v1/auth/login`           | Devuelve el JWT **y** establece la cookie                         | Público    |
| `GET /v1/auth/me`               | Perfil, permisos y sucursales del usuario autenticado             | Con sesión |
| `POST /v1/auth/logout`          | Borra la cookie                                                   | Público    |
| `POST /v1/auth/forgot-password` | Genera un token de recuperación (vigencia de 1 hora, un solo uso) | Público    |
| `POST /v1/auth/reset-password`  | Cambia la contraseña al utilizar el token                         | Público    |

- El servidor acepta el token **por cookie o mediante `Authorization: Bearer`** (mecanismo de transición).
- `forgot-password` envía un correo real si está configurada la variable `SMTP_URL` (mediante nodemailer).
  En desarrollo, si no hay SMTP, también devuelve `mockUrl` con el enlace (que además se registra en
  los registros de actividad). En producción **nunca** se devuelve el token a través de la API.
- La página `/reset-password?token=...` (pública) permite establecer la nueva contraseña; el token es de
  un solo uso y expira en 60 minutos.
- Límite de solicitudes: 5 por minuto en el inicio de sesión y 3 por minuto en la recuperación y
  el restablecimiento de contraseña.
- Todos los puntos de acceso son privados por defecto (`APP_GUARD`); los públicos se marcan con `@Public()`.

---

## ✅ Pruebas

### Pruebas de base de datos e integración (Vitest)

Las suites que utilizan la base de datos usan bases locales independientes:
`testdb_database` para el paquete `database` y `testdb_backend` para el backend.
Nunca se conectan a la base de desarrollo. Inicia el servicio PostgreSQL dedicado
a las pruebas:

```bash
docker compose -f docker-compose.test.yml up -d postgres-test
```

Antes de ejecutar las pruebas que usan la base de datos, Turbo prepara ambas bases
y aplica las migraciones de Drizzle:

```bash
# Solo el paquete database
pnpm exec turbo run test --filter=database

# Cargar datos de prueba para probar los roles y permisos (testdb_database aislada)
pnpm db:seed:test

# Solo el servidor
pnpm exec turbo run test --filter=backend

# Todas las suites
pnpm test
```

### Cuentas de prueba

Después de ejecutar `pnpm db:seed:test`, estas cuentas estarán disponibles en la
base de datos aislada de pruebas. Las seis usan la contraseña `Test1234!`.

| Rol         | Correo electrónico            |
| ----------- | ----------------------------- |
| SUPER_ADMIN | `test-super-admin@test.local` |
| ADMIN       | `test-admin@test.local`       |
| MANAGER     | `test-manager@test.local`     |
| SELLER      | `test-seller@test.local`      |
| WAREHOUSE   | `test-warehouse@test.local`   |
| ACCOUNTANT  | `test-accountant@test.local`  |

Estas credenciales son únicamente para pruebas locales. No las uses en producción.

El volumen de datos de PostgreSQL para pruebas se conserva al detener el servicio.
No agregues `-v` a menos que quieras eliminarlo explícitamente:

```bash
docker compose -f docker-compose.test.yml down
```

Consulta [docs/DATABASE-TESTING.md](./docs/DATABASE-TESTING.md) para obtener
información sobre las cuentas de prueba, las variables de entorno, las medidas de
aislamiento y la solución de problemas.

### Pruebas unitarias

Las pruebas unitarias del paquete que no necesitan acceder a PostgreSQL pueden
ejecutarse directamente:

```bash
pnpm --filter database test:unit
```

### Pruebas de extremo a extremo (Playwright)

```bash
# Instalar los navegadores
pnpm exec playwright install --with-deps chromium

# Ejecutar las pruebas
pnpm exec playwright test

# Ver el informe HTML
pnpm exec playwright show-report
```

---

## 🎨 Análisis estático y formato

```bash
# Ejecutar el análisis estático
pnpm lint

# Corregir los errores de análisis
pnpm lint:fix

# Aplicar formato al código
pnpm format

# Comprobar el formato
pnpm format:check
```

### Configuración

- `.eslintrc.js` — Configuración raíz de ESLint
- `apps/frontend/.eslintrc.js` — Configuración de la interfaz
- `apps/backend/.eslintrc.js` — Configuración del servidor
- `.prettierrc` — Prettier
- `.prettierignore` — Archivos ignorados

---

## 🪝 Hooks de Git (Husky)

Los hooks se ejecutan automáticamente en cada confirmación de cambios (commit):

1. **pre-commit**: análisis estático y formato de los archivos preparados para la confirmación
2. **commit-msg**: validación del formato Conventional Commits

### Formato de los commits

```
<tipo>(<alcance>): <descripción>

Tipos: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
```

**Ejemplos:**

```bash
git commit -m "feat(billing): agregar ruta de facturas"
git commit -m "fix(treasury): corregir cálculo de asignado"
git commit -m "docs: actualizar README"
```

### Activar Husky (configuración inicial)

```bash
pnpm prepare
```

---

## 🔧 Solución de Problemas

### El puerto 3000 o 4000 ya está en uso

```bash
# Consultar qué proceso está usando el puerto
netstat -ano | findstr :3000

# Finalizar el proceso (Windows)
taskkill /PID <PID> /F

# O cambiar el puerto en docker-compose.yml
ports:
  - "3001:3000"  # Cambia el puerto externo
```

### Los cambios no se reflejan

**Docker:**

```bash
docker compose restart monorepo
```

**Instalación local:**

```bash
pnpm turbo dev --force
```

### Error de conexión a la base de datos

1. Comprobar que PostgreSQL esté en ejecución:

   ```bash
   docker ps  # Si usa Docker
   # o
   pg_isready -h localhost -p 5432
   ```

2. Comprobar los datos de conexión en `.env`

3. Reconstruir si es necesario:
   ```bash
   docker compose down
   docker compose up --build
   ```

### Problemas con `node_modules`

**Docker:** reconstruir la imagen

```bash
docker compose down --rmi local
docker compose up --build
```

**Local:**

```bash
rm -rf node_modules
pnpm install
```

### Limpiar todo y empezar de cero

```bash
# ⚠️ Elimina TODOS los datos
docker compose down -v
docker system prune -f
docker compose up --build
```

---

## 📝 Licencia

Este proyecto es de uso privado.

---

## 📚 Documentación Adicional

- [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) — Estado verificado y brechas actuales
- [`docs/API-CONTRACTS.md`](docs/API-CONTRACTS.md) — Contratos HTTP observados en controladores
- [`docs/DATABASE-TESTING.md`](docs/DATABASE-TESTING.md) — Aislamiento, carga inicial y pruebas de PostgreSQL
- [`docs/DATABASE.md`](docs/DATABASE.md) — Catálogo histórico; `schema.ts` es la fuente vigente
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — Instantánea histórica del progreso
- [`docs/qa/README.md`](docs/qa/README.md) — Plan de pruebas visuales por tipo de usuario (MANAGER, SELLER, WAREHOUSE, ACCOUNTANT)
