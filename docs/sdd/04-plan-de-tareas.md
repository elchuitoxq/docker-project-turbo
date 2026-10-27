# 04 — Plan de tareas (WBS)

> **Estado:** plan aprobado, **sin código escrito todavía** (alcance acordado: solo planificación).
> **Fecha:** 2026-10-26 · **Base:** [`01-gap-analysis.md`](./01-gap-analysis.md) y specs `S-00`…`S-07`.
> **Regla de este documento:** cada tarea que se complete se marca aquí con su evidencia. Si una tarea
> se parte o cambia de alcance, se anota en la columna de notas; no se borra la fila.

## Leyenda

| Símbolo | Estado                |
| ------- | --------------------- |
| ⬜      | Pendiente             |
| 🟡      | En curso / parcial    |
| ✅      | Completada            |
| 🔵      | Bloqueada por externo |

**Tallas:** `S` ≤ 4 h · `M` ≈ 1 día · `L` = 2-3 días · `XL` > 3 días (se debe partir).

---

## 1. Épica E0 · Aislamiento por sucursal + auditoría — [`S-00`](./specs/S-00-aislamiento-sucursal.md)

### 1.1 Tareas

| ID      | Tarea                                                                                                                                                                                 | Artefactos principales                                                                                 | Depende          | Verificación                                                                                    | Talla | Estado |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------- | ----- | ------ |
| T-00-01 | Inventario de `branch_id` en las 50 tablas del schema                                                                                                                                 | `packages/database/src/schema.ts` (lectura)                                                            | —                | conteo reproducible (ver §1.2)                                                                  | S     | ✅     |
| T-00-02 | Clasificar las 32 tablas sin `branch_id`: heredan del padre / requieren columna / compartidas por diseño                                                                              | este documento §1.2                                                                                    | T-00-01          | **decidido** (2026-10-26): maestros compartidos entre sucursales                                | S     | ✅     |
| T-00-03 | `BranchContextGuard` + `@CurrentBranch()` + `@SkipBranch()`; valida `x-branch-id` contra `users_branches`; `403` sin asignación, `404` recurso ajeno; fallback query/body con warning | `apps/backend/src/common/branch/*` (nuevo), registro en `app.module.ts`                                | T-00-02          | unit: sin cabecera→400, sucursal ajena→403, recurso ajeno→404                                   | M     | ✅     |
| T-00-04 | Permisos nuevos: `core:branch:all` (modo consolidado) y `core:catalog:manage` (maestros compartidos)                                                                                  | `packages/database/src/scripts/seed-rbac.ts`, `apps/frontend/lib/permissions.ts`                       | —                | seed idempotente; UI muestra etiqueta "Consolidado"                                             | S     | ✅     |
| T-00-05 | Migración `audit_logs.branch_id` + índice                                                                                                                                             | `packages/database/drizzle/*`                                                                          | —                | `pnpm --filter database db:generate` revisado + migrate                                         | S     | ✅     |
| T-00-06 | `AuditService.record()` + interceptor en escrituras de dinero/stock                                                                                                                   | `apps/backend/src/modules/audit/*`                                                                     | T-00-05          | integración: factura y pago dejan fila en `audit_logs`                                          | M     | ✅     |
| T-00-07 | Migraciones de `branch_id` con backfill desde el padre                                                                                                                                | tablas de §1.2 grupo B                                                                                 | T-00-02          | migración corre 2 veces sin error; conteos cuadran                                              | L     | ✅     |
| T-00-08 | Filtrado por sucursal en los 8 servicios de negocio (un PR, según decisión del 2026-10-26)                                                                                            | `modules/{billing,treasury,inventory,orders,hr,accounting,credit-notes,loans}`                         | T-00-03, T-00-07 | integración: usuario de A no ve filas de B en cada módulo; no se mergea sin la suite de T-00-12 | XL    | ✅     |
| T-00-09 | `GET /v1/auth/me` devuelve `defaultBranchId`                                                                                                                                          | `modules/auth/auth.service.ts`, `shared-types`                                                         | T-00-03          | contrato OpenAPI regenerado                                                                     | S     | ✅     |
| T-00-10 | Frontend: validar la sucursal contra el backend antes de pintar el dashboard; pantalla "sin acceso a esta sucursal"                                                                   | `apps/frontend/app/(dashboard)/layout.tsx`, `stores/use-auth-store.ts`                                 | T-00-09          | E2E: usuario sin sucursal ve la pantalla de bloqueo                                             | M     | ✅     |
| T-00-11 | `queryClient.clear()` al cambiar de sucursal                                                                                                                                          | `apps/frontend/lib/api/query-client.ts`, selector de sucursal                                          | T-00-10          | no quedan datos de la sucursal anterior en caché                                                | S     | ✅     |
| T-00-12 | Pruebas de aislamiento cruzado                                                                                                                                                        | `*.service.test.ts` + `apps/backend/test/*` + `e2e/*`                                                  | T-00-08          | 3 capas verdes; E2E "B no ve A"                                                                 | M     | 🟡     |
| T-00-13 | Documentar el contrato de la cabecera                                                                                                                                                 | `docs/API-CONTRACTS.md`, [`02-arquitectura-y-convenciones.md`](./02-arquitectura-y-convenciones.md) §3 | T-00-03          | `@ApiHeader` visible en Swagger                                                                 | S     | ✅     |

