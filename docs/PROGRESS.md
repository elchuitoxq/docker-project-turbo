# ERP Venezuela - Progreso de Desarrollo

> **Estado:** En Desarrollo
> **Última actualización:** 2026-10-23
> **Versión Plan:** v2.2
>
> **Fuente de verdad actual:** [`PROJECT-STATUS.md`](./PROJECT-STATUS.md).
> Las matrices y casillas que siguen son un snapshot histórico; no indican el
> estado actual de implementación ni de pruebas. Contrastar contratos HTTP con
> [`API-CONTRACTS.md`](./API-CONTRACTS.md) y el esquema con
> `packages/database/src/schema.ts`. `graphify-out/GRAPH_REPORT.md` es un
> informe generado el 2026-06-10 y sirve como mapa estático de dependencias.

---

## RESUMEN HISTÓRICO (NO USAR COMO ESTADO ACTUAL)

| Fase                                | Estado     | Progreso |
| ----------------------------------- | ---------- | -------- |
| FASE 1: Database (Drizzle)          | Completado | 100%     |
| FASE 2: Backend (NestJS)            | Completado | 100%     |
| PART 2: Integration Tests           | Completado | 100%     |
| FASE 3: Frontend (Next.js + shadcn) | Pendiente  | 0%       |

---

## FASE 1: DATABASE (Drizzle)

### 1.1 Schema - Seguridad y Audit

| Tabla             | Estado    | Notas                        |
| ----------------- | --------- | ---------------------------- |
| audit_logs        | [x] Hecho | Log de auditoría completo    |
| permissions       | [x] Hecho | Códigos RBAC                 |
| roles             | [x] Hecho | ADMIN, MANAGER, SELLER, etc. |
| users             | [x] Hecho | ACTUALIZAR existente         |
| users_roles       | [x] Hecho | Junction table               |
| roles_permissions | [x] Hecho | Junction table               |
| users_branches    | [x] Hecho | Multitenant                  |
| user_app_settings | [x] Hecho | Settings de usuario          |

### 1.2 Schema - Core

| Tabla                | Estado    | Notas                |
| -------------------- | --------- | -------------------- |
| branches             | [x] Hecho | Sucursales           |
| currencies           | [x] Hecho | USD, VES             |
| exchange_rates       | [x] Hecho | Tasas BCV            |
| tax_concepts         | [x] Hecho | Conceptos ISLR       |
| partners             | [x] Hecho | Clientes/Proveedores |
| organization_modules | [x] Hecho | Módulos por org      |

### 1.3 Schema - Inventory

| Tabla                | Estado    | Notas             |
| -------------------- | --------- | ----------------- |
| warehouses           | [x] Hecho | Almacenes         |
| product_categories   | [x] Hecho | Categorías        |
| products             | [x] Hecho | Catálogo          |
| product_batches      | [x] Hecho | Lotes             |
| stock                | [x] Hecho | Stock por almacén |
| inventory_moves      | [x] Hecho | Movimientos       |
| inventory_move_lines | [x] Hecho | Líneas movimiento |

### 1.4 Schema - Orders & Billing

| Tabla              | Estado    | Notas         |
| ------------------ | --------- | ------------- |
| orders             | [x] Hecho | Pedidos       |
| order_items        | [x] Hecho | Ítems pedido  |
| invoices           | [x] Hecho | Facturas      |
| invoice_items      | [x] Hecho | Ítems factura |
| credit_notes       | [x] Hecho | Notas crédito |
| credit_note_items  | [x] Hecho | Ítems NC      |
| credit_note_usages | [x] Hecho | Cruce saldo   |

### 1.5 Schema - Treasury

