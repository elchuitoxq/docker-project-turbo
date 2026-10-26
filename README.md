# 🚀 ERP Venezuela - Monorrepo Dockerizado

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
- [Testing](#-testing)
- [Linting y Formatting](#-linting-y-formatting)
- [Git Hooks](#-git-hooks)
- [Solución de Problemas](#-solución-de-problemas)

---

## 🏗 Arquitectura del Proyecto

Este proyecto utiliza una arquitectura de **monorrepo** gestionada por **Turborepo** y **pnpm**.

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
│  │  │  packages/database (Drizzle Schema)             │ │  │
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

### Módulos del Backend (20+)

| Módulo         | Prefijo API      | Descripción                 |
| -------------- | ---------------- | --------------------------- |
| **Auth**       | `/v1/auth`       | Login, JWT, forgot-password |
| **Users**      | `/v1/users`      | Gestión de usuarios         |
| **Billing**    | `/v1/billing`    | Facturación (CRÍTICO)       |
| **Treasury**   | `/v1/treasury`   | Pagos, cuentas, métodos     |
| **HR**         | `/v1/hr`         | Nómina, empleados           |
| **Inventory**  | `/v1/inventory`  | Productos, stock            |
| **Orders**     | `/v1/orders`     | Pedidos                     |
| **Partners**   | `/v1/partners`   | Clientes/Proveedores        |
| **Products**   | `/v1/products`   | Catálogo                    |
| **Settings**   | `/v1/settings`   | Bancos, monedas, conceptos  |
| **Accounting** | `/v1/accounting` | Asientos contables          |
| **Loans**      | `/v1/loans`      | Préstamos                   |
| **Reports**    | `/v1/reports`    | Reportes fiscales           |
| **Audit**      | `/v1/audit`      | Logs de auditoría           |
| **BI**         | `/v1/bi`         | KPIs y dashboards           |
| **Cron**       | `/v1/cron`       | Jobs programados            |
| **Branches**   | `/v1/branches`   | Sucursales                  |

---

## 🛠 Tecnologías Utilizadas

| Tecnología          | Versión                                 | Propósito             |
| ------------------- | --------------------------------------- | --------------------- |
| **Node.js**         | `26-alpine3.23`                         | Runtime               |
| **pnpm**            | `10.0.0`                                | Gestor de paquetes    |
| **Turborepo**       | `2.11.10`                               | Orquestador de tareas |
| **Next.js**         | `16.4.3`                                | Frontend (App Router) |
| **React**           | `19.3.1`                                | Librería UI           |
| **NestJS**          | `12.2.0`                                | Backend (API REST)    |
| **TypeScript**      | `6.0.3` (workspace), `5.9.3` (frontend) | Tipado estático       |
| **Drizzle ORM**     | `0.45.4`                                | ORM                   |
| **Drizzle Kit**     | `0.31.11`                               | CLI para migraciones  |
| **PostgreSQL**      | `18.4-alpine3.23`                       | Base de datos         |
| **Swagger/OpenAPI** | `7.4.2`                                 | Documentación API     |
| **Vitest**          | `5.0.5`                                 | Testing unitario      |
| **Tailwind CSS**    | `4.3.3`                                 | Estilos               |
| **Playwright**      | `1.64.1`                                | Testing e2e           |
| **ESLint**          | `9.39.5`                                | Linting               |
| **Prettier**        | `3.9.10`                                | Formateo              |
| **Husky**           | `9.1.7`                                 | Git hooks             |
| **Docker**          | Compose v2                              | Contenedorización     |

> El frontend conserva TypeScript `5.9.3` porque `openapi-typescript` declara
> compatibilidad con TypeScript 5; la versión `6.0.3` queda para las herramientas
> compartidas del workspace.

---

## ✅ Requisitos Previos

### Para desarrollo con Docker

- **Docker Desktop** (Windows/Mac) o Docker Engine (Linux)
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
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
PORT=4000
BCV_API_URL=https://www.bcv.org.ve
```

---

## 🐳 Desarrollo con Docker

### Dev full con Docker (todos los servicios)

```bash
pnpm dev:docker:up          # levanta los servicios base (postgres, db-setup, backend, frontend)
# o
docker compose up -d

# herramientas opcionales (pgAdmin, Drizzle Studio, Prism Mock)
pnpm dev:docker:tools
```

Servicios que se levantan:

| Servicio                              | Contenedor      | Puerto host | URL                                                    |
| ------------------------------------- | --------------- | ----------- | ------------------------------------------------------ |
| **PostgreSQL**                        | `mono-postgres` | 5432        | `localhost:5432`                                       |
| **Backend** (NestJS + Swagger)        | `mono-backend`  | 4000        | `http://localhost:4000` · `http://localhost:4000/docs` |
| **Frontend** (Next.js)                | `mono-frontend` | 3000        | `http://localhost:3000`                                |
| **Prism Mock** (perfil `tools`)       | `mono-mock`     | 4010        | `http://localhost:4010`                                |
| **Drizzle Studio** (perfil `tools`)   | `mono-drizzle`  | 4983        | `https://local.drizzle.studio/?host=localhost:4983`    |
| **pgAdmin** (perfil `tools`)          | `mono-pgadmin`  | 5050        | `http://localhost:5050`                                |
| **db-setup** (one-shot: migra + seed) | `mono-db-setup` | —           | termina con `exit 0`                                   |

**Orden de arranque:** `postgres` (healthcheck) → `db-setup` (migraciones + seed, termina) →
`backend` (healthcheck `/health`) → `frontend` (healthcheck `/`). Las herramientas del perfil
`tools` se levantan aparte con `pnpm dev:docker:tools`.

**Conectividad entre servicios:**

- `frontend` (dentro de Docker) habla al `backend` por `http://backend:4000` (nombre del servicio en la red compose).
- `mock` lee el `openapi.json` generado por el `backend` desde el volumen compartido `apps/backend/docs/`.
- `drizzle-studio` se conecta a `postgres:5432` por la red interna de compose.
- Desde el **host**, abrí `https://devtools.nestjs.com` y se conectará a `ws://localhost:8000` (publicado al host).

> ⚠️ **Limitación de DevTools:** el UI público `devtools.nestjs.com` necesita alcanzar `ws://localhost:8000` del host. Funciona en **Docker Desktop (Windows/Mac)**. En **Linux vanilla** no funciona; workaround: agregar `network_mode: host` al servicio `backend` (y eliminar el `ports: 8000:8000`).

### Dev con Docker (solo lo mínimo)

```bash
docker compose up postgres backend frontend
```

Levanta solo la triada mínima. Útil cuando no necesitás mock ni Drizzle Studio.

### Comandos Docker

| Comando                                               | Descripción                                  |
| ----------------------------------------------------- | -------------------------------------------- |
| `pnpm dev:docker:up` o `docker compose up`            | Levantar todos los servicios                 |
| `pnpm dev:docker:build` o `docker compose up --build` | Reconstruir imágenes y levantar              |
| `pnpm dev:docker:down` o `docker compose down`        | Detener y eliminar contenedores              |
| `docker compose down -v`                              | ⚠️ Eliminar también volúmenes (pierde datos) |
| `pnpm dev:docker:logs` o `docker compose logs -f`     | Ver logs en tiempo real                      |
| `pnpm dev:docker:ps` o `docker compose ps`            | Estado de los contenedores                   |
| `docker compose logs -f backend`                      | Logs solo del backend                        |
| `docker compose exec backend sh`                      | Shell dentro del container backend           |

### Hot reload

Los bind mounts selectivos sincronizan tu código local con los containers:

- **Backend**: cambios en `apps/backend/src/` y `packages/*/src/` se reflejan al instante (NestJS watch mode).
- **Frontend**: cambios en `apps/frontend/{app,components,lib,public,styles}/` y configs se reflejan.
- ⚠️ Si agregás una dependencia (`pnpm add ...`), el container no la tendrá. Ejecutá: `docker compose exec backend pnpm install`.

---

## 💻 Desarrollo Local (sin Docker)

### Requisitos

1. **Node.js 26+** y **pnpm 10+**
2. **PostgreSQL 18** corriendo en puerto `5432`

### Setup

```bash
# Instalar dependencias
pnpm install

# Generar migraciones (primera vez)
pnpm --filter database db:generate

# Aplicar migraciones
pnpm --filter database db:migrate

# Ejecutar seed de roles y permisos
pnpm --filter database db:seed:core

# Iniciar desarrollo
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
# Shell interactivo
docker compose exec backend sh

# Turborepo
docker compose exec backend pnpm turbo run build
docker compose exec backend pnpm turbo run db:generate

# Tests
docker compose exec backend pnpm --filter backend test
docker compose exec backend pnpm --filter database test
```

### En el host (desarrollo local)

```bash
# Dependencias
pnpm install
pnpm add --filter backend <paquete>
pnpm add --filter frontend <paquete>

# Desarrollo (todo en paralelo)
pnpm turbo dev
pnpm turbo build

# Desarrollo por herramienta (terminales separadas)
pnpm dev:api         # Backend + Swagger (http://localhost:4000)
pnpm dev:devtools    # NestJS DevTools (https://devtools.nestjs.com)
pnpm dev:mock        # Prism Mock Server (http://localhost:4010)
pnpm dev:frontend    # Frontend Next.js (http://localhost:3000)
pnpm dev:db          # Drizzle Studio (https://local.drizzle.studio/?host=127.0.0.1:4983)

# OpenAPI / tipos compartidos
pnpm openapi:export  # Regenera apps/backend/docs/openapi.json
pnpm sync:types      # Regenera packages/shared-types/src/api-types.ts

# Database
pnpm --filter database db:generate
pnpm --filter database db:migrate
pnpm --filter database db:seed:core

# Calidad
pnpm lint
pnpm typecheck
pnpm format:check

# Testing
pnpm test
pnpm test --filter backend
pnpm test --filter database
pnpm test:e2e        # Playwright (levanta el frontend automáticamente)
pnpm test:coverage

# Linting
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
> si fuera una página: ese endpoint no sirve la UI y puede responder `404`.

#### Con Docker Compose

El servicio `drizzle-studio` se inicia junto con el resto de servicios mediante
`pnpm dev:docker:up`. Accede a la interfaz con esta URL:

```text
https://local.drizzle.studio/?host=localhost:4983
```

Verifica que PostgreSQL y Studio estén activos con:

```bash
docker compose ps postgres drizzle-studio
docker compose logs --tail 30 drizzle-studio
```

#### Ejecución directa en el host

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

# Studio con logs verbose
pnpm --filter database db:studio:verbose

# Generar migraciones
pnpm --filter database db:generate

# Aplicar migraciones
pnpm --filter database db:migrate
```

---

## 📁 Estructura de Carpetas

```
docker-project-turbo/
├── apps/
│   ├── frontend/                 # Next.js 16 (App Router)
│   │   ├── app/                # Pages y layouts
│   │   ├── src/               # Componentes, hooks, libs
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── backend/                # NestJS 12
│       ├── src/
│       │   ├── modules/       # Módulosfeature
│       │   │   ├── auth/      # Login, JWT
│       │   │   ├── billing/   # Facturas
│       │   │   ├── treasury/   # Pagos
│       │   │   ├── hr/        # Nómina
│       │   │   └── ...       # (20+ módulos)
│       │   ├── common/        # Decoradores, guards
│       │   └── main.ts        # Entry point
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── database/               # Drizzle ORM
│       ├── src/
│       │   └── index.ts      # Schema y cliente
│       ├── scripts/           # Seeds y utilities
│       ├── drizzle.config.ts  # Config Drizzle Kit
│       └── package.json
│
├── docs/                      # Documentación
│   └── DATABASE.md            # Catálogo de tablas
│
├── docker-compose.yml         # Orquestación
├── Dockerfile.dev              # Imagen de desarrollo
├── .env                       # Variables de entorno
├── .dockerignore
├── package.json              # Raíz monorrepo
├── pnpm-workspace.yaml       # Workspaces pnpm
├── turbo.json                # Pipelines Turborepo
└── README.md
```

---

## 🔌 Servicios y Puertos

### En Docker (todo integrado)

| Servicio       | Contenedor      | Puerto Local | Descripción      |
| -------------- | --------------- | ------------ | ---------------- |
| **Frontend**   | `mono-app`      | `3000`       | Next.js          |
| **Backend**    | `mono-app`      | `4000`       | NestJS + Swagger |
| **PostgreSQL** | `mono-postgres` | `5432`       | Base de datos    |

### En dev local (herramientas nativas de NestJS)

| Servicio               | Puerto | URL                                                             | Script              | Descripción                                               |
| ---------------------- | ------ | --------------------------------------------------------------- | ------------------- | --------------------------------------------------------- |
| **Backend API**        | 4000   | `http://localhost:4000`                                         | `pnpm dev:api`      | NestJS con Swagger UI                                     |
| └ Swagger UI           | 4000   | `http://localhost:4000/docs`                                    | (incluido)          | Documentación interactiva                                 |
| └ OpenAPI JSON         | 4000   | `http://localhost:4000/docs-json`                               | (incluido)          | Spec OpenAPI 3.0 servido en runtime                       |
| **NestJS DevTools**    | 8000   | `https://devtools.nestjs.com` (conecta a `ws://localhost:8000`) | `pnpm dev:devtools` | Grafo de módulos en vivo, request tracing, profiling      |
| **Prism Mock Server**  | 4010   | `http://localhost:4010`                                         | `pnpm dev:mock`     | Mock del backend generado desde `openapi.json`            |
| **Frontend** (Next.js) | 3000   | `http://localhost:3000`                                         | `pnpm dev:frontend` | Usa el mock o el backend real según `NEXT_PUBLIC_API_URL` |
| **Drizzle Studio**     | 4983   | `https://local.drizzle.studio/?host=localhost:4983`             | `pnpm dev:db`       | GUI para la base de datos                                 |

> **Tip:** abrí cada herramienta en una terminal separada con su `pnpm dev:*`. Para que el frontend consuma el mock: `NEXT_PUBLIC_API_URL=http://localhost:4010`. Para que consuma el backend real: `http://localhost:4000`.

### Flujo típico de dev

```bash
# Terminal 1: Backend
pnpm dev:api            # → http://localhost:4000/docs

# Terminal 2: DevTools (opcional)
pnpm dev:devtools       # → https://devtools.nestjs.com

# Terminal 3: Mock server (opcional, si frontend no usa backend real)
pnpm --filter backend openapi:export
pnpm dev:mock           # → http://localhost:4010

# Terminal 4: Frontend
NEXT_PUBLIC_API_URL=http://localhost:4010 pnpm dev:frontend

# Terminal 5: Drizzle Studio (opcional)
pnpm dev:db             # → https://local.drizzle.studio
```

### Regenerar tipos compartidos

Cuando cambies un DTO del backend:

```bash
pnpm openapi:export     # regenera apps/backend/docs/openapi.json
pnpm sync:types         # regenera packages/shared-types/src/api-types.ts
```

---

## 🗃 Base de Datos

### Credenciales

| Variable            | Valor                                                |
| ------------------- | ---------------------------------------------------- |
| `POSTGRES_USER`     | `myuser`                                             |
| `POSTGRES_PASSWORD` | `mypassword`                                         |
| `POSTGRES_DB`       | `mydb`                                               |
| `DATABASE_URL`      | `postgresql://myuser:mypassword@localhost:5432/mydb` |

### Catálogo de Tablas

Consulta el archivo completo en [`docs/DATABASE.md`](docs/DATABASE.md).

**Resumen de esquemas:**

| Esquema          | Tablas  | Descripción                   |
| ---------------- | ------- | ----------------------------- |
| Security & Audit | 8       | Usuarios, roles, permisos     |
| Core             | 6       | Sucursales, monedas, partners |
| Inventory        | 7       | Productos, stock, movimientos |
| Orders & Billing | 7       | Pedidos, facturas, NC         |
| Treasury         | 7       | Pagos, cuentas, retenciones   |
| HR               | 15      | Empleados, nóminas            |
| Accounting       | 4       | Plan de cuentas, asientos     |
| Loans            | 2       | Préstamos                     |
| **Total**        | **56+** |                               |

### Flujo de trabajo

```bash
# 1. Modificar schema en packages/database/src/index.ts

# 2. Generar migración SQL
pnpm --filter database db:generate

# 3. Revisar migración en packages/database/drizzle/

# 4. Aplicar migración
pnpm --filter database db:migrate
```

### Respaldos

```bash
# Crear respaldo (desde host)
docker exec mono-postgres pg_dump -U myuser -d mydb -F c > backup.dump

# Restaurar respaldo
docker exec -i mono-postgres pg_restore -U myuser -d mydb < backup.dump
```

---

## 📖 Documentación de la API

La API está documentada con Swagger/OpenAPI.

### Acceder

👉 [http://localhost:4000/docs](http://localhost:4000/docs)

### Versionamiento

Todos los endpoints usan el prefijo `/v1/`:

```
/v1/auth/login
/v1/billing/invoices
/v1/treasury/payments
/v1/hr/employees
...
```

### Ejemplo de endpoint documentado

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

La sesión viaja en una **cookie `httpOnly`** (`erp_token`, `SameSite=Lax`), no en `localStorage`.
El JWT también se devuelve en el body por compatibilidad con clientes existentes.

| Endpoint                        | Descripción                                            | Acceso     |
| ------------------------------- | ------------------------------------------------------ | ---------- |
| `POST /v1/auth/login`           | Devuelve el JWT **y** setea la cookie                  | Público    |
| `GET /v1/auth/me`               | Perfil + permisos + sucursales del usuario autenticado | Con sesión |
| `POST /v1/auth/logout`          | Borra la cookie                                        | Público    |
| `POST /v1/auth/forgot-password` | Genera un token de recuperación (TTL 1 h, un solo uso) | Público    |
| `POST /v1/auth/reset-password`  | Cambia la contraseña consumiendo el token              | Público    |

- El backend acepta el token **por cookie o por `Authorization: Bearer`** (transición).
- `forgot-password` envía un correo real si `SMTP_URL` está configurada (nodemailer); en desarrollo
  sin SMTP devuelve además `mockUrl` con el enlace (el mismo se escribe en el log). En producción
  **nunca** se devuelve el token por la API.
- La página `/reset-password?token=...` (pública) permite fijar la nueva contraseña; el token es de
  un solo uso y expira en 60 minutos.
- Rate limiting: 5 req/min en login, 3 req/min en forgot/reset.
- Todo endpoint es privado por defecto (`APP_GUARD`); lo público se marca con `@Public()`.

---

## ✅ Testing

### Database and integration tests (Vitest)

Both database-backed suites use separate local databases: `testdb_database` for the
`database` package and `testdb_backend` for the backend. They never use the
development database. Start the dedicated PostgreSQL test service:

```bash
docker compose -f docker-compose.test.yml up -d postgres-test
```

Turbo prepares both databases and applies the Drizzle migrations before the
database-backed test tasks run:

```bash
# Solo el paquete database
pnpm exec turbo run test --filter=database

# Cargar fixtures para probar los roles y permisos (testdb_database aislada)
pnpm db:seed:test

# Solo backend
pnpm exec turbo run test --filter=backend

# Todas las suites
pnpm test
```

The test PostgreSQL data volume is retained when stopping the service. Do not
add `-v` unless you explicitly intend to delete it:

```bash
docker compose -f docker-compose.test.yml down
```

See [docs/DATABASE-TESTING.md](./docs/DATABASE-TESTING.md) for test accounts,
environment overrides, isolation safeguards, and troubleshooting.

### Unit Tests

Package-level unit tests that do not access PostgreSQL can be run directly:

```bash
pnpm --filter database test:unit
```

### E2E Tests (Playwright)

```bash
# Instalar browsers
pnpm exec playwright install --with-deps chromium

# Correr tests
pnpm exec playwright test

# Ver reporte HTML
pnpm exec playwright show-report
```

---

## 🎨 Linting y Formatting

```bash
# Verificar lint
pnpm lint

# Corregir errores
pnpm lint:fix

# Formatear código
pnpm format

# Verificar formato
pnpm format:check
```

### Configuración

- `.eslintrc.js` — ESLint raíz
- `apps/frontend/.eslintrc.js` — Frontend
- `apps/backend/.eslintrc.js` — Backend
- `.prettierrc` — Prettier
- `.prettierignore` — Archivos ignorados

---

## 🪝 Git Hooks (Husky)

Los hooks se ejecutan automáticamente en cada commit:

1. **pre-commit**: Linting y formateo de archivos staged
2. **commit-msg**: Validación de formato Conventional Commits

### Formato de commits

```
<tipo>(<scope>): <descripción>

Tipos: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
```

**Ejemplos:**

```bash
git commit -m "feat(billing): agregar endpoint de facturas"
git commit -m "fix(treasury): corregir cálculo de asignado"
git commit -m "docs: actualizar README"
```

### Activar Husky (primer setup)

```bash
pnpm prepare
```

---

## 🔧 Solución de Problemas

### El puerto 3000 o 4000 ya está en uso

```bash
# Ver qué proceso usa el puerto
netstat -ano | findstr :3000

# Matar el proceso (Windows)
taskkill /PID <PID> /F

# O cambiar el puerto en docker-compose.yml
ports:
  - "3001:3000"  # Cambia el externo
```

### Los cambios no se reflejan

**Docker:**

```bash
docker compose restart monorepo
```

**Local:**

```bash
pnpm turbo dev --force
```

### Error de conexión a la base de datos

1. Verificar que PostgreSQL esté corriendo:

   ```bash
   docker ps  # Si usa Docker
   # o
   pg_isready -h localhost -p 5432
   ```

2. Verificar credenciales en `.env`

3. Reconstruir si es necesario:
   ```bash
   docker compose down
   docker compose up --build
   ```

### Problemas con node_modules

**Docker:** Reconstruir imagen

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
- [`docs/DATABASE-TESTING.md`](docs/DATABASE-TESTING.md) — Aislamiento, seed y pruebas PostgreSQL
- [`docs/DATABASE.md`](docs/DATABASE.md) — Catálogo histórico; schema.ts es la fuente vigente
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — Snapshot histórico de progreso