**Gate de salida E0:** los 8 módulos responden `403`/`404` correctamente ante sucursal ajena, no baja
ningún umbral de cobertura, y `pnpm audit` sigue en 0.

### 1.2 Inventario de `branch_id` (resultado de T-00-01, corregido)

Medición sobre `packages/database/src/schema.ts`: **60 tablas**, **18 con `branch_id`**, **42 sin**.

> ⚠️ **Corrección (2026-10-26):** la primera medición publicó 50/18/32. Estaba mal: el parser
> anterior perdía las tablas declaradas en varias líneas (`currencies`, `exchange_rates`,
> `users_branches`...) y atribuía su contenido a la tabla anterior. El conteo válido es 60/18/42.

**Grupo A — heredan del padre (no requieren columna):** `invoice_items`, `order_items`,
`credit_note_items`, `credit_note_usages`, `payment_allocations`, `payment_method_accounts`,
`accounting_entry_lines`, `tax_retention_lines`, `inventory_move_lines`, `payroll_item_lines`,
`loan_items`, `document_links`, `stock`, `product_batches`.

**Grupo B — requieren `branch_id` (documentos de negocio):** `inventory_moves`, `loans`,
`audit_logs`. Ver la nota de alcance abajo.

**Grupo C — compartidas o de empresa (no migrar):** `partners`, `products`, `product_categories`,
`banks`, `branches`, `companies`, `currencies`, `exchange_rates`, `tax_concepts`, `roles`,
`permissions`, `users`, `users_roles`, `roles_permissions`, `users_branches`,
`password_reset_tokens`, `user_app_settings`, `organization_modules`, `payment_methods`,
`job_positions`, `payroll_items`, `payroll_item_lines`, `payroll_incidents`, `employee_contracts`,
`employee_benefits`, `employee_vacations`, `employee_profit_sharing`, `employee_salary_history`,
`employee_bank_accounts`, `departments`(ya tiene), `employees`(ya tiene).

> ✅ **Decisión de alcance de T-00-07 (2026-10-26):** sólo se migran las **3 tablas del grupo B**.
> El resto se resuelve **heredando del padre por join** (`payroll_items` → `payroll_runs`,
> `employee_*` → `employees`, `product_batches` → `products`). Denormalizar sin necesidad duplica la
> fuente de verdad y obliga a backfills que se pueden equivocar; si un reporte lo exige, se agrega
> después con su índice. Migración aplicada: `0005_famous_purifiers.sql`.

> ✅ **Decisión tomada (2026-10-26, T-00-02):** `partners` y `products`/`product_categories` se
> mantienen **compartidos entre sucursales**, igual que `banks`, `tax_concepts` y `exchange_rates`.
> Consecuencias que se aplican en T-00-08:
>
> 1. **Lectura de catálogo:** estos endpoints _no_ filtran por sucursal (`GET /partners`,
>    `GET /products`, `GET /product-categories`, `GET /settings/*`) — la cabecera sigue siendo
>    obligatoria, pero se valida permiso, no pertenencia.
> 2. **Escritura de catálogo:** crear o modificar un partner o producto requiere permiso con alcance
>    de empresa (`core:catalog:manage`), no de sucursal; queda auditado con la sucursal activa.
> 3. **Documentos:** todo lo que genera movimientos (`invoices`, `orders`, `payments`, `inventory_moves`,
>    `loans`, `payroll_runs`, `accounting_entries`) sí se filtra y se estampa por sucursal.
> 4. **Reportes:** un partner con movimientos en dos sucursales se reporta por separado en cada una;
>    nunca se consolida sin `core:branch:all`.

---

## 1.5 Épica E8 · Multimoneda con el dólar como referencia — [`S-08`](./specs/S-08-multimoneda.md)

> Requisito declarado por el negocio el 2026-10-26. Es **transversal y P0**: sin esto, el libro
> contable y los reportes no declaran en qué moneda están, y la tasa puede quedar congelada sin aviso.
> El número de la épica no indica el turno; el orden está en §10.