| Tabla                   | Estado    | Notas            |
| ----------------------- | --------- | ---------------- |
| payment_methods         | [x] Hecho | Métodos pago     |
| bank_accounts           | [x] Hecho | Cuentas empresa  |
| payments                | [x] Hecho | Pagos            |
| payment_allocations     | [x] Hecho | Asignaciones     |
| payment_method_accounts | [x] Hecho | Junction         |
| tax_retentions          | [x] Hecho | Retenciones      |
| tax_retention_lines     | [x] Hecho | Líneas retención |
| document_links          | [x] Hecho | Polimórfico      |

### 1.6 Schema - HR

| Tabla                   | Estado    | Notas            |
| ----------------------- | --------- | ---------------- |
| banks                   | [x] Hecho | Catálogo SUDEBAN |
| departments             | [x] Hecho | Departamentos    |
| job_positions           | [x] Hecho | Cargos           |
| employees               | [x] Hecho | Empleados        |
| employee_contracts      | [x] Hecho | Contratos LOTTT  |
| employee_benefits       | [x] Hecho | Beneficios       |
| employee_vacations      | [x] Hecho | Vacaciones       |
| employee_profit_sharing | [x] Hecho | Utilidades       |
| payroll_runs            | [x] Hecho | Corridas nómina  |
| payroll_items           | [x] Hecho | Detalle nómina   |
| payroll_item_lines      | [x] Hecho | Líneas concepto  |
| payroll_settings        | [x] Hecho | Configuraciones  |
| payroll_concept_types   | [x] Hecho | Tipos conceptos  |
| payroll_incidents       | [x] Hecho | Novedades        |
| employee_salary_history | [x] Hecho | Histórico        |

### 1.7 Schema - Accounting

| Tabla                  | Estado    | Notas           |
| ---------------------- | --------- | --------------- |
| accounting_accounts    | [x] Hecho | Plan cuentas    |
| accounting_entries     | [x] Hecho | Asientos        |
| accounting_entry_lines | [x] Hecho | Líneas asiento  |
| accounting_maps        | [x] Hecho | Mapas contables |

### 1.8 Schema - Loans

| Tabla      | Estado    | Notas          |
| ---------- | --------- | -------------- |
| loans      | [x] Hecho | Préstamos      |
| loan_items | [x] Hecho | Ítems préstamo |

### 1.9 MEJORA: employeeBankAccounts

| Item                         | Estado        | Notas                  |
| ---------------------------- | ------------- | ---------------------- |
| Tabla employee_bank_accounts | [x] Hecho     | Normalización bancaria |
| Migración datos legacy       | [ ] Pendiente | From employees.*       |
| Relaciones actualizadas      | [x] Hecho     | Drizzle relations      |

### 1.10 Scripts Database

| Script                  | Estado           | Notas                                                     |
| ----------------------- | ---------------- | --------------------------------------------------------- |
| seed-rbac.ts            | [x] Hecho        | Seed roles y permisos                                     |
| reset.ts                | [ ] Pendiente    | Reset completo DB                                         |
| seed-test.ts            | [x] Implementado | Fixtures deterministas; idempotencia y saldos verificados |
| seed-faker.ts           | [ ] Pendiente    | Generación masiva                                         |
| recalculate-balances.ts | [ ] Pendiente    | Saldos banco                                              |

### 1.11 Tests Database

| Test              | Estado           | Notas                                                           |
| ----------------- | ---------------- | --------------------------------------------------------------- |
| schema.test.ts    | [ ] Pendiente    | Validación schema                                               |
| relations.test.ts | [ ] Pendiente    | Relaciones                                                      |
| seed.test.ts      | [x] Implementado | 7 pruebas de idempotencia, roles, saldos y cálculo fiscal pasan |

### 1.12 Ejecución de pruebas DB

| Elemento                | Estado           | Notas                                                         |
| ----------------------- | ---------------- | ------------------------------------------------------------- |
| Bases aisladas          | [x] Implementado | `testdb_database` y `testdb_backend`, separadas de desarrollo |
| Preparación/migraciones | [x] Implementado | `pnpm test` depende de la tarea Turbo `test:db:prepare`       |
| Validación del flujo    | [x] Validado     | Database 23/23; integración backend 7/7                       |

