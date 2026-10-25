# PLAN DE IMPLEMENTACIÓN ERP VENEZUELA v2.1

## Monorepo Turbo - Escalabilidad y Calidad

**Fecha:** 2026-06-01
**Versión:** 2.1
**Estado:** Histórico; no es el plan vigente ni fuente de estado.

> Consultar [`PROJECT-STATUS.md`](./PROJECT-STATUS.md) para el estado
> observado y [`API-CONTRACTS.md`](./API-CONTRACTS.md) para contratos
> contrastados con los controladores actuales. Las versiones y estados que se
> muestran en este plan corresponden al snapshot del 2026-06-01.

---

## TABLA DE CONTENIDOS

1. [Visión General](#1-visión-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [FASE 1: Database (Drizzle)](#3-fase-1-database-drizzle)
4. [FASE 2: Backend (NestJS)](#4-fase-2-backend-nestjs)
5. [FASE 3: Frontend (Next.js + shadcn)](#5-fase-3-frontend-nextjs--shadcn)
6. [Dependencias entre Fases](#6-dependencias-entre-fases)
7. [Documentación](#7-documentación)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. VISIÓN GENERAL

### Stack Tecnológico

| Capa             | Tecnología             | Versión     |
| ---------------- | ---------------------- | ----------- |
| Base de Datos    | PostgreSQL             | 16          |
| ORM              | Drizzle ORM            | ^0.45       |
| Backend          | NestJS                 | ^11.x       |
| Frontend         | Next.js                | 16.x        |
| UI Components    | shadcn/ui              | (Radix)     |
| State Management | Zustand                | ^5.x        |
| API Client       | Axios + TanStack Query | ^5.x        |
| Forms            | React Hook Form + Zod  | ^7.x / ^4.x |
| Testing Unit     | Vitest                 | ^2.x        |
| Testing E2E      | Playwright             | ^1.x        |
| Build Tool       | Turborepo              | latest      |
| Package Manager  | pnpm                   | 10.x        |

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                   Next.js + shadcn/ui                       │
│                    Puerto: 3005                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                              │
│                      NestJS + Drizzle                      │
│                    Puerto: 4000                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SQL
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     POSTGRESQL                              │
│                    Puerto: 5432                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ESTRUCTURA DEL PROYECTO

```
docker-project-turbo/
├── apps/
│   ├── backend/                    # NestJS API
│   │   ├── src/
│   │   │   ├── modules/           # 20+ módulos
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── billing/
│   │   │   │   ├── treasury/
│   │   │   │   ├── hr/
│   │   │   │   └── ...
│   │   │   ├── common/             # Guards, decorators
│   │   │   └── main.ts
│   │   ├── tests/                 # Tests SEPARADOS
│   │   │   ├── unit/
│   │   │   └── e2e/
│   │   └── docs/                   # Swagger docs por módulo
│   │       └── modules/
│   └── frontend/                   # Next.js App Router
│       ├── app/                   # Páginas
│       ├── components/             # shadcn/ui
│       ├── modules/                # Feature modules
│       ├── stores/                 # Zustand
│       ├── hooks/                  # Custom hooks
│       ├── tests/                  # Tests SEPARADOS
│       │   ├── unit/
│       │   └── e2e/
│       └── docs/                   # Docs por módulo
├── packages/
│   ├── database/                   # Drizzle ORM
│   │   ├── src/
│   │   │   ├── schema.ts          # 50+ tablas
│   │   │   ├── relations.ts       # Relaciones
│   │   │   └── permissions.ts     # RBAC
│   │   ├── scripts/               # DB scripts
│   │   │   ├── reset.ts           # Reset completo
│   │   │   ├── seed-test.ts       # Seed 6 niveles
│   │   │   └── seed-faker.ts      # Faker data
│   │   ├── tests/                 # Tests SEPARADOS
│   │   │   └── unit/
│   │   └── drizzle/               # Migraciones
│   ├── eslint-config/
│   └── typescript-config/
├── docs/
│   ├── PROGRESS.md                # Tracking
│   ├── PLANNING.md                # Este documento
│   └── SPECIFICATIONS/            # Especificaciones
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

---

## 3. FASE 1: DATABASE (Drizzle)

> **⚠️ IMPORTANTE:** La especificación detallada del schema Drizzle está en [docs/SPECIFICATIONS/database-spec.md](./SPECIFICATIONS/database-spec.md)
>
> Este archivo contiene:
>
> - Schema TypeScript completo de las 50+ tablas
> - Relaciones Drizzle (40+)
> - Permisos RBAC completos (40+)
> - Roles por defecto con sus permisos
> - Payment methods y códigos especiales
> - Lógica de negocio (IVA, IGTF, LOTTT)

### 3.1 Schema Tables (50+) - Resumen

#### Audit & Security

| Tabla               | Descripción                          |
| ------------------- | ------------------------------------ |
| `audit_logs`        | Log de auditoría de cambios          |
| `permissions`       | Catálogo de permisos RBAC            |
| `roles`             | Roles (ADMIN, MANAGER, SELLER, etc.) |
| `users`             | Usuarios del sistema                 |
| `users_roles`       | Junction user-role                   |
| `users_branches`    | Multitenant branches                 |
| `user_app_settings` | Settings de UI por usuario           |

#### Core

| Tabla                  | Descripción              |
| ---------------------- | ------------------------ |
| `branches`             | Sucursales               |
| `currencies`           | Monedas (USD, VES)       |
| `exchange_rates`       | Tasas BCV                |
| `tax_concepts`         | Conceptos ISLR           |
| `partners`             | Clientes y Proveedores   |
| `organization_modules` | Módulos por organización |

#### Inventory

| Tabla                  | Descripción               |
| ---------------------- | ------------------------- |
| `warehouses`           | Almacenes                 |
| `product_categories`   | Categorías de productos   |
| `products`             | Catálogo de productos     |
| `product_batches`      | Lotes de productos        |
| `stock`                | Stock por almacén         |
| `inventory_moves`      | Movimientos de inventario |
| `inventory_move_lines` | Líneas de movimiento      |

#### Orders & Billing

| Tabla                | Descripción                 |
| -------------------- | --------------------------- |
| `orders`             | Pedidos                     |
| `order_items`        | Ítems de pedido             |
| `invoices`           | Facturas                    |
| `invoice_items`      | Ítems de factura            |
| `credit_notes`       | Notas de crédito            |
| `credit_note_items`  | Ítems de NC                 |
| `credit_note_usages` | Uso de NC para cruzar saldo |

#### Treasury

| Tabla                     | Descripción               |
| ------------------------- | ------------------------- |
| `payment_methods`         | Métodos de pago           |
| `bank_accounts`           | Cuentas bancarias empresa |
| `payments`                | Pagos                     |
| `payment_allocations`     | Asignaciones pago-factura |
| `payment_method_accounts` | Junction método-cuenta    |
| `tax_retentions`          | Retenciones fiscales      |
| `tax_retention_lines`     | Líneas de retención       |
| `document_links`          | Enlaces polimórficos      |

#### HR

| Tabla                     | Descripción              |
| ------------------------- | ------------------------ |
| `banks`                   | Catálogo maestro SUDEBAN |
| `departments`             | Departamentos            |
| `job_positions`           | Cargos                   |
| `employees`               | Empleados                |
| `employee_contracts`      | Contratos LOTTT          |
| `employee_benefits`       | Beneficios               |
| `employee_vacations`      | Vacaciones               |
| `employee_profit_sharing` | Utilidades               |
| `payroll_runs`            | Corridas de nómina       |
| `payroll_items`           | Detalle nómina           |
| `payroll_item_lines`      | Líneas de concepto       |
| `payroll_settings`        | Configuraciones          |
| `payroll_concept_types`   | Tipos de conceptos       |
| `payroll_incidents`       | Novedades                |
| `employee_salary_history` | Histórico salarial       |

#### Accounting

| Tabla                    | Descripción        |
| ------------------------ | ------------------ |
| `accounting_accounts`    | Plan de cuentas    |
| `accounting_entries`     | Asientos contables |
| `accounting_entry_lines` | Líneas de asiento  |
| `accounting_maps`        | Mapas contables    |

#### Loans

| Tabla        | Descripción             |
| ------------ | ----------------------- |
| `loans`      | Préstamos de inventario |
| `loan_items` | Ítems de préstamo       |

#### MEJORA: employeeBankAccounts

| Tabla                    | Descripción                                 |
| ------------------------ | ------------------------------------------- |
| `employee_bank_accounts` | Cuentas bancarias normalizadas de empleados |

### 3.2 Scripts Database

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:reset": "tsx scripts/reset.ts",
    "db:seed": "tsx scripts/seed-test.ts",
    "db:seed:faker": "tsx scripts/seed-faker.ts",
    "db:recalculate": "tsx scripts/recalculate-balances.ts"
  }
}
```

### 3.3 Seed Strategy (6 Niveles)

```
L1: Infrastructure    → Roles → Users → Branches
L1.6: HR             → Positions → Employees
L2: Finance          → Currencies → Rates → BankAccounts
L3: Masters          → Partners → Products
L4: Inventory        → Warehouses → Stock
L5: Transactions     → Orders → Invoices → CreditNotes
L6: Treasury         → Payments (delegated)
L7.5: Final          → Recalculate Bank Balances
```

---

## 4. FASE 2: BACKEND (NestJS)

### 4.1 Módulos (20+)

| Módulo       | Endpoints | Descripción                             |
| ------------ | --------- | --------------------------------------- |
| auth         | 3         | Login, forgot/reset password (mock)     |
| users        | 5         | CRUD usuarios                           |
| roles        | 6         | Roles y permisos                        |
| partners     | 5         | Clientes/Proveedores                    |
| products     | 4         | Catálogo                                |
| orders       | 8         | Pedidos                                 |
| billing      | 8         | Facturación ⚠️ CRÍTICO                  |
| credit-notes | 3         | Notas de crédito                        |
| inventory    | 8         | Almacenes, movimientos                  |
| treasury     | 11+       | Pagos, cuentas ⚠️ CRÍTICO               |
| hr           | 25+       | RRHH ⚠️ CRÍTICO                         |
| accounting   | 0         | Solo servicios (sin controller público) |
| reports      | 6         | Reportes fiscales                       |
| branches     | 5         | Sucursales                              |
| banks        | 4         | Catálogo bancos                         |
| currencies   | 4         | Monedas y tasas                         |
| tax-concepts | 5         | Conceptos ISLR                          |
| documents    | 1         | Enlaces documentales                    |
| loans        | 2         | Préstamos                               |
| bi           | 3         | Dashboard KPIs                          |
| audit        | 1         | Log auditoría                           |
| cron         | 1         | BCV Scraper                             |

### 4.2 Lógica Crítica

#### Billing: IVA e IGTF

```typescript
// Cálculo de factura
totalBase = Σ(item.quantity × item.price)
totalTax = totalBase × (isExempt ? 0 : 0.16) // IVA 16%
totalIgtf = (applyIgtf && currency !== 'VES')
  ? (totalBase + totalTax) × 0.03
  : 0
total = totalBase + totalTax + totalIgtf
```

#### Treasury: voidPayment (8 pasos)

1. Validar NC hijos no gastados
2. Revertir saldo banco
3. Liberar credit note usages
4. Eliminar NC daughters
5. Limpiar retenciones
6. Eliminar allocations
7. Limpiar document links
8. Reabrir facturas

#### HR: Cálculos Venezuela (LOTTT)

```typescript
// Deducciones empleado
SSO_EMP = baseSalary × 0.04      // 4%
FAOV_EMP = baseSalary × 0.01      // 1%
PIE_EMP = baseSalary × 0.005     // 0.5%

// Cargas patronales
SSO_PAT = baseSalary × 0.10      // 10%
FAOV_PAT = baseSalary × 0.02     // 2%
PIE_PAT = baseSalary × 0.02      // 2%
```

### 4.3 Swagger Documentation

Cada módulo tendrá `.md` en `apps/backend/docs/modules/`:

- Descripción completa
- Todos los endpoints
- DTOs con ejemplos
- Responses (200, 400, 401, 403, 404, 500)
- Notas de implementación

---

## 5. FASE 3: FRONTEND (Next.js + shadcn)

### 5.1 shadcn/ui Components (32+)

```
components/ui/
├── feedback/         # alert, alert-dialog, badge, toast, sonner
├── buttons/         # button
├── data-display/    # avatar, skeleton
├── forms/          # form, input, label, textarea, select, checkbox, switch, field, calendar
├── layout/         # card, separator, scroll-area, tabs
├── overlays/       # dialog, dropdown-menu, popover, sheet, tooltip
├── navigation/     # breadcrumb, sidebar
└── tables/        # table
```

### 5.2 Páginas (31)

```
app/
├── page.tsx                    # /
├── login/page.tsx             # /login
├── forbidden/page.tsx         # /forbidden
└── dashboard/
    ├── page.tsx               # /dashboard (BI)
    ├── layout.tsx             # AuthGuard + Sidebar
    ├── billing/invoices/
    ├── treasury/
    │   ├── page.tsx
    │   ├── accounts/
    │   ├── statements/[partnerId]/
    │   ├── retentions/
    │   ├── daily-close/
    │   └── reports/
    ├── inventory/
    │   ├── products/
    │   ├── warehouses/
    │   └── moves/
    ├── operations/
    │   ├── sales/
    │   ├── purchases/
    │   ├── partners/[id]/statement/
    │   └── orders/
    ├── hr/
    │   ├── employees/[id]/
    │   ├── departments/
    │   ├── positions/
    │   ├── payroll/[id]/
    │   ├── incidents/
    │   └── settings/
    ├── settings/
    │   ├── users/
    │   ├── tax-concepts/
    │   ├── methods/
    │   ├── payroll-concepts/
    │   ├── payroll-settings/
    │   ├── currencies/
    │   └── banks/
    └── branches/
```

### 5.3 Módulos Feature (14)

```
modules/
├── auth/          # Login, schemas
├── billing/       # Facturas, NC
├── treasury/      # Pagos, cuentas, retenciones
├── hr/           # Empleados, nóminas
├── inventory/    # Productos, almacenes
├── partners/     # Clientes, proveedores
├── orders/       # Pedidos
├── reports/      # Reportes
├── roles/       # Gestión roles
├── settings/    # Configuraciones
├── users/       # Usuarios
└── bi/          # Dashboard
```

### 5.4 Hooks

```typescript
hooks/
├── use-debounce.ts        // Debounce inputs
├── use-mobile.ts          // Detectar móvil
├── use-permission.ts      // Permisos RBAC
│   ├── hasPermission(perm)
│   ├── hasAnyPermission([permA, permB])
│   └── hasAllPermissions([permA, permB])
└── use-profile.ts        // Perfil usuario
```

### 5.5 API Client

```typescript
// lib/api.ts
const api = {
  get: async (url, config?) => {
    /* Bearer token, x-branch-id */
  },
  post: async (url, data, config?) => {
    /* ... */
  },
  put: async (url, data, config?) => {
    /* ... */
  },
  patch: async (url, data, config?) => {
    /* ... */
  },
  delete: async (url, config?) => {
    /* ... */
  },
};
```

### 5.6 Stores Zustand

```typescript
stores/
├── use-auth-store.ts   // token, user, currentBranch, login(), logout()
└── use-guide-store.ts  // Sistema de tours
```

---

## 6. DEPENDENCIAS ENTRE FASES

```
packages/database (FASE 1)
    │
    ├── Sin dependencias
    │
    ▼
apps/backend (FASE 2)
    │
    ├── Depende de: packages/database
    │
    ▼
apps/frontend (FASE 3)
    │
    ├── Depende de: apps/backend, packages/database
    │
    ▼
```

**Importante:** Cada fase debe completarse antes de comenzar la siguiente.

---

## 7. DOCUMENTACIÓN

### 7.1 Estructura de Documentos

```
docs/
├── PROGRESS.md              # Tracking de avances
├── PLANNING.md              # Este documento
└── SPECIFICATIONS/
    ├── database-spec.md
    ├── backend-spec.md
    └── frontend-spec.md

apps/backend/docs/modules/
├── auth.md
├── billing.md              # ⚠️ Crítico
├── treasury.md             # ⚠️ Crítico
├── hr.md                   # ⚠️ Crítico
└── ...

apps/frontend/docs/
├── SHADC.md                # Setup shadcn
├── COMPONENTS.md           # Guía componentes
└── modules/
    ├── billing.md
    └── treasury.md
```

### 7.2 Swagger Docs Template

````markdown
# [Módulo]

## Descripción

[Descripción del módulo]

## Endpoints

### [Nombre del endpoint]

**`[METHOD]`** `[RUTA]`

#### Descripción

[Qué hace]

#### Request

```json
{
  "campo": "tipo"
}
```
````

#### Responses

- **200**: [Descripción]
- **400**: [Descripción]
- **401**: [Descripción]
- **404**: [Descripción]

#### Notas

[Notas de implementación]

```

---

## 8. TESTING STRATEGY

### 8.1 Estructura

```

apps/backend/tests/
├── unit/
│ ├── auth/
│ ├── billing/
│ ├── treasury/
│ └── hr/
└── e2e/
├── auth.spec.ts
├── billing.spec.ts
└── treasury.spec.ts

apps/frontend/tests/
├── unit/
│ ├── components/
│ ├── hooks/
│ └── lib/
└── e2e/
├── login.spec.ts
├── billing.spec.ts
└── treasury.spec.ts

packages/database/tests/
└── unit/
├── schema.test.ts
├── relations.test.ts
└── seed.test.ts

```

### 8.2 Stack

| Tipo | Herramienta |
|------|-------------|
| Unit Backend | Vitest |
| E2E Backend | Supertest |
| Unit Frontend | Vitest + RTL |
| E2E Frontend | Playwright |

### 8.3 Cobertura Objetivo

| Fase | Cobertura Mínima |
|------|------------------|
| Database | 80% (schema, seed) |
| Backend | 70% (servicios críticos) |
| Frontend | 60% (componentes, hooks) |

---

## 9. CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Database
- [ ] Schema completo 50+ tablas
- [ ] Relaciones Drizzle
- [ ] Permissions constants
- [ ] Scripts: reset, seed, seed:faker
- [ ] Tests unitarios

### Fase 2: Backend
- [ ] 20+ módulos NestJS
- [ ] Swagger docs completos
- [ ] Auth con mock password recovery
- [ ] Lógica billing (IVA, IGTF)
- [ ] Lógica treasury (voidPayment 8 pasos)
- [ ] Lógica HR (LOTTT)
- [ ] Tests unitarios y e2e

### Fase 3: Frontend
- [ ] Setup shadcn/ui
- [ ] 32+ componentes UI
- [ ] 31 páginas App Router
- [ ] 14 módulos feature
- [ ] Auth guard + permissions gate
- [ ] Responsive design
- [ ] Tests unitarios y e2e

---

## 10. NOTAS

### Auth Recovery (Mock)
El sistema de recuperación de contraseña ficará como mock, dejando la ventana abierta para implementación futura con nodemailer:
- `POST /auth/forgot-password` → Genera token (no envía email)
- `POST /auth/reset-password` → Valida token y resetea

### Recursos
- [Turborepo Docs](https://turbo.build/repo)
- [Drizzle ORM](https://orm.drizzle.team)
- [NestJS](https://nestjs.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Vitest](https://vitest.dev)
- [Playwright](https://playwright.dev)

---

**Documento creado:** 2026-06-01
**Última actualización:** 2026-06-01
**Versión:** 2.1
```