| ID      | Tarea                                                                                                     | Artefactos                                                        | Depende          | Verificación                                                                           | Talla | Estado |
| ------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------- | ----- | ------ |
| T-08-01 | **Decisión D-01** de moneda funcional y política de tasa, redondeo e IGTF (documento aprobado)            | `docs/MULTIMONEDA.md` (nuevo)                                     | —                | **decidido (2026-10-26):** funcional VES + reporte dual USD; BCV con override auditado | S     | ✅     |
| T-08-02 | Restricción de **una sola** moneda base + seed idempotente VES/USD                                        | `currencies`, `seed-core.ts`                                      | T-08-01          | intento de segunda base falla en BD                                                    | S     | ✅     |
| T-08-03 | `exchange_rates`: único `(currencyId, date)`, `source`, `createdBy`; historial paginado                   | migración + `modules/settings/currencies/*`                       | T-08-02          | dos tasas mismo día y moneda → `409`                                                   | M     | ✅     |
| T-08-04 | Job programado de tasa BCV (`@nestjs/schedule`, 08:00 America/Caracas) con reintentos                     | `modules/cron/*`, `ScheduleModule`                                | T-08-03          | corre solo; `GET /health/rates` refleja la hora                                        | L     | ✅     |
| T-08-05 | Retirar scraping frágil y el `FALLBACK_API_URL` corrupto; validación de cordura (≤ 0, variación diaria)   | `modules/cron/cron.service.ts`                                    | T-08-04          | tasa basura rechazada con `422` y queda la anterior                                    | M     | ✅     |
| T-08-06 | `payments.amountBase` + backfill; `tax_retentions` con moneda y tasa                                      | migración + `modules/treasury`, `modules/billing`                 | T-08-02          | backfill cuadra con `amount * exchange_rate`                                           | M     | ✅     |
| T-08-07 | Libro en moneda funcional: `accounting_entries.baseCurrencyId` + original en la línea                     | migración + `modules/accounting/*`                                | T-08-02          | asiento de factura USD suma en base y conserva original                                | L     | ✅     |
| T-08-08 | IGTF por `currencyId != base` (elimina la heurística `rate > 1`)                                          | `modules/billing/services/billing.service.ts`                     | T-08-02          | test: moneda extranjera con tasa 1,0 igual aplica IGTF                                 | S     | ✅     |
| T-08-09 | `MoneyService.convert()` único con `decimal.js` y política de redondeo                                    | `apps/backend/src/common/money/*` (nuevo)                         | T-08-01          | unit: 1 / 36,5 / 0 → error; HALF_UP                                                    | M     | ✅     |
| T-08-10 | Frescura de tasa: `getExchangeRate` rechaza tasas fuera del umbral y la emisión exige confirmación        | `billing.service.ts`, `treasury/*`                                | T-08-04          | tasa de hace 3 días no se usa en silencio                                              | M     | ✅     |
| T-08-11 | Diferencia cambiaria al cobrar en moneda distinta a la factura                                            | `modules/treasury/*`, `modules/accounting/*`                      | T-08-07          | cobro en VES de factura USD deja saldo 0 con línea de diferencia                       | L     | ✅     |
| T-08-12 | Frontend: formato por moneda, monto dual y aviso de tasa vencida                                          | `global-rate-display.tsx`, `lib/utils.ts`, formularios de emisión | T-08-10          | E2E: aviso bloquea emisión hasta confirmar                                             | M     | ⬜     |
| T-08-13 | **Reporte dual obligatorio**: columnas VES + USD a tasa de corte en estados, libros y reportes de gestión | `modules/reports/*`, `modules/accounting/*`                       | T-08-07, T-08-09 | ambas columnas cuadran; `closingRate` en el encabezado                                 | M     | ✅     |

**Gate de salida E8:** una factura en USD cobrada en VES a tasa distinta cierra el saldo en cero con
la diferencia asentada; ningún reporte suma monedas distintas sin convertir; y **todo reporte sale con
columnas VES y USD que cuadran entre sí** con la tasa de corte en el encabezado.

---

## 2. Épica E1 · Reparar contratos — [`S-01`](./specs/S-01-contratos-p0.md)

Tres frentes independientes = tres PR. **No se crean alias** (`/calculate`, `/approve`): se corrige el
cliente.

### 2.1 Frente A · HR (8 contratos)

