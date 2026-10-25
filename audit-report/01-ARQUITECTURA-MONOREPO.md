# ARQUITECTURA MONOREPO - ERP Venezuela

## 1. Estructura General

```
nest-next-project-erp/
├── apps/
│   ├── api/          # Backend NestJS (Puerto 4000)
│   └── web/          # Frontend Next.js (Puerto 3005)
├── packages/
│   ├── db/           # Drizzle ORM (esquemas, migraciones, scripts)
│   ├── eslint-config/ # Configuración ESLint compartida
│   └── typescript-config/ # Configuración TypeScript compartida
├── .agents/          # Skills y agentes AI
├── docs/             # Documentación técnica
├── turbo.json        # Configuración Turborepo
└── package.json      # Workspace raíz
```

## 2. Configuración Turborepo (turbo.json)

```json
{
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {},
    "check-types": { "dependsOn": ["^check-types"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

### Reglas Clave de Turborepo

- **Raíz package.json**: Solo delega con `turbo run`, no ejecuta lógica directa
- **`^build`**: Ejecuta build en dependencias primero (paquetes antes de apps)
- **`turbo run`**: SIEMPRE usar en scripts, NO `turbo build`
- **outputs**: Define qué carpetas se cachean (.next/**, dist/**)

## 3. Workspaces (package.json raíz)

```json
{
  "name": "temp_init",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "check-types": "turbo run check-types",
    "db:setup": "npm run build -w @repo/db && npm run db:setup -w @repo/db",
    "db:setup:test": "npm run build -w @repo/db && npm run db:setup:test -w @repo/db"
  }
}
```

## 4. Stack Tecnológico

### Backend (apps/api)
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| NestJS | ^11.1.12 | Framework backend |
| @nestjs/jwt | ^11.0.2 | Autenticación JWT |
| @nestjs/passport | ^11.0.5 | Auth passport |
| @nestjs/swagger | ^11.2.6 | Documentación API |
| @nestjs/schedule | ^6.1.0 | Cron jobs |
| drizzle-orm | ^0.39.1 | ORM |
| postgres | (driver) | Base de datos |
| bcrypt | ^6.0.0 | Hash passwords |
| axios | ^1.13.3 | HTTP client |
| cheerio | ^1.2.0 | Web scraping BCV |
| decimal.js | ^10.6.0 | Cálculos monetarios |
| exceljs | ^4.4.0 | Exportar Excel |
| pdfkit | ^0.17.2 | Generar PDFs |

### Frontend (apps/web)
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Next.js | 16.1.5 | Framework React |
| React | 19.0.0 | UI library |
| Tailwind CSS | 4 | Styling |
| shadcn/ui | (Radix) | Componentes UI |
| Zustand | ^5.0.10 | State management |
| TanStack Query | ^5.62.7 | Server state |
| React Hook Form | ^7.71.1 | Formularios |
| Zod | ^4.3.5 | Validación |
| Recharts | ^3.6.0 | Gráficos |
| Framer Motion | ^12.29.2 | Animaciones |
| date-fns | ^4.1.0 | Fechas |
| @react-pdf/renderer | ^4.3.2 | PDFs client-side |

### Paquetes Compartidos (packages/)
| Paquete | Descripción |
|---------|-------------|
| @repo/db | Schema Drizzle, permissions, conexión BD |
| @repo/eslint-config | ESLint base, react, next |
| @repo/typescript-config | TS base, react-library, nextjs |

## 5. Paquete @repo/db

```
packages/db/
├── src/
│   ├── schema.ts         # 50+ tablas Drizzle
│   ├── index.ts          # Conexión db, client
│   └── permissions.ts    # Códigos de permisos
├── scripts/              # Seed, reset, studio
├── drizzle/              # Migraciones
│   ├── _journal.json     # Control de versiones
│   └── 0000_*.sql       # SQL migrations
├── drizzle.config.ts     # Config Drizzle
└── package.json
```

### Conexión a Base de Datos

```typescript
// packages/db/src/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
```

## 6. Variables de Entorno

```env
DATABASE_URL="postgres://user:pass@localhost:5432/erp_project_db"
PORT=4000
JWT_SECRET="alguna-clave-secreta-segura"
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

> **Nota**: Un único archivo `.env` en la raíz es compartido por Backend, Scripts y Herramientas.