> La suite completa de backend queda en 733/734: falla `auth.service.test.ts`
> porque su expectativa no incluye el campo `user` que devuelve el servicio. No
> forma parte de esta alineación de pruebas DB.

---

## FASE 2: BACKEND (NestJS)

### Auth Module

| Endpoint                   | Estado    | Notas                  |
| -------------------------- | --------- | ---------------------- |
| POST /auth/login           | [x] Hecho | Login JWT              |
| POST /auth/forgot-password | [x] Hecho | Mock (ventana abierta) |
| POST /auth/reset-password  | [x] Hecho | Mock (ventana abierta) |

### Users Module

| Endpoint              | Estado    | Notas         |
| --------------------- | --------- | ------------- |
| POST /users           | [x] Hecho | Crear         |
| GET /users            | [x] Hecho | Listar        |
| GET /users/:id        | [x] Hecho | Detalle       |
| PATCH /users/:id      | [x] Hecho | Actualizar    |
| DELETE /users/:id     | [x] Hecho | Eliminar      |
| POST /users/:id/roles | [x] Hecho | Asignar roles |
| GET /users/me/profile | [x] Hecho | Perfil actual |

### Roles Module

| Endpoint                    | Estado        | Notas             |
| --------------------------- | ------------- | ----------------- |
| POST /roles                 | [ ] Pendiente | Crear rol         |
| GET /roles                  | [ ] Pendiente | Listar            |
| GET /roles/permissions      | [ ] Pendiente | Permisos          |
| POST /roles/:id/permissions | [ ] Pendiente | Asignar           |
| POST /roles/assign          | [ ] Pendiente | Asignar a usuario |
| DELETE /roles/:id           | [ ] Pendiente | Eliminar          |

### Billing Module ⚠️ CRÍTICO

| Endpoint                              | Estado    | Notas        |
| ------------------------------------- | --------- | ------------ |
| POST /billing/invoices                | [x] Hecho | Crear DRAFT  |
| GET /billing/invoices                 | [x] Hecho | Listar       |
| GET /billing/invoices/:id             | [x] Hecho | Detalle      |
| GET /billing/invoices/stats           | [x] Hecho | Estadísticas |
| POST /billing/invoices/:id            | [x] Hecho | Actualizar   |
| POST /billing/invoices/:id/post       | [x] Hecho | Emitir       |
| POST /billing/invoices/:id/void       | [x] Hecho | Anular       |
| GET /billing/invoices/:id/fiscal-json | [x] Hecho | JSON fiscal  |
| Swagger Docs                          | [x] Hecho | Completo     |

### Treasury Module ⚠️ CRÍTICO

| Endpoint                             | Estado        | Notas            |
| ------------------------------------ | ------------- | ---------------- |
| POST /treasury/payments              | [x] Hecho     | Registrar        |
| POST /treasury/payments/:id/void     | [x] Hecho     | Anular (8 pasos) |
| GET /treasury/payments               | [x] Hecho     | Listar           |
| GET /treasury/statements/:partnerId  | [x] Hecho     | Estado cuenta    |
| GET /treasury/daily-close            | [x] Hecho     | Cierre diario    |
| GET /treasury/available-credit-notes | [x] Hecho     | NC disponibles   |
| GET /treasury/methods                | [x] Hecho     | Métodos          |
| POST /treasury/methods               | [x] Hecho     | Crear método     |
| PATCH /treasury/methods/:id          | [ ] Pendiente | Actualizar       |
| GET /treasury/bank-accounts          | [x] Hecho     | Cuentas          |
| POST /treasury/bank-accounts         | [x] Hecho     | Crear cuenta     |
| PUT /treasury/bank-accounts/:id      | [ ] Pendiente | Actualizar       |
| Swagger Docs                         | [x] Hecho     | Completo         |