| ID      | Tarea                                                     | Artefactos                                             | Depende | Verificación                                 | Talla | Estado |
| ------- | --------------------------------------------------------- | ------------------------------------------------------ | ------- | -------------------------------------------- | ----- | ------ |
| T-01-01 | `POST /v1/hr/employees/:id/terminate`                     | `modules/hr/hr.controller.ts`, `hr.service.ts`, `dto/` | E0      | integración: status `TERMINATED` + auditoría | S     | ✅     |
| T-01-02 | `PATCH /v1/hr/departments/:id`                            | ídem                                                   | E0      | unit + contrato                              | S     | ✅     |
| T-01-03 | `PATCH /v1/hr/positions/:id`                              | ídem                                                   | E0      | unit + contrato                              | S     | ✅     |
| T-01-04 | `POST /v1/hr/incidents/:id/{approve,reject}`              | ídem                                                   | E0      | `409` si no está `PENDING`                   | S     | ✅     |
| T-01-05 | Cliente HR usa `payroll/generate` y `payroll/:id/process` | `apps/frontend/modules/hr/api.ts:140-141`              | —       | sin 404 en las 5 pantallas de HR             | S     | ✅     |
| T-01-07 | `GET`/`PATCH /v1/hr/settings`                             | `modules/hr/*`, `payroll_settings`                     | T-02-01 | unit + contrato                              | S     | ✅     |

> **Cambio de alcance (2026-10-26):** el pago de nómina (`POST /v1/hr/payroll/:id/pay`) **sale de E1**
> y se implementa en E2 como parte de T-02-06, porque necesita el neto definitivo del motor de cálculo.

### 2.2 Frente B · Inventario

| ID      | Tarea                                                                | Artefactos                                                   | Depende | Verificación                            | Talla | Estado |
| ------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ------- | --------------------------------------- | ----- | ------ |
| T-01-08 | Cliente usa el prefijo `/inventory/warehouses`                       | `modules/inventory/api/warehouses.ts:13-18`                  | —       | listado carga en `inventory/warehouses` | S     | ✅     |
| T-01-09 | `GET /v1/inventory/warehouses/:id`                                   | `modules/inventory/*`                                        | E0      | contrato + test                         | S     | ✅     |
| T-01-10 | `DELETE /v1/inventory/warehouses/:id` (lógico; rechaza si hay stock) | ídem                                                         | T-01-09 | `409` con stock, `200` sin stock        | S     | ✅     |
| T-01-11 | Decidir `moves/:id/cancel`: alias o `reject`; documentar y alinear   | `modules/inventory/api/moves.ts:52`, `docs/API-CONTRACTS.md` | —       | una sola ruta vigente en el contrato    | S     | ✅     |
| T-01-12 | Cliente usa `/products/categories`                                   | `modules/inventory/api/products.ts:24`                       | —       | selector de categorías carga            | S     | ✅     |

### 2.3 Frente C · Facturación, partners y reportes

| ID      | Tarea                                                                                                                                                                   | Artefactos                                              | Depende | Verificación                                                                      | Talla | Estado |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- | ----- | ------ |
| T-01-13 | Cliente usa `PATCH` para actualizar factura                                                                                                                             | `modules/finance/api/invoices.ts:73`                    | —       | edición persiste                                                                  | S     | ✅     |
| T-01-14 | `GET /v1/billing/invoices` con `type` + paginación **aditiva** (`?paginated=true` devuelve `{ data, total, page, limit }`; sin el flag sigue el arreglo plano) + índice | `modules/billing/*`, migración de índice                | —       | paginación server-side sin romper consumidores; documentado en `API-CONTRACTS.md` | M     | ✅     |
| T-01-15 | `modules/orders/api.ts` deja de usar `/billing/invoices`                                                                                                                | `modules/orders/api.ts:33-36`                           | —       | órdenes cargan datos de órdenes                                                   | S     | ✅     |
| T-01-16 | Reportes muestran "no disponible" mientras no exista el endpoint                                                                                                        | `modules/finance/api/reports.ts:5-7`, `finance/reports` | —       | sin 404 en pantalla                                                               | S     | ✅     |
| T-01-17 | `DELETE /v1/partners/:id` real (lógico o bloqueo con `409` si tiene movimientos)                                                                                        | `modules/partners/*`                                    | —       | `409` con facturas; `204` sin movimientos                                         | S     | ✅     |
| T-01-18 | `GET /v1/partners` paginado en servidor                                                                                                                                 | `modules/partners/*` + índice                           | —       | tabla pagina sin cargar todo                                                      | S     | ✅     |

**Gate de salida E1:** `grep` de `apiClient` contra OpenAPI sin rutas inexistentes; 0 respuestas 404
en las pantallas de HR, inventario y finanzas.

---

## 3. Épica E2 · Nómina Venezuela — [`S-02`](./specs/S-02-nomina-ve.md)