## 7. Puertos y URLs

| Servicio | Puerto | URL |
|----------|--------|-----|
| Backend API | 4000 | http://localhost:4000 |
| Swagger Docs | - | http://localhost:4000/api/docs |
| Frontend Web | 3005 | http://localhost:3005 |

## 8. Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo (ambos en paralelo)
npm run dev

# Setup base de datos (reset + seed)
npm run db:setup:test

# Studio visual Drizzle
npm run db:studio

# Build production
npm run build

# Linting
npm run lint

# Type checking
npm run check-types
```

## 9. Arquitectura Backend (NestJS)

```
apps/api/src/
├── main.ts                    # Entry point (puerto 4000, prefijo /api)
├── app.module.ts              # Módulos registrados
├── common/
│   ├── decorators/            # @RequirePermission
│   └── guards/                # JwtAuthGuard, PermissionsGuard
└── modules/
    ├── auth/                  # Login/JWT
    ├── users/                 # Gestión usuarios
    ├── roles/                 # Roles y permisos
    ├── partners/               # Clientes/Proveedores
    ├── products/               # Catálogo
    ├── orders/                 # Pedidos
    ├── billing/                # Facturación
    ├── credit-notes/           # Notas de crédito
    ├── inventory/              # Productos, almacenes, moves
    ├── treasury/               # Pagos, cuentas, retenciones
    ├── hr/                     # RRHH (11 sub-controladores)
    ├── accounting/             # Contabilidad
    ├── reports/                # Reportes fiscales
    ├── branches/               # Sucursales
    ├── banks/                  # Maestro bancos
    ├── currencies/             # Monedas y tasas
    ├── tax-concepts/           # Conceptos ISLR
    ├── documents/               # Enlaces documentales
    ├── loans/                  # Préstamos inventario
    ├── bi/                     # Dashboard KPIs
    ├── audit/                  # Log auditoría
    └── cron/                   # BCV scraper
```

## 10. Arquitectura Frontend (Next.js App Router)

```
apps/web/
├── app/
│   ├── page.tsx               # Landing/redirect
│   ├── layout.tsx             # Root layout
│   ├── globals.css            # Tailwind + CSS variables
│   ├── login/page.tsx         # Login
│   ├── forbidden/page.tsx      # 403
│   └── dashboard/
│       ├── page.tsx           # BI Dashboard
│       ├── layout.tsx         # AuthGuard + Sidebar
│       ├── operations/        # Ventas, compras, partners
│       ├── inventory/          # Productos, almacenes, moves
│       ├── billing/           # Facturas
│       ├── treasury/           # Pagos, cuentas, retenciones, cierre
│       ├── hr/                 # Empleados, nóminas, departamentos
│       ├── settings/           # Usuarios, monedas, bancos
│       └── branches/           # Sucursales
├── components/
│   ├── ui/                    # 30+ componentes shadcn/ui
│   ├── navigation/            # Sidebar, breadcrumbs
│   ├── layout/                # Headers, page header
│   ├── auth/                  # Login form, auth guard
│   └── guide/                 # Sistema de tours
├── modules/                   # 14 módulos feature
│   ├── billing/
│   ├── treasury/
│   ├── hr/
│   ├── inventory/
│   ├── partners/
│   ├── orders/
│   └── ... (más)
├── stores/                    # Zustand stores
├── hooks/                     # Custom hooks
├── lib/                       # API client, utils
├── types/                     # Tipos TypeScript
└── config/                    # Permissions config
```

## 11. Recomendaciones para Docker-Proyecto-Turbo

### Estructura Sugerida

```
docker-proyecto-turbo/
├── apps/
│   ├── api/                   # NestJS
│   └── web/                   # Next.js
├── packages/
│   ├── db/                    # Drizzle + schemas
│   ├── config/                # ESLint, TS
│   └── shared/                # Código compartido (opcional)
├── docker-compose.yml
├── turbo.json
└── package.json
```

### Docker Compose Recomendado

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: erp_db
      POSTGRES_USER: erp_user
      POSTGRES_PASSWORD: erp_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./apps/api
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgres://erp_user:erp_pass@postgres:5432/erp_db
    depends_on:
      - postgres

  web:
    build: ./apps/web
    ports:
      - "3005:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000
    depends_on:
      - api

volumes:
  postgres_data:
```