### HR Module ⚠️ CRÍTICO

| Endpoint                               | Estado        | Notas           |
| -------------------------------------- | ------------- | --------------- |
| GET /hr/employees                      | [x] Hecho     | Listar          |
| GET /hr/employees/:id                  | [x] Hecho     | Detalle         |
| POST /hr/employees                     | [x] Hecho     | Crear           |
| PUT /hr/employees/:id                  | [x] Hecho     | Actualizar      |
| GET /hr/departments                    | [x] Hecho     | Listar          |
| POST /hr/departments                   | [x] Hecho     | Crear           |
| GET /hr/positions                      | [x] Hecho     | Listar          |
| POST /hr/positions                     | [x] Hecho     | Crear           |
| GET /hr/payroll                        | [x] Hecho     | Corridas        |
| GET /hr/payroll/:id                    | [x] Hecho     | Detalle corrida |
| POST /hr/payroll/generate              | [x] Hecho     | Generar nómina  |
| POST /hr/payroll/:id/process           | [x] Hecho     | Procesar        |
| PATCH /hr/payroll/:id/status           | [ ] Pendiente | Estado          |
| GET /hr/payroll/:runId/payslip/:itemId | [x] Hecho     | Recibo          |
| GET /hr/payroll/:runId/export/txt      | [ ] Pendiente | TXT banco       |
| GET /hr/payroll/:runId/export/excel    | [ ] Pendiente | Excel           |
| GET /hr/incidents                      | [x] Hecho     | Novedades       |
| POST /hr/incidents                     | [x] Hecho     | Crear           |
| Swagger Docs                           | [x] Hecho     | Completo        |

### Partners Module

| Endpoint             | Estado        | Notas      |
| -------------------- | ------------- | ---------- |
| GET /partners        | [ ] Pendiente | Listar     |
| GET /partners/:id    | [ ] Pendiente | Detalle    |
| POST /partners       | [ ] Pendiente | Crear      |
| PUT /partners/:id    | [ ] Pendiente | Actualizar |
| DELETE /partners/:id | [ ] Pendiente | Eliminar   |

### Products Module

| Endpoint            | Estado        | Notas      |
| ------------------- | ------------- | ---------- |
| POST /products      | [ ] Pendiente | Crear      |
| GET /products       | [ ] Pendiente | Listar     |
| GET /products/:id   | [ ] Pendiente | Detalle    |
| PATCH /products/:id | [ ] Pendiente | Actualizar |

### Orders Module

| Endpoint                     | Estado        | Notas           |
| ---------------------------- | ------------- | --------------- |
| GET /orders                  | [ ] Pendiente | Listar          |
| GET /orders/stats            | [ ] Pendiente | Estadísticas    |
| GET /orders/:id              | [ ] Pendiente | Detalle         |
| POST /orders                 | [ ] Pendiente | Crear           |
| POST /orders/:id/confirm     | [ ] Pendiente | Confirmar       |
| POST /orders/:id/cancel      | [ ] Pendiente | Cancelar        |
| POST /orders/:id/invoice     | [ ] Pendiente | Generar factura |
| POST /orders/:id/recalculate | [ ] Pendiente | Recalcular      |

### Credit Notes Module

| Endpoint              | Estado        | Notas   |
| --------------------- | ------------- | ------- |
| POST /credit-notes    | [ ] Pendiente | Crear   |
| GET /credit-notes     | [ ] Pendiente | Listar  |
| GET /credit-notes/:id | [ ] Pendiente | Detalle |

### Inventory Module

| Endpoint                           | Estado        | Notas       |
| ---------------------------------- | ------------- | ----------- |
| GET /inventory/warehouses          | [ ] Pendiente | Listar      |
| POST /inventory/warehouses         | [ ] Pendiente | Crear       |
| PATCH /inventory/warehouses/:id    | [ ] Pendiente | Actualizar  |
| GET /inventory/stock/:warehouseId  | [ ] Pendiente | Stock       |
| GET /inventory/moves               | [ ] Pendiente | Movimientos |
| POST /inventory/moves              | [ ] Pendiente | Crear       |
| PATCH /inventory/moves/:id/approve | [ ] Pendiente | Aprobar     |
| PATCH /inventory/moves/:id/reject  | [ ] Pendiente | Rechazar    |