| ID      | Tarea                                                                                  | Artefactos                                                   | Depende | Verificación                                                   | Talla | Estado |
| ------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------- | -------------------------------------------------------------- | ----- | ------ |
| T-02-00 | Redactar las reglas LOTTT aplicables (documento creado el 2026-10-27, BT-039)          | `docs/09-HR-NOMINA-VENEZUELA.md` (nuevo)                     | —       | revisión de contador/abogado laboral antes de codificar (P-28) | M     | ✅     |
| T-02-01 | `payroll_settings`: `companyId`, `effectiveFrom`, unicidad, snapshot por run           | `packages/database/schema.ts`, `modules/hr/*`                | T-02-00 | migración + run histórico inmutable                            | M     | ✅     |
| T-02-02 | Conceptos: `code`, `kind`, `expression`, `affectsIntegralSalary` + CRUD                | `payroll_concept_types`, `modules/hr/*`                      | T-02-01 | CRUD + validación de expresión                                 | M     | ✅     |
| T-02-03 | Motor de cálculo por concepto con `decimal.js`                                         | `modules/hr/payroll/*`, `hr.service.ts`                      | T-02-02 | unit con casos dorados (LOTTT)                                 | L     | ✅     |
| T-02-04 | Prestaciones, utilidades, vacaciones y bono vacacional                                 | ídem + `employee_profit_sharing`                             | T-02-03 | integración con períodos completos                             | L     | ✅     |
| T-02-05 | Liquidación de egreso (`employee_settlements`)                                         | tabla nueva + `POST /hr/employees/:id/settle`                | T-02-04 | cálculo por causa de egreso                                    | M     | ✅     |
| T-02-06 | Pago de nómina integrado a tesorería (idempotente), incluye `POST /hr/payroll/:id/pay` | `modules/hr` + `modules/treasury`                            | T-02-03 | 2 llamadas → 1 solo `payment`                                  | M     | ✅     |
| T-02-07 | UI parámetros de nómina                                                                | `app/(dashboard)/settings/payroll-settings/`                 | T-02-01 | alta de nueva vigencia                                         | M     | ✅     |
| T-02-08 | UI conceptos de nómina                                                                 | `app/(dashboard)/settings/payroll-concepts/`                 | T-02-02 | CRUD completo                                                  | M     | ✅     |
| T-02-09 | UI ficha de empleado y detalle de recibo                                               | `hr/employees/[id]`, `hr/payroll/[id]`                       | T-02-03 | desglose por concepto visible                                  | L     | ✅     |
| T-02-10 | Casos de prueba legales y documentación                                                | tests + `docs/09-HR-NOMINA-VENEZUELA.md` (creado en T-02-00) | T-02-04 | tabla de casos cubiertos                                       | M     | ✅     |

**Gate de salida E2:** un run generado hoy y recalculado tras cambiar parámetros da el mismo total
(inmutabilidad); cobertura backend no baja.

---

## 4. Épica E3 · Compras y cuentas por pagar — [`S-03`](./specs/S-03-compras-cxp.md)

| ID      | Tarea                                                                               | Artefactos                              | Depende | Verificación                            | Talla | Estado |
| ------- | ----------------------------------------------------------------------------------- | --------------------------------------- | ------- | --------------------------------------- | ----- | ------ |
| T-03-01 | `invoices`: `supplierInvoiceNumber`, `supplierInvoiceDate`, `dueDate`, `paidAmount` | migración + `modules/billing/*`         | E1      | alta de compra con vencimiento          | M     | ✅     |
| T-03-02 | `partners.creditDays` y cálculo de vencimiento                                      | migración + `modules/partners/*`        | T-03-01 | vencimiento = emisión + días de crédito | S     | ✅     |
| T-03-03 | `supplier_retention_settings` por empresa                                           | tabla nueva + UI                        | T-03-01 | parámetros persistidos                  | M     | ✅     |
| T-03-04 | Retenciones IVA/ISLR al publicar factura de compra                                  | `modules/billing/*`, `tax_retentions`   | T-03-03 | comprobante con número correlativo      | L     | ✅     |
| T-03-05 | `GET /v1/billing/payables` y `/payables/aging`                                      | `modules/billing/*` + índices           | T-03-01 | buckets 0-30/31-60/61-90/+90 correctos  | M     | ✅     |
| T-03-06 | `payments.direction` (`IN`/`OUT`) + `retentionAmount` + allocations                 | migración + `modules/treasury/*`        | T-03-04 | pago cancela total o parcial            | L     | ✅     |
| T-03-07 | `credit_notes.type` y devolución a proveedor                                        | migración + `modules/credit-notes/*`    | T-03-01 | NC de compra descuenta saldo            | M     | ✅     |
| T-03-08 | UI `operations/purchases` + detalle con retenciones y pagos                         | `app/(dashboard)/operations/purchases/` | T-03-05 | saldo y estado por fila                 | L     | ✅     |
| T-03-09 | UI pantalla de CxP con antigüedad                                                   | `app/(dashboard)/finance/payables/`     | T-03-05 | filtros por proveedor y vencimiento     | M     | ✅     |

**Gate de salida E3:** ciclo completo compra → retención → pago → asiento, con E2E.

---

## 5. Épica E4 · Contabilidad y cierre — [`S-04`](./specs/S-04-contabilidad.md)

| ID      | Tarea                                                                 | Artefactos                            | Depende          | Verificación                           | Talla | Estado |
| ------- | --------------------------------------------------------------------- | ------------------------------------- | ---------------- | -------------------------------------- | ----- | ------ |
| T-04-01 | Validación jerárquica del plan de cuentas (no borrar con movimientos) | `modules/accounting/*`                | —                | `409` al borrar cuenta usada           | S     | ✅     |
| T-04-02 | `POST /v1/accounting/entries/:id/post` (DRAFT → POSTED)               | ídem                                  | —                | no se puede editar un POSTED           | S     | ✅     |
| T-04-03 | Filtros `?from&to&sourceType` en asientos                             | ídem + índice                         | —                | consulta por origen                    | S     | ✅     |
| T-04-04 | `accounting_periods` + `close` / `reopen` auditado                    | tabla nueva + `modules/accounting/*`  | T-04-02          | asiento en período cerrado → `409`     | M     | ✅     |
| T-04-05 | `GET /reports/trial-balance`                                          | `modules/reports/*`                   | T-04-03          | suma debe = haber                      | M     | ✅     |
| T-04-06 | `GET /reports/balance-sheet` (habilita T-01-16)                       | ídem                                  | T-04-04          | cuadra con el balance de comprobación  | M     | ✅     |
| T-04-07 | `GET /reports/income-statement`                                       | ídem                                  | T-04-04          | resultado = ingresos − costos − gastos | M     | ✅     |
| T-04-08 | UI árbol de cuentas y grilla de asientos (debe/haber en vivo)         | `app/(dashboard)/finance/accounting/` | T-04-01          | asiento descuadrado bloquea guardar    | L     | ✅     |
| T-04-09 | UI cierre de período y reportes                                       | ídem                                  | T-04-06, T-04-07 | reapertura pide motivo                 | M     | ✅     |

**Gate de salida E4:** cierre de mes bloquea escrituras y los estados financieros cuadran con los
asientos; E2E de cierre.

---

## 6. Épica E5 · Tesorería y cobranzas — [`S-05`](./specs/S-05-tesoreria-cobranzas.md)

| ID      | Tarea                                                                                    | Artefactos                                                  | Depende           | Verificación                              | Talla | Estado |
| ------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------- | ----------------------------------------- | ----- | ------ |
| T-05-01 | `payment_methods`: `appliesIgtf`, `requiresReference`, `isCash` + PATCH/desactivar       | migración + `modules/settings/*`                            | —                 | método desactivado no aparece en el cobro | S     | ✅     |
| T-05-02 | `bank_accounts` con `branchId` obligatorio, saldo inicial y PATCH                        | migración + `modules/treasury/*`                            | E0                | cuenta creada por sucursal                | M     | ✅     |
| T-05-03 | `daily_closes` + `GET/POST /treasury/daily-close/:date` y `:date/close` / `:date/reopen` | tabla nueva + `modules/treasury/*`                          | T-05-02           | pago en fecha cerrada → `409`             | L     | ✅     |
| T-05-04 | `bank_statement_lines` + `POST /treasury/reconciliation/import` (CSV)                    | tabla nueva                                                 | T-05-02           | import idempotente por hash de archivo    | L     | ✅     |
| T-05-05 | `POST /treasury/reconciliation/:lineId/match`                                            | ídem                                                        | T-05-04           | un pago no se concilia dos veces          | M     | ✅     |
| T-05-06 | `GET /treasury/statements/:partnerId?from&to` con saldos                                 | `modules/treasury/*`                                        | —                 | saldo inicial + movimientos = final       | M     | ✅     |
| T-05-07 | Caja chica (`petty_cash_funds`, `petty_cash_movements`)                                  | tablas nuevas                                               | T-05-03           | rendición cierra el fondo                 | L     | ✅     |
| T-05-08 | UI `settings/methods`, `treasury/accounts`, `treasury/reconciliation`                    | `app/(dashboard)/...`                                       | T-05-01 … T-05-05 | CRUD y conciliación operables             | L     | ✅     |
| T-05-09 | UI cierre diario extendido y estado de cuenta con rango                                  | `finance/daily-close`, `operations/partners/[id]/statement` | T-05-03, T-05-06  | diferencia esperado vs contado            | M     | ✅     |