### Accounting Module

| Servicio                    | Estado        | Notas               |
| --------------------------- | ------------- | ------------------- |
| createEntry                 | [ ] Pendiente | Crear asiento       |
| ensureAccount               | [ ] Pendiente | Buscar/crear cuenta |
| createEntryFromMap          | [ ] Pendiente | Desde mapa          |
| createEntryForInvoice       | [ ] Pendiente | Factura             |
| createEntryForInventoryMove | [ ] Pendiente | Movimiento          |

### Reports Module

| Endpoint                            | Estado        | Notas         |
| ----------------------------------- | ------------- | ------------- |
| GET /reports/fiscal/retenciones-txt | [ ] Pendiente | TXT IVA       |
| GET /reports/fiscal/retenciones-xml | [ ] Pendiente | XML ISLR      |
| GET /reports/fiscal/summary         | [ ] Pendiente | Resumen       |
| GET /reports/fiscal/libro-ventas    | [ ] Pendiente | Libro ventas  |
| GET /reports/fiscal/libro-compras   | [ ] Pendiente | Libro compras |

### Branches Module

| Endpoint             | Estado        | Notas      |
| -------------------- | ------------- | ---------- |
| POST /branches       | [ ] Pendiente | Crear      |
| GET /branches        | [ ] Pendiente | Listar     |
| GET /branches/:id    | [ ] Pendiente | Detalle    |
| PATCH /branches/:id  | [ ] Pendiente | Actualizar |
| DELETE /branches/:id | [ ] Pendiente | Desactivar |

### Banks Module

| Endpoint                         | Estado        | Notas      |
| -------------------------------- | ------------- | ---------- |
| GET /settings/banks              | [ ] Pendiente | Listar     |
| POST /settings/banks             | [ ] Pendiente | Crear      |
| PUT /settings/banks/:id          | [ ] Pendiente | Actualizar |
| PATCH /settings/banks/:id/toggle | [ ] Pendiente | Toggle     |

### Currencies Module

| Endpoint                              | Estado        | Notas        |
| ------------------------------------- | ------------- | ------------ |
| GET /settings/currencies              | [ ] Pendiente | Listar       |
| POST /settings/currencies             | [ ] Pendiente | Crear        |
| GET /settings/currencies/rates/latest | [ ] Pendiente | Tasas        |
| POST /settings/currencies/rates       | [ ] Pendiente | Agregar tasa |

### Tax Concepts Module

| Endpoint                          | Estado        | Notas      |
| --------------------------------- | ------------- | ---------- |
| GET /settings/tax-concepts        | [ ] Pendiente | Listar     |
| GET /settings/tax-concepts/:id    | [ ] Pendiente | Detalle    |
| POST /settings/tax-concepts       | [ ] Pendiente | Crear      |
| PUT /settings/tax-concepts/:id    | [ ] Pendiente | Actualizar |
| DELETE /settings/tax-concepts/:id | [ ] Pendiente | Eliminar   |

### Documents Module

| Endpoint                | Estado        | Notas            |
| ----------------------- | ------------- | ---------------- |
| GET /documents/:id/flow | [ ] Pendiente | Flujo documental |

### Loans Module

| Endpoint    | Estado        | Notas  |
| ----------- | ------------- | ------ |
| POST /loans | [ ] Pendiente | Crear  |
| GET /loans  | [ ] Pendiente | Listar |

### BI Module