**Gate de salida E5:** cierre diario bloquea pagos y el estado de cuenta cuadra con los pagos.

---

## 7. Épica E6 · Reportes fiscales — [`S-06`](./specs/S-06-reportes-fiscales.md)

| ID      | Tarea                                                      | Artefactos                    | Depende | Verificación                         | Talla | Estado |
| ------- | ---------------------------------------------------------- | ----------------------------- | ------- | ------------------------------------ | ----- | ------ |
| T-06-01 | `fiscal_sequences` (correlativo por sucursal y año)        | tabla nueva                   | E3      | dos comprobantes seguidos sin huecos | M     | ✅     |
| T-06-02 | Libro de ventas y de compras con totales por alícuota      | `modules/reports/*` + índices | E4      | cuadra con contabilidad              | L     | ✅     |
| T-06-03 | Retenciones TXT/XML con numeración correlativa             | `modules/reports/*`           | T-06-01 | archivo válido contra formato SENIAT | L     | ✅     |
| T-06-04 | `GET /reports/fiscal/validation` (RIF, secuencia, cierres) | ídem                          | T-06-02 | detecta hueco y RIF inválido         | M     | ✅     |
| T-06-05 | `fiscal_exports` + `POST /reports/fiscal/exports`          | tabla nueva                   | T-06-03 | archivo con hash y usuario           | S     | ✅     |
| T-06-06 | UI `finance/reports` y `finance/retentions` con descarga   | `app/(dashboard)/finance/*`   | T-06-03 | descarga TXT/XML/CSV                 | M     | ✅     |

**Gate de salida E6:** libro de ventas del mes cuadra con la contabilidad y la exportación queda
trazada.

---

## 8. Épica E7 · Frontend restante — [`S-07`](./specs/S-07-frontend-restante.md)

| ID      | Tarea                                                   | Artefactos                                       | Depende | Verificación                                              | Talla | Estado |
| ------- | ------------------------------------------------------- | ------------------------------------------------ | ------- | --------------------------------------------------------- | ----- | ------ |
| T-07-01 | `GET /v1/audit` paginado con filtros + índice           | `modules/audit/*` + índice                       | E0      | filtros por entidad, usuario y fecha                      | M     | ✅     |
| T-07-02 | Módulo y pantalla de notas de crédito                   | `modules/credit-notes/*`, `finance/credit-notes` | E4      | NC aplicada descuenta saldo                               | L     | ✅     |
| T-07-03 | Módulo y pantalla de préstamos                          | `modules/loans/*`, `finance/loans`               | E5      | devolución total cierra (PAID + `returnDate`); parcial no | L     | ✅     |
| T-07-04 | Visor de auditoría con diff legible                     | `settings/audit`                                 | T-07-01 | "campo: antes → después"                                  | M     | ✅     |
| T-07-05 | Home del dashboard con KPIs, gráfico y actividad reales | `app/(dashboard)/dashboard/page.tsx`             | E0, BI  | 4 KPIs por sucursal                                       | M     | ✅     |
| T-07-06 | Pantalla de stock por almacén con alertas de mínimo     | `inventory/stock`                                | E1      | lista bajo mínimo                                         | M     | ✅     |
| T-07-07 | Navegación y permisos de UI sincronizados               | `lib/navigation.ts`, `lib/permissions.ts`        | todas   | cada módulo visible solo con permiso                      | S     | ✅     |

---

## 9. Tareas transversales (aplican a toda épica)

| ID    | Tarea                                                           | Cuándo            | Verificación                                      |
| ----- | --------------------------------------------------------------- | ----------------- | ------------------------------------------------- |
| TX-01 | Un PR por frente, con la spec enlazada y evidencia de ejecución | siempre           | revisión                                          |
| TX-02 | `pnpm openapi:export` + `pnpm sync:types` tras cambiar un DTO   | siempre           | `shared-types` sin diff manual                    |
| TX-03 | Permisos nuevos en `seed-rbac.ts` **y** `lib/permissions.ts`    | al crear permisos | seed idempotente                                  |
| TX-04 | Actualizar `docs/API-CONTRACTS.md` y `09-BITACORA.md`           | al cerrar cada PR | bitácora con BT nuevo                             |
| TX-05 | Gate completo antes de merge                                    | al cerrar cada PR | lint · typecheck · build · coverage · e2e · audit |
| TX-06 | Rollback descrito (migración reversible o feature flag)         | en cada migración | sección de rollback en el PR                      |

---

## 10. Secuencia y registro de avance

> **El número de la épica identifica la spec, no el orden de ejecución.** La secuencia acordada el
> 2026-10-26 adelanta la obligación fiscal (E6) antes de compras/CxP (E3) y de tesorería (E5), e
> incorpora multimoneda (E8) antes de contabilidad porque el libro debe nacer con moneda funcional.

| Ola | Semanas | Épica / tareas                         | Tareas  | Hechas |
| --- | ------- | -------------------------------------- | ------- | ------ |
| 1   | 1-2     | E0 sucursal (T-00-01 … T-00-13)        | 13      | 11     |
| 2   | 3-4     | **E8 multimoneda (T-08-01 … T-08-13)** | 13      | 12     |
| 3   | 5       | E1 frentes A, B y C                    | 17      | 17     |
| 4   | 6-7     | E2 nómina                              | 11      | 11     |
| 5   | 8-9     | E4 contabilidad                        | 9       | 9      |
| 6   | 10-11   | E6 reportes fiscales                   | 6       | 6      |
| 7   | 12-13   | E3 compras y CxP                       | 9       | 9      |
| 8   | 14-15   | E5 tesorería                           | 9       | 9      |
| 9   | 16      | E7 frontend restante                   | 7       | 7      |
| —   | —       | Transversales                          | 6       | 0      |
| —   | —       | **Total**                              | **100** | **92** |

**Orden innegociable:** E0 antes que cualquier otro módulo (sin aislamiento, cada módulo nuevo nace
con el mismo defecto). **E8 antes de E4** (el libro contable no puede nacer sin moneda funcional) y
antes de E3/E5/E6, que producen documentos con monto.

**Consecuencias de adelantar E6 (decisión del 2026-10-26):**

1. Se entrega antes lo que es obligación legal: libro de ventas, resumen IVA/IGTF, retenciones de
   venta en TXT/XML y la validación previa a exportar.
2. **El libro de compras y las retenciones de compra quedan a medias hasta que llegue E3**
   (semana 10): se documenta como limitación conocida en la UI y en `API-CONTRACTS.md`.
3. La validación "período sin cierres pendientes" (T-06-04) se activa recién con E5: hasta entonces
   el chequeo se limita a RIF, secuencia y cuadre contable.

## 11. Riesgos del plan

| Riesgo                                                                     | Mitigación                                                                                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| T-00-08 es `XL` y toca 8 módulos, en un único PR (decisión del 2026-10-26) | La suite de T-00-12 cubre los 8 módulos y el PR no se mergea por partes; si excede 3 días, se replantea    |
| Backfill de `branch_id` en datos existentes sin sucursal clara             | Asignar la sucursal por defecto de la empresa y registrar excepciones en auditoría                         |
| Paginación de `GET /billing/invoices` rompe consumidores                   | Se implementa **aditiva** (`?paginated=true`); sin el flag sigue el arreglo plano                          |
| Reglas LOTTT mal interpretadas                                             | Cerrar T-02-10 con revisión de nómina antes de conectar la UI                                              |
| Migraciones de 12 columnas en una sola tanda                               | Migración por tabla con su backfill y verificación de conteos                                              |
| La base de desarrollo hoy tiene 5 facturas, 3 pagos y 2 sucursales         | Backfill trivial en dev; si hay producción con datos, definir sucursal por defecto y registrar excepciones |
| `docs/09-HR-NOMINA-VENEZUELA.md` citado en S-02 **no existía**             | Se crea en T-02-00 antes de tocar el motor de cálculo                                                      |
| Elegir mal la moneda funcional (D-01) encarece todo lo que venga después   | T-08-01 se cierra como documento aprobado **antes** de tocar esquema o código                              |
| El scraping de BCV se rompe cuando cambian el HTML                         | Job con reintentos, alerta por antigüedad de la tasa y override manual auditado                            |
| Documentos históricos sin tasa verificable                                 | Backfill con la tasa del documento; si no existe, la del día y la fila se marca para revisión              |
| **13 de 22 controladores sin `@RequirePermissions`** (`H-100`)             | TX-03: decorar por ruta, ajustar `seed-rbac.ts` y la matriz de roles antes de exponer la API fuera de dev  |

## 12. Fuera de alcance (no entra en estas 16 semanas)

Activos fijos y depreciación · presupuestos · multi-empresa contable · app móvil de inventario ·
transmisión automática al SENIAT · RLS de PostgreSQL · integración bancaria directa ·
**revaluación de saldos por variación cambiaria** y cobertura de riesgo cambiario (posterior a `S-08`).