| Endpoint         | Estado        | Notas     |
| ---------------- | ------------- | --------- |
| GET /bi/kpis     | [ ] Pendiente | KPIs      |
| GET /bi/chart    | [ ] Pendiente | Gráfico   |
| GET /bi/activity | [ ] Pendiente | Actividad |

### Audit Module

| Endpoint                          | Estado        | Notas     |
| --------------------------------- | ------------- | --------- |
| GET /audit/:entityTable/:entityId | [ ] Pendiente | Historial |

### Cron Module

| Endpoint              | Estado        | Notas           |
| --------------------- | ------------- | --------------- |
| GET /cron/trigger-bcv | [ ] Pendiente | Scraping manual |

### Tests Backend

| Test                     | Estado        | Notas                          |
| ------------------------ | ------------- | ------------------------------ |
| auth.service.test.ts     | [x] Hecho     | Login, JWT, Payload            |
| billing.service.test.ts  | [x] Hecho     | IVA, IGTF, Fiscal JSON         |
| treasury.service.test.ts | [x] Hecho     | voidPayment, Allocaciones      |
| payroll.service.test.ts  | [x] Hecho     | Cálculos LOTTT, SSO, FAOV, PIE |
| e2e/auth.spec.ts         | [ ] Pendiente | Login flow                     |
| e2e/billing.spec.ts      | [ ] Pendiente | Facturas                       |
| e2e/treasury.spec.ts     | [ ] Pendiente | Pagos                          |

---

## PART 2: INTEGRATION TESTS (Drizzle ORM)

### Test Infrastructure

| Archivo                      | Estado    | Notas                                                   |
| ---------------------------- | --------- | ------------------------------------------------------- |
| src/test/database.ts         | [x] Hecho | Test DB connection + cleanDatabase()                    |
| src/test/factories.ts        | [x] Hecho | 16 factories (branch, currency, partner, product, etc.) |
| docker-compose.test.yml      | [x] Hecho | PostgreSQL test on port 5433                            |
| src/test/integration.test.ts | [x] Hecho | Example tests for Partners, Products, Invoices          |

### Test Factories

| Factory                     | Estado    | Notas |
| --------------------------- | --------- | ----- |
| createTestBranch            | [x] Hecho |       |
| createTestCurrency          | [x] Hecho |       |
| createTestPartner           | [x] Hecho |       |
| createTestProduct           | [x] Hecho |       |
| createTestWarehouse         | [x] Hecho |       |
| createTestUser              | [x] Hecho |       |
| createTestInvoice           | [x] Hecho |       |
| createTestInvoiceItem       | [x] Hecho |       |
| createTestOrder             | [x] Hecho |       |
| createTestOrderItem         | [x] Hecho |       |
| createTestStock             | [x] Hecho |       |
| createTestInventoryMove     | [x] Hecho |       |
| createTestInventoryMoveLine | [x] Hecho |       |
| createTestProductBatch      | [x] Hecho |       |

### To Run Tests

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
pnpm --filter backend test -- --run src/test/integration.test.ts
```

---

## FASE 3: FRONTEND (Next.js + shadcn/ui)

### Setup Inicial

| Item                  | Estado        | Notas           |
| --------------------- | ------------- | --------------- |
| Tailwind CSS 4        | [ ] Pendiente | Configuración   |
| shadcn/ui             | [ ] Pendiente | 32+ componentes |
| Zustand               | [ ] Pendiente | Stores          |
| TanStack Query        | [ ] Pendiente | Server state    |
| React Hook Form + Zod | [ ] Pendiente | Forms           |
| Recharts              | [ ] Pendiente | Gráficos        |
| Framer Motion         | [ ] Pendiente | Animaciones     |

### shadcn/ui Components

| Componente        | Estado        | Notas |
| ----------------- | ------------- | ----- |
| alert-dialog      | [ ] Pendiente |       |
| alert             | [ ] Pendiente |       |
| avatar            | [ ] Pendiente |       |
| badge             | [ ] Pendiente |       |
| breadcrumb        | [ ] Pendiente |       |
| button            | [ ] Pendiente |       |
| calendar          | [ ] Pendiente |       |
| card              | [ ] Pendiente |       |
| checkbox          | [ ] Pendiente |       |
| collapsible       | [ ] Pendiente |       |
| command           | [ ] Pendiente |       |
| date-picker       | [ ] Pendiente |       |
| date-range-picker | [ ] Pendiente |       |
| dialog            | [ ] Pendiente |       |
| dropdown-menu     | [ ] Pendiente |       |
| field             | [ ] Pendiente |       |
| form              | [ ] Pendiente |       |
| input             | [ ] Pendiente |       |
| label             | [ ] Pendiente |       |
| popover           | [ ] Pendiente |       |
| scroll-area       | [ ] Pendiente |       |
| select            | [ ] Pendiente |       |
| separator         | [ ] Pendiente |       |
| sheet             | [ ] Pendiente |       |
| sidebar           | [ ] Pendiente |       |
| skeleton          | [ ] Pendiente |       |
| sonner            | [ ] Pendiente |       |
| switch            | [ ] Pendiente |       |
| table             | [ ] Pendiente |       |
| tabs              | [ ] Pendiente |       |
| textarea          | [ ] Pendiente |       |
| tooltip           | [ ] Pendiente |       |

### Componentes Compartidos

| Componente            | Estado        | Notas             |
| --------------------- | ------------- | ----------------- |
| app-sidebar           | [ ] Pendiente | Sidebar principal |
| app-header            | [ ] Pendiente | Header            |
| page-header           | [ ] Pendiente | Header unificado  |
| auth-guard            | [ ] Pendiente | Guardian auth     |
| login-form            | [ ] Pendiente | Form login        |
| permissions-gate      | [ ] Pendiente | Gate permisos     |
| global-rate-display   | [ ] Pendiente | Tasa BCV          |
| branch-switcher       | [ ] Pendiente | Cambio sucursal   |
| dual-currency-display | [ ] Pendiente | USD + VES         |

### Páginas App Router

| Página                                                    | Estado        | Notas               |
| --------------------------------------------------------- | ------------- | ------------------- |
| app/page.tsx                                              | [ ] Pendiente | Landing             |
| app/login/page.tsx                                        | [ ] Pendiente | Login               |
| app/forbidden/page.tsx                                    | [ ] Pendiente | 403                 |
| app/dashboard/page.tsx                                    | [ ] Pendiente | BI                  |
| app/dashboard/layout.tsx                                  | [ ] Pendiente | AuthGuard + Sidebar |
| app/dashboard/billing/invoices/page.tsx                   | [ ] Pendiente | Facturas            |
| app/dashboard/treasury/page.tsx                           | [ ] Pendiente | Tesorería           |
| app/dashboard/treasury/accounts/page.tsx                  | [ ] Pendiente | Cuentas             |
| app/dashboard/treasury/statements/[partnerId]/page.tsx    | [ ] Pendiente | Estado cuenta       |
| app/dashboard/treasury/retentions/page.tsx                | [ ] Pendiente | Retenciones         |
| app/dashboard/treasury/daily-close/page.tsx               | [ ] Pendiente | Cierre              |
| app/dashboard/treasury/reports/page.tsx                   | [ ] Pendiente | Reportes            |
| app/dashboard/inventory/products/page.tsx                 | [ ] Pendiente | Productos           |
| app/dashboard/inventory/warehouses/page.tsx               | [ ] Pendiente | Almacenes           |
| app/dashboard/inventory/moves/page.tsx                    | [ ] Pendiente | Movimientos         |
| app/dashboard/operations/sales/page.tsx                   | [ ] Pendiente | Ventas              |
| app/dashboard/operations/purchases/page.tsx               | [ ] Pendiente | Compras             |
| app/dashboard/operations/partners/page.tsx                | [ ] Pendiente | Partners            |
| app/dashboard/operations/partners/[id]/statement/page.tsx | [ ] Pendiente | Estado              |
| app/dashboard/operations/orders/page.tsx                  | [ ] Pendiente | Pedidos             |
| app/dashboard/hr/employees/page.tsx                       | [ ] Pendiente | Empleados           |
| app/dashboard/hr/employees/[id]/page.tsx                  | [ ] Pendiente | Detalle             |
| app/dashboard/hr/departments/page.tsx                     | [ ] Pendiente | Deptos              |
| app/dashboard/hr/positions/page.tsx                       | [ ] Pendiente | Cargos              |
| app/dashboard/hr/payroll/page.tsx                         | [ ] Pendiente | Nómina              |
| app/dashboard/hr/payroll/[id]/page.tsx                    | [ ] Pendiente | Detalle             |
| app/dashboard/hr/incidents/page.tsx                       | [ ] Pendiente | Novedades           |
| app/dashboard/hr/settings/page.tsx                        | [ ] Pendiente | Config HR           |
| app/dashboard/settings/users/page.tsx                     | [ ] Pendiente | Usuarios            |
| app/dashboard/settings/tax-concepts/page.tsx              | [ ] Pendiente | ISLR                |
| app/dashboard/settings/methods/page.tsx                   | [ ] Pendiente | Métodos             |
| app/dashboard/settings/payroll-concepts/page.tsx          | [ ] Pendiente | Conceptos           |
| app/dashboard/settings/payroll-settings/page.tsx          | [ ] Pendiente | Config              |
| app/dashboard/settings/currencies/page.tsx                | [ ] Pendiente | Monedas             |
| app/dashboard/settings/banks/page.tsx                     | [ ] Pendiente | Bancos              |
| app/dashboard/branches/page.tsx                           | [ ] Pendiente | Sucursales          |

### Módulos Feature

| Módulo    | Estado        | Notas     |
| --------- | ------------- | --------- |
| auth      | [ ] Pendiente | Login     |
| billing   | [ ] Pendiente | Facturas  |
| treasury  | [ ] Pendiente | Pagos     |
| hr        | [ ] Pendiente | RRHH      |
| inventory | [ ] Pendiente | Productos |
| partners  | [ ] Pendiente | Clientes  |
| orders    | [ ] Pendiente | Pedidos   |
| reports   | [ ] Pendiente | Reportes  |
| roles     | [ ] Pendiente | Roles     |
| settings  | [ ] Pendiente | Config    |
| users     | [ ] Pendiente | Usuarios  |

### Tests Frontend

| Test                               | Estado        | Notas |
| ---------------------------------- | ------------- | ----- |
| components/invoices-table.test.tsx | [ ] Pendiente |       |
| hooks/use-invoices.test.ts         | [ ] Pendiente |       |
| lib/format-currency.test.ts        | [ ] Pendiente |       |
| e2e/login.spec.ts                  | [ ] Pendiente |       |
| e2e/billing.spec.ts                | [ ] Pendiente |       |
| e2e/treasury.spec.ts               | [ ] Pendiente |       |

---

## CHANGELOG

| Fecha      | Cambio                                                                                 | Autor   |
| ---------- | -------------------------------------------------------------------------------------- | ------- |
| 2026-06-01 | Creación del documento                                                                 | Sistema |
| 2026-06-01 | Backend completado - Tests unitarios (42 tests), build exitoso, lint con solo warnings | Sistema |
| 2026-06-01 | Corregido bcrypt -> bcryptjs (Windows compatibility), imports database/schema locales  | Sistema |
| 2026-06-02 | API Versioning: Todos los controladores con prefijo /v1                                | Sistema |
| 2026-06-02 | Integration Test Infra: database.ts, factories.ts, docker-compose.test.yml             | Sistema |
| 2026-06-02 | Integration Tests: 7 tests passing (Partners, Products, Invoice)                       | Sistema |
