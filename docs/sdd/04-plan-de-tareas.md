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
| T-00-12 | Pruebas de aislamiento cruzado                                                                                                                                                        | `*.service.test.ts` + `apps/backend/test/*` + `e2e/*`                                                  | T-00-08          | 3 capas verdes; E2E "B no ve A"                                                                 | M     | ✅     |
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

| ID      | Tarea                                                                                                     | Artefactos                                                        | Depende          | Verificación                                                                                                                                                                                     | Talla | Estado |
| ------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------ |
| T-08-01 | **Decisión D-01** de moneda funcional y política de tasa, redondeo e IGTF (documento aprobado)            | `docs/MULTIMONEDA.md` (nuevo)                                     | —                | **decidido (2026-10-26):** funcional VES + reporte dual USD; BCV con override auditado                                                                                                           | S     | ✅     |
| T-08-02 | Restricción de **una sola** moneda base + seed idempotente VES/USD                                        | `currencies`, `seed-core.ts`                                      | T-08-01          | intento de segunda base falla en BD                                                                                                                                                              | S     | ✅     |
| T-08-03 | `exchange_rates`: único `(currencyId, date)`, `source`, `createdBy`; historial paginado                   | migración + `modules/settings/currencies/*`                       | T-08-02          | dos tasas mismo día y moneda → `409`                                                                                                                                                             | M     | ✅     |
| T-08-04 | Job programado de tasa BCV (`@nestjs/schedule`, 08:00 America/Caracas) con reintentos                     | `modules/cron/*`, `ScheduleModule`                                | T-08-03          | corre solo; `GET /health/rates` refleja la hora                                                                                                                                                  | L     | ✅     |
| T-08-05 | Retirar scraping frágil y el `FALLBACK_API_URL` corrupto; validación de cordura (≤ 0, variación diaria)   | `modules/cron/cron.service.ts`                                    | T-08-04          | tasa basura rechazada con `422` y queda la anterior                                                                                                                                              | M     | ✅     |
| T-08-06 | `payments.amountBase` + backfill; `tax_retentions` con moneda y tasa                                      | migración + `modules/treasury`, `modules/billing`                 | T-08-02          | backfill cuadra con `amount * exchange_rate`                                                                                                                                                     | M     | ✅     |
| T-08-07 | Libro en moneda funcional: `accounting_entries.baseCurrencyId` + original en la línea                     | migración + `modules/accounting/*`                                | T-08-02          | asiento de factura USD suma en base y conserva original                                                                                                                                          | L     | ✅     |
| T-08-08 | IGTF por `currencyId != base` (elimina la heurística `rate > 1`)                                          | `modules/billing/services/billing.service.ts`                     | T-08-02          | test: moneda extranjera con tasa 1,0 igual aplica IGTF                                                                                                                                           | S     | ✅     |
| T-08-09 | `MoneyService.convert()` único con `decimal.js` y política de redondeo                                    | `apps/backend/src/common/money/*` (nuevo)                         | T-08-01          | unit: 1 / 36,5 / 0 → error; HALF_UP                                                                                                                                                              | M     | ✅     |
| T-08-10 | Frescura de tasa: `getExchangeRate` rechaza tasas fuera del umbral y la emisión exige confirmación        | `billing.service.ts`, `treasury/*`                                | T-08-04          | tasa de hace 3 días no se usa en silencio                                                                                                                                                        | M     | ✅     |
| T-08-11 | Diferencia cambiaria al cobrar en moneda distinta a la factura                                            | `modules/treasury/*`, `modules/accounting/*`                      | T-08-07          | cobro en VES de factura USD deja saldo 0 con línea de diferencia                                                                                                                                 | L     | ✅     |
| T-08-12 | Frontend: formato por moneda, monto dual y aviso de tasa vencida                                          | `global-rate-display.tsx`, `lib/utils.ts`, formularios de emisión | T-08-10          | E2E: aviso bloquea emisión hasta confirmar. **2026-10-30: parcial** — sólo `global-rate-display` y el diálogo de pago de CxP; 74 de 80 montos siguen con USD por defecto (ver `S-09` T-09-01…03) | M     | 🟡     |
| T-08-13 | **Reporte dual obligatorio**: columnas VES + USD a tasa de corte en estados, libros y reportes de gestión | `modules/reports/*`, `modules/accounting/*`                       | T-08-07, T-08-09 | ambas columnas cuadran; `closingRate` en el encabezado. **2026-10-30: parcial** — el backend ya devuelve `usd` + `closingRate`, ninguna pantalla lo consume (ver `S-09` T-09-28…30)              | M     | 🟡     |

**Gate de salida E8:** una factura en USD cobrada en VES a tasa distinta cierra el saldo en cero con
la diferencia asentada; ningún reporte suma monedas distintas sin convertir; y **todo reporte sale con
columnas VES y USD que cuadran entre sí** con la tasa de corte en el encabezado.

---

## 1.6 Épica E9 · UI de los flujos del MANAGER con multimoneda — [`S-09`](./specs/S-09-ui-flujos-manager.md)

> **Origen:** auditoría UI del 2026-10-30 posterior a la suite visual `MG-01…MG-24`. El backend ya
> tiene los flujos; faltan las pantallas. La multimoneda es **requisito de base**, no un extra: sin
> moneda visible ni tasa congelada no se puede emitir ningún documento.
>
> Plan completo, auditoría por proceso y criterios de aceptación en
> [`S-09`](./specs/S-09-ui-flujos-manager.md). Las decisiones abiertas D-02…D-07 están en su §12 y
> bloquean las tareas indicadas.

### 1.6.1 F1 · Moneda visible y motor alineado (bloquea al resto)

| ID      | Tarea                                                                            | Artefactos                                                                 | Depende | Verificación                                   | Talla | Estado |
| ------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------- | ---------------------------------------------- | ----- | ------ |
| T-09-01 | `formatMoney(amount, code)` sin default + refactor de las 74 llamadas sin moneda | `lib/utils.ts`, `lib/currency.ts` (nuevo), vistas de finanzas e inventario | —       | typecheck falla si falta la moneda             | M     | ✅     |
| T-09-02 | Columnas `Moneda`, `Tasa` y total dual en facturas, pedidos, pagos, NC y CxP     | `invoices-view`, `orders-view`, `treasury-view`, `credit-notes-view`       | T-09-01 | factura USD y VES se ven distintas             | M     | ✅     |
| T-09-03 | `GET /health/rates` + `global-rate-display` con fuente y antigüedad              | `health.controller.ts`, `global-rate-display.tsx`, `lib/rates.ts`          | —       | badge "BCV 36,50 · hace 2 h"; ámbar si vencida | S     | ✅     |
| T-09-04 | Alinear S-08 §5 con lo implementado (rutas de tasas y permiso de override)       | `specs/S-08-multimoneda.md`, `docs/API-CONTRACTS.md`                       | —       | no quedan rutas documentadas inexistentes      | S     | ✅     |
| T-09-05 | Corregir el tablero: `T-08-12`/`T-08-13` quedan 🟡 con nota                      | este documento                                                             | —       | tablero coincide con el código                 | S     | ✅     |

**Evidencia F1 (2026-10-30):** `formatMoney` exige moneda (74 llamadas corregidas con el catálogo
`useCurrencyIndex`), total dual verificado en vivo con una factura USD 119,48 · Bs 4.361,02 frente a
facturas VES sin duplicado, `GET /v1/health/rates` responde `{rate, source, ageHours, isStale}` y el
sidebar muestra "Manual · vencida · hace 147 d". Tests: 1080 backend / 335 frontend, lint 0 errores.

### 1.6.2 F2 · Monedas y tasas

| ID      | Tarea                                                                                  | Artefactos                                                              | Depende  | Verificación                          | Talla | Estado |
| ------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- | ------------------------------------- | ----- | ------ |
| T-09-06 | Módulo y pantalla `settings/currencies`: base, lista y tasa vigente                    | `modules/settings/currencies/*`, `app/.../settings/currencies/page.tsx` | T-09-03  | deja de ser `ModuleStub`              | M     | ✅     |
| T-09-07 | Historial de tasas paginado + diálogo de override (motivo obligatorio)                 | mismas + `components/rate-override-dialog.tsx`                          | T-09-06  | override crea fila `MANUAL` con autor | M     | ✅     |
| T-09-08 | Botón "Sincronizar BCV" con feedback de edad y resultado                               | `POST /settings/currencies/refresh`                                     | T-09-06  | error de BCV no rompe la pantalla     | S     | ✅     |
| T-09-09 | RBAC: `settings:currencies:view` a MANAGER/ACCOUNTANT y `settings:currencies:override` | `seed-rbac.ts`, `lib/permissions.ts`, `navigation.ts`                   | **D-02** | MANAGER ve monedas, no puede override | S     | ✅     |

### 1.6.3 F3 · Emisión de facturas

| ID      | Tarea                                                                                  | Artefactos                                                 | Depende          | Verificación                          | Talla | Estado |
| ------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- | ------------------------------------- | ----- | ------ |
| T-09-10 | Formulario de factura con moneda, tasa con `StaleRateGate`, líneas, IGTF y vencimiento | `invoice-form-dialog.tsx` (nuevo), `hooks/use-invoices.ts` | T-09-01, T-09-06 | base+IVA+IGTF=total                   | L     | ✅     |
| T-09-11 | Vencimiento sugerido por `partners.creditDays` y edición de borradores                 | `invoice-form`, `PATCH /billing/invoices/:id`              | T-09-10, T-09-22 | cliente con 30 días propone +30       | S     | ⬜     |
| T-09-12 | Acciones `post`/`void` con permiso real y confirmación                                 | `invoices-view`, `usePermission`                           | T-09-10          | MANAGER sólo ve lo que su rol permite | S     | ✅     |
| T-09-13 | Permiso `finance:invoices:create` para MANAGER                                         | `seed-rbac.ts`, `lib/permissions.ts`                       | **D-03**         | MANAGER emite desde Ventas            | S     | ✅     |

### 1.6.4 F4 · Pedidos

| ID      | Tarea                                                            | Artefactos                               | Depende          | Verificación                           | Talla | Estado |
| ------- | ---------------------------------------------------------------- | ---------------------------------------- | ---------------- | -------------------------------------- | ----- | ------ |
| T-09-14 | `ordersApi`: create, update, confirm, cancel, invoice            | `modules/orders/api.ts`, `orders-api.ts` | —                | contrato tipado contra el DTO          | S     | ✅     |
| T-09-15 | Formulario de pedido reutilizando la cabecera de factura         | `order-form-dialog.tsx` (nuevo)          | T-09-14, T-09-10 | pedido con moneda y tasa congeladas    | L     | ✅     |
| T-09-16 | Acciones por estado: confirmar, cancelar y facturar con tooltips | `order-detail-view.tsx`                  | T-09-15          | botones deshabilitados fuera de estado | M     | ✅     |
| T-09-17 | Detalle de pedido con líneas, moneda, tasa y dual                | `order-detail-view.tsx` (S-10)           | T-09-15          | pedido USD muestra dual                | M     | ✅     |

### 1.6.5 F5 · Tesorería y cuentas bancarias

| ID      | Tarea                                                                                            | Artefactos                                                    | Depende  | Verificación                           | Talla | Estado |
| ------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------- | -------------------------------------- | ----- | ------ |
| T-09-18 | Editar cuenta bancaria, activar/desactivar y moneda de la cuenta                                 | `treasury-accounts-view.tsx`, `api/treasury.ts`               | —        | cuenta editada refleja banco y moneda  | M     | ⬜     |
| T-09-19 | Cobro/pago manual desde Tesorería con moneda, tasa y asignación a facturas                       | `components/payment-form.tsx` (nuevo, reutiliza CxP)          | T-09-10  | cobro VES de factura USD deja saldo 0  | L     | ⬜     |
| T-09-20 | Anular pago con `finance:payments:void` en lugar de `invoices:void`                              | `treasury-view.tsx`, `treasury.controller.ts`, `seed-rbac.ts` | **D-05** | permiso correcto por acción            | S     | ✅     |
| T-09-21 | Permisos propios de conciliación y cierre (`finance:treasury:reconcile`, `finance:close:manage`) | `seed-rbac.ts`, `reconciliation-view`, `daily-close-view`     | —        | se retira el gate por `create_account` | S     | ⬜     |

### 1.6.6 F6 · Maestros

| ID      | Tarea                                                            | Artefactos                                                 | Depende  | Verificación                         | Talla | Estado |
| ------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | -------- | ------------------------------------ | ----- | ------ |
| T-09-22 | `creditDays` en el diálogo de tercero y vencimiento en CxP       | `partner-dialog.tsx`, `partners/api.ts`                    | —        | tercero con 15 días propone +15      | S     | ⬜     |
| T-09-23 | Desactivar tercero con historial y estado de cuenta              | `partners-table.tsx`, `partners/api.ts`                    | **D-06** | tercero con facturas se desactiva    | M     | 🟡     |
| T-09-24 | `currencyId` en el formulario de producto y precio con su moneda | `product-dialog.tsx`, `inventory/api/products.ts`          | T-09-01  | producto USD se lista con su símbolo | M     | ⬜     |
| T-09-25 | Desactivar producto (`DELETE`/`isActive`)                        | `products-view.tsx`, `products.service.ts`                 | T-09-24  | producto con stock no se borra       | S     | ⬜     |
| T-09-26 | Pantallas reales de Bancos e Impuestos                           | `app/.../settings/banks/page.tsx`, `tax-concepts/page.tsx` | —        | dejan de ser stubs                   | M     | ⬜     |
| T-09-27 | Editar método de pago y mapeo método → cuenta bancaria           | `payment-methods-view.tsx`, `payment_method_accounts`      | T-09-18  | método con cuenta se usa al cobrar   | M     | ⬜     |

### 1.6.7 F7 · Reportes y contabilidad

| ID      | Tarea                                                             | Artefactos                                                      | Depende  | Verificación                             | Talla | Estado |
| ------- | ----------------------------------------------------------------- | --------------------------------------------------------------- | -------- | ---------------------------------------- | ----- | ------ |
| T-09-28 | Pantalla de reportes con columnas VES y USD y tasa de corte       | `reports-view.tsx`, `api/reports.ts`                            | T-09-01  | ambas columnas cuadran con `closingRate` | M     | ⬜     |
| T-09-29 | Libros con columna USD en pantalla (CSV sigue en base)            | `reports-view.tsx`, `reports.service.ts`                        | T-09-28  | CSV no cambia; pantalla sí dual          | M     | ⬜     |
| T-09-30 | `GET /accounting/trial-balance` y `/income-statement` + pantallas | `accounting.controller.ts`, `services/*`, `finance/accounting/` | T-09-28  | balance cuadra y suma en base            | L     | ⬜     |
| T-09-31 | `finance:reports:view` a MANAGER                                  | `seed-rbac.ts`, `navigation.ts`                                 | **D-07** | MANAGER ve Reportes                      | S     | ✅     |

### 1.6.8 F8 · QA y documentación

| ID      | Tarea                                             | Artefactos                                                         | Depende | Verificación                  | Talla | Estado |
| ------- | ------------------------------------------------- | ------------------------------------------------------------------ | ------- | ----------------------------- | ----- | ------ |
| T-09-32 | Casos `MG-25…MG-40` y `CT-16…CT-20` (multimoneda) | `docs/qa/01-manager.md`, `docs/qa/00-transversal.md`               | F1…F7   | casos ejecutables con semilla | M     | ⬜     |
| T-09-33 | Ejecutar la suite ampliada con evidencias         | `docs/qa/ejecuciones/`                                             | T-09-32 | 0 fallas S1/S2 abiertas       | M     | ⬜     |
| T-09-34 | Actualizar índices, roadmap y bitácora            | `docs/qa/README.md`, `03-roadmap.md`, `docs/update/09-BITACORA.md` | T-09-33 | índices sin enlaces muertos   | S     | ⬜     |

**Gate de salida E9:** ningún monto se muestra sin su moneda; todo documento emitido guarda su tasa y
muestra el dual; pedidos, facturas, cobros y cuentas bancarias se administran desde la UI; la tasa
tiene pantalla, historial y override auditado; y los reportes salen con columnas VES y USD.

---

## 1.7 Épica E10 · Vistas de detalle de documentos — [`S-10`](./specs/S-10-vistas-detalle-documentos.md)

> **Origen:** revisión del 2026-10-30. Los cuatro documentos comerciales existen sólo como listado: no
> hay ficha de pedido, venta, compra ni factura. Sin ellas no se puede revisar un documento, ver su
> saldo ni imprimirlo. Reutiliza la infraestructura multimoneda de E9.

### 1.7.1 F1 · Base compartida y backend

| ID      | Tarea                                                                                         | Artefactos                                                           | Depende          | Verificación                                 | Talla | Estado |
| ------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------- | -------------------------------------------- | ----- | ------ |
| T-10-01 | Ampliar `GET /orders/:id`: tercero, almacén, sucursal, moneda, producto y factura asociada    | `orders.service.ts`, `orders.dto.ts`                                 | —                | pedido facturado trae `invoiceCode`          | M     | ✅     |
| T-10-02 | Ampliar `GET /billing/invoices/:id`: moneda, pedido, pagos, notas, retenciones, saldo y autor | `billing.service.ts`, `billing.dto.ts`                               | —                | factura USD con pago VES trae saldo correcto | L     | ✅     |
| T-10-03 | Tipos en `shared-types` + `getDetail` en ambos clientes                                       | `packages/shared-types`, `modules/orders/*`, `modules/finance/api/*` | T-10-01, T-10-02 | typecheck falla si el contrato cambia        | S     | ✅     |
| T-10-04 | `DocumentShell`, `DocumentHeader`, `DocumentTotals`, `DocumentLines`                          | `modules/documents/components/*` (nuevo)                             | T-10-03          | cabecera con estado y total dual             | L     | ✅     |
| T-10-05 | `DocumentActions`, `DocumentRelated` y confirmación reutilizable                              | `modules/documents/components/*`                                     | T-10-04          | acciones deshabilitadas con motivo           | M     | ✅     |

### 1.7.2 F2 · Facturación y ventas

| ID      | Tarea                                                            | Artefactos                                                    | Depende | Verificación                   | Talla | Estado |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------- | ------- | ------------------------------ | ----- | ------ |
| T-10-06 | Ruta `/finance/invoices/[id]` con la ficha completa              | `app/.../finance/invoices/[id]/page.tsx`, `InvoiceDetailView` | T-10-05 | abre SALE y PURCHASE           | M     | ✅     |
| T-10-07 | Ruta `/operations/sales/[id]` con tipo SALE                      | `app/.../operations/sales/[id]/page.tsx`                      | T-10-06 | 404 si el documento no es SALE | S     | ✅     |
| T-10-08 | Enlazar el código de ambos listados a la ficha y añadir "Volver" | `invoices-view` (ambos), `orders/api.ts`                      | T-10-07 | clic en código abre la ficha   | S     | ✅     |

### 1.7.3 F3 · Compras

| ID      | Tarea                                                                     | Artefactos                                   | Depende | Verificación                                | Talla | Estado |
| ------- | ------------------------------------------------------------------------- | -------------------------------------------- | ------- | ------------------------------------------- | ----- | ------ |
| T-10-09 | Ruta `/operations/purchases/[id]` con factura del proveedor y retenciones | `app/.../operations/purchases/[id]/page.tsx` | T-10-06 | muestra `supplierInvoiceNumber` y retención | M     | ✅     |
| T-10-10 | Enlaces desde la tabla de Compras y desde CxP                             | `purchases-view.tsx`, `payables-view.tsx`    | T-10-09 | dos caminos llegan a la misma ficha         | S     | ✅     |

### 1.7.4 F4 · Pedidos

| ID      | Tarea                                                                    | Artefactos                                | Depende          | Verificación                       | Talla | Estado |
| ------- | ------------------------------------------------------------------------ | ----------------------------------------- | ---------------- | ---------------------------------- | ----- | ------ |
| T-10-11 | Ruta `/operations/orders/[id]` con líneas, total dual y factura asociada | `app/.../operations/orders/[id]/page.tsx` | T-10-01, T-10-05 | pedido facturado enlaza su factura | M     | ✅     |
| T-10-12 | Confirmar / Cancelar / Facturar desde la ficha                           | `DocumentActions`, `orders-api.ts`        | T-10-11          | confirmar deja el pedido CONFIRMED | M     | ✅     |
| T-10-13 | Enlace del código del pedido a la ficha                                  | `orders-view.tsx`                         | T-10-11          | —                                  | S     | ✅     |

### 1.7.5 F5 · Impresión y fiscal

| ID      | Tarea                                                       | Artefactos                                | Depende          | Verificación                       | Talla | Estado |
| ------- | ----------------------------------------------------------- | ----------------------------------------- | ---------------- | ---------------------------------- | ----- | ------ |
| T-10-14 | Hoja `@media print` y botón "Imprimir" en las cuatro fichas | `DocumentPrintStyles`, `app/globals.css`  | T-10-06, T-10-11 | sin sidebar ni botones al imprimir | S     | ✅     |
| T-10-15 | Pestaña "Fiscal" con el JSON fiscal en facturas emitidas    | `DocumentRelated`, `GET /:id/fiscal-json` | T-10-06          | JSON visible y descargable         | S     | ✅     |

### 1.7.6 F6 · QA y documentación

| ID      | Tarea                                               | Artefactos                                           | Depende | Verificación            | Talla | Estado |
| ------- | --------------------------------------------------- | ---------------------------------------------------- | ------- | ----------------------- | ----- | ------ |
| T-10-16 | Casos `MG-41…MG-52` y `CT-21…CT-23`                 | `docs/qa/01-manager.md`, `docs/qa/00-transversal.md` | F1…F5   | casos ejecutables       | M     | ⬜     |
| T-10-17 | Ejecución con evidencias y actualización de índices | `docs/qa/ejecuciones/`, `docs/qa/README.md`          | T-10-16 | 0 fallas S1/S2 abiertas | M     | ⬜     |

**Gate de salida E10:** cada listado abre su ficha; la ficha muestra moneda, tasa congelada, total dual,
pagado y saldo; las acciones se ejecutan en contexto respetando estado y permiso; y el documento se
imprime sin la interfaz de navegación.

**Avance 2026-10-30:** F1 y F2 completas (`T-10-01…T-10-08`). Fichas operativas en
`/finance/invoices/[id]` y `/operations/sales/[id]`; `GET /orders/:id` y `GET /billing/invoices/:id`
ampliados con moneda, partes relacionadas y saldo. Se corrigió de paso `DEF-024` (los listados mostraban
la fecha de hoy porque leían `issueDate`, campo inexistente en el API). Quedan F3 (ruta de Compras),
F4 (ficha de pedido con acciones) y F5 (impresión y pestaña fiscal). Detalle y evidencia en
[`S-10` §13](./specs/S-10-vistas-detalle-documentos.md). F3, F4 y F5 cerradas el mismo día:
`/operations/purchases/[id]` y `/operations/orders/[id]` con Confirmar/Facturar/Cancelar, facturación de
pedidos real (`POST /orders/:id/invoice`) e impresión sin navegación.

---

## 1.8 Épica E11 · Estandarización de tablas de listado — [`S-11`](./specs/S-11-estandarizacion-tablas.md)

> **Origen:** revisión del 2026-10-30. Las siete tablas operativas resolvían lo mismo con siete estilos:
> dos sin tarjeta, conteos en tres sitios distintos, cargas y vacíos heterogéneos, montos sin moneda y un
> `<select>` nativo suelto.

### 1.8.1 F1 · Primitivos y refactor de las siete vistas

| ID      | Tarea                                                               | Artefactos                                                                     | Depende | Verificación                             | Talla | Estado |
| ------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------- | ---------------------------------------- | ----- | ------ |
| T-11-01 | `ListCard`, `ListTh`, `ListTd`, `ListSkeletonRows` y `ListEmptyRow` | `components/list/list-table.tsx` (nuevo)                                       | —       | todas las tablas con el mismo contenedor | M     | ✅     |
| T-11-02 | `ListRowActions` y `ListFilters`                                    | `components/list/list-table.tsx`                                               | T-11-01 | menú y barra de filtros únicos           | S     | ✅     |
| T-11-03 | Clientes y proveedores + Productos                                  | `partners-table.tsx`, `products-view.tsx`                                      | T-11-01 | límite de crédito con moneda             | M     | ✅     |
| T-11-04 | Pedidos, Ventas y Compras                                           | `orders-view.tsx`, `orders/components/invoices-view.tsx`, `purchases-view.tsx` | T-11-02 | filas de 52 px y `Select` de shadcn      | M     | ✅     |
| T-11-05 | Stock y Facturación                                                 | `stock-view.tsx`, `finance/components/invoices-view.tsx`                       | T-11-02 | columnas responsive comunes              | M     | ✅     |
| T-11-06 | Verificación visual de las siete rutas                              | navegador (MANAGER)                                                            | F1      | alto de fila idéntico en las siete       | S     | ✅     |

**Gate de salida E11:** las siete pantallas comparten contenedor, cabecera, fila y menú; no quedan
`<select>` nativos ni montos sin moneda en listados. Detalle en
[`S-11` §6](./specs/S-11-estandarizacion-tablas.md).

---

## 1.9 Épica E12 · Histórico de procesos de documentos — [`S-12`](./specs/S-12-historico-procesos-documentos.md)

> **Origen:** revisión del 2026-10-30. La ficha mostraba el estado actual y nada más: no se sabía quién
> confirmó, facturó o anuló un documento, ni cuándo. El histórico tiene que viajar del pedido a la
> facturación y leerse igual desde cualquiera de los dos documentos.

| ID      | Tarea                                                                 | Artefactos                                            | Depende          | Verificación                                 | Talla | Estado |
| ------- | --------------------------------------------------------------------- | ----------------------------------------------------- | ---------------- | -------------------------------------------- | ----- | ------ |
| T-12-01 | Tabla `document_events` (append-only) + migración `0023`              | `packages/database/src/schema.ts`, `drizzle/0023_*`   | —                | tres índices creados                         | M     | ✅     |
| T-12-02 | `DocumentEventsService`: registro tolerante a fallos y cadena         | `modules/documents/*` (nuevo)                         | T-12-01          | la cadena se lee desde ambos extremos        | L     | ✅     |
| T-12-03 | Eventos de pedido: creado, editado, confirmado, cancelado, facturado  | `orders.service.ts`, `orders.controller.ts`           | T-12-02          | cada acción deja una fila con su autor       | M     | ✅     |
| T-12-04 | Eventos de factura: creada, editada, emitida y anulada con motivo     | `billing.service.ts`, `billing.controller.ts`         | T-12-02          | la anulación guarda el motivo                | M     | ✅     |
| T-12-05 | `history` embebido en `GET /orders/:id` y `GET /billing/invoices/:id` | `dto/*.dto.ts`, `findOneWithHistory`                  | T-12-03, T-12-04 | mismo arreglo de eventos en ambos documentos | S     | ✅     |
| T-12-06 | `DocumentTimeline` en las cuatro fichas                               | `document-timeline.tsx`, fichas de pedido y factura   | T-12-05          | fecha con hora, usuario y enlace cruzado     | M     | ✅     |
| T-12-07 | Autor del pedido en `orders.user_id` (la ficha muestra "Registró")    | `orders.service.ts`                                   | T-12-03          | "Registró: Test Manager"                     | S     | ✅     |
| T-12-08 | `DEF-025`: `finance:invoices:post` para MANAGER                       | `seed-rbac.ts`                                        | —                | el MANAGER cierra el flujo hasta la emisión  | S     | ✅     |
| T-12-09 | Pruebas de integración del flujo y de la línea de tiempo              | `test/document-history.test.ts`, `documents.test.tsx` | T-12-06          | 4 + 2 pruebas nuevas                         | M     | ✅     |

**Gate de salida E12:** toda acción sobre un pedido o una factura deja constancia del autor y la fecha;
la ficha de cualquiera de los dos muestra la cadena completa desde la creación del pedido hasta la
emisión o anulación de la factura. Detalle en
[`S-12` §6](./specs/S-12-historico-procesos-documentos.md).

---

## 1.10 Épica E13 · Controles de fecha unificados — [`S-13`](./specs/S-13-controles-de-fecha.md)

> **Origen:** revisión del 2026-10-31. Quince pantallas usaban `<input type="date">` nativo: el formato
> y el selector dependían del navegador, y los filtros de rango permitían invertir las fechas.

| ID      | Tarea                                                         | Artefactos                                                                    | Depende | Verificación                              | Talla | Estado |
| ------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- | ----------------------------------------- | ----- | ------ |
| T-13-01 | `Calendar` de shadcn + `DatePicker` con valor `YYYY-MM-DD`    | `components/ui/calendar.tsx`, `components/ui/date-picker.tsx`                 | —       | calendario en español y formato local     | M     | ✅     |
| T-13-02 | Modo no controlado + `hidden` para formularios con `FormData` | `date-picker.tsx`, `payroll-view`, `entries`, `employees`, `payroll-settings` | T-13-01 | nómina y asiento guardan la fecha elegida | S     | ✅     |
| T-13-03 | Sustituir los `input type="date"` de filtros y formularios    | 15 archivos                                                                   | T-13-02 | no queda ningún `type="date"`             | M     | ✅     |
| T-13-04 | Rangos coherentes (`fromDate`/`toDate`) y acción "Limpiar"    | `date-picker.tsx`                                                             | T-13-03 | el "hasta" no acepta días previos         | S     | ✅     |
| T-13-05 | Validar el período de nómina sin el `required` nativo         | `payroll-view.tsx`                                                            | T-13-02 | sin fechas no se genera la nómina         | S     | ✅     |
| T-13-06 | Pruebas del control                                           | `components/ui/date-picker.test.tsx`                                          | T-13-01 | 6 pruebas                                 | S     | ✅     |

**Gate de salida E13:** toda fecha se elige con el mismo control, en español; los formularios siguen
enviando `YYYY-MM-DD` sin cambios en el backend. Detalle en
[`S-13` §6](./specs/S-13-controles-de-fecha.md).

---

## 1.11 Épica E14 · Contrato del cargo MANAGER — [`S-14`](./specs/S-14-actuaciones-rol-manager.md)

> **Origen:** revisión del 2026-10-31. El rol creció por decisiones sueltas (`D-02`…`D-07`, `DEF-025`) y
> tres documentos lo describían distinto: `database-spec.md` §4.2 listaba 18 permisos, `qa/01-manager.md`
> decía que el gerente no emite facturas y el seed tenía 42. Nadie podía responder qué hace realmente un
> gerente ni si la cuenta de prueba estaba bien armada.

| ID      | Tarea                                                                      | Artefactos                                                 | Depende | Verificación                                             | Talla | Estado |
| ------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- | ------- | -------------------------------------------------------- | ----- | ------ |
| T-14-01 | Dar de alta el cargo como documento único (actuaciones y prohibiciones)    | `specs/S-14-actuaciones-rol-manager.md`                    | —       | una sola fuente describe el rol                          | S     | ✅     |
| T-14-02 | `inventory:moves:view` + `inventory:moves:approve` para MANAGER            | `seed-rbac.ts`                                             | T-14-01 | el ítem Movimientos aparece y no da 403                  | S     | ✅     |
| T-14-03 | `finance:invoices:edit` para MANAGER                                       | `seed-rbac.ts`                                             | T-14-01 | `PATCH /billing/invoices/:id` en DRAFT                   | S     | ✅     |
| T-14-04 | Separar conciliación, caja chica y cierre diario de `create_account`       | `treasury.controller.ts`, `seed-rbac.ts`, `permissions.ts` | T-14-01 | `T-09-21` cerrada; MANAGER y ACCOUNTANT conservan acceso | M     | ✅     |
| T-14-05 | Registrar al aprobador del movimiento (`approved_by` quedaba en `NULL`)    | `inventory.controller.ts`                                  | T-14-02 | la fila guarda al MANAGER que aprobó                     | S     | ✅     |
| T-14-06 | Prueba de contrato del cargo (lo que hace y lo que no)                     | `packages/database/tests/unit/role-manager.test.ts`        | T-14-02 | 12 casos                                                 | M     | ✅     |
| T-14-07 | Alinear `database-spec.md` §4.2/§4.5, `qa/01-manager.md` y la matriz de QA | `docs/SPECIFICATIONS/database-spec.md`, `docs/qa/*`        | T-14-04 | los tres documentos coinciden con el seed                | M     | ✅     |
| T-14-08 | Editar borradores de factura desde la ficha (`T-09-11`)                    | `invoice-detail-view.tsx`, `use-invoices.ts`               | T-14-03 | borrador corregido con su evento en el histórico         | M     | ⏳     |

**Gate de salida E14:** el cargo está descrito en un solo documento, protegido por pruebas, y la cuenta
`test-manager@test.local` ejecuta todas sus actuaciones sin `403` y ninguna de las prohibidas. Detalle
en [`S-14` §4](./specs/S-14-actuaciones-rol-manager.md).

---

## 1.12 Épica E15 · Tasa oficial automática (BCV) — [`S-15`](./specs/S-15-sincronizacion-tasa-bcv.md)

> **Origen:** revisión del 2026-10-31. `S-08` prometía "obtención automática diaria (BCV)" pero el
> parser devolvía `6` (el `6` de `class="col-sm-6"`), leía la portada en vez de la página de tipo de
> cambio, y desde el contenedor `fetch` fallaba porque BCV no envía el certificado intermedio de su
> cadena TLS.

| ID      | Tarea                                                                       | Artefactos                                            | Depende | Verificación                                        | Talla | Estado |
| ------- | --------------------------------------------------------------------------- | ----------------------------------------------------- | ------- | --------------------------------------------------- | ----- | ------ |
| T-15-01 | Parser acotado al bloque `id="dolar"` en vez del primer número de la página | `exchange-rate.service.ts`                            | —       | fixture real → `889,5754`, nunca `6`                | S     | ✅     |
| T-15-02 | `BCV_API_URL` a la página de tipo de cambio oficial                         | `.env.example`, `docker-compose.yml`, servicio        | —       | la URL se lee de configuración                      | S     | ✅     |
| T-15-03 | Completar la cadena TLS por AIA sin desactivar la verificación              | `exchange-rate.service.ts` (`node:tls`, `node:https`) | T-15-01 | desde el contenedor la página responde `200`        | M     | ✅     |
| T-15-04 | Sincronización idempotente (`stored`/`unchanged`/`manual-override`)         | `syncFromBcv`, `SyncResultDto`                        | T-15-03 | dos corridas no duplican fila                       | S     | ✅     |
| T-15-05 | Guarda de variación con antigüedad y override manual exento                 | `assertSaneVariation`, `store`                        | T-15-04 | tasa de 96 h no se compara; manual con motivo entra | S     | ✅     |
| T-15-06 | Cron 09:00 y 17:00 (L-V) con interruptor y logs                             | `cron.service.ts`                                     | T-15-04 | log de arranque + `stored · 889.5754`               | S     | ✅     |
| T-15-07 | Estado de la sincronización en la respuesta y en la UI                      | `currencies.controller.ts`, `currencies-view.tsx`     | T-15-04 | toast distinto por estado                           | S     | ✅     |
| T-15-08 | Pruebas del parser, la sincronización y el cron                             | `*.test.ts`                                           | T-15-05 | 24 + 3 + 2 casos                                    | M     | ✅     |
| T-15-10 | La moneda funcional no admite tasa y desaparece de `rates/latest`           | `exchange-rate.service.ts`, `currencies.service.ts`   | T-15-05 | `400` al intentar fijarla; la UI muestra 1,00       | S     | ✅     |
| T-15-11 | `/health/rates` informa la tasa de la moneda de referencia (USD)            | `rate-health.controller.ts`, `lib/rates.ts`           | T-15-10 | el badge deja de decir "VES 36,50"                  | S     | ✅     |
| T-15-12 | Migración `0024` que purga tasas de la moneda funcional                     | `drizzle/0024_purge_base_currency_rates.sql`          | T-15-10 | 3 filas viejas eliminadas en dev                    | S     | ✅     |
| T-15-13 | CxP paga con la tasa de la moneda de la factura                             | `payables-view.tsx`                                   | T-15-11 | diálogo: `USD 1.040,00 · Bs.S 925.158,42`           | S     | ✅     |
| T-15-14 | El pedido resuelve la tasa vigente cuando no se le envía                    | `orders.service.ts`                                   | T-15-10 | pedido USD guarda `889.5754`, VES guarda `1`        | S     | ✅     |
| T-15-15 | Semillas coherentes (VES funcional, tasa del USD)                           | `seed-test.ts`, `seed-faker.ts`                       | T-15-12 | la base de test ya no tiene la fila de VES          | S     | ✅     |

**Gate de salida E15:** el cron trae la tasa publicada por BCV sin intervención humana, no duplica
filas, respeta el override manual del día y no relaja la verificación TLS. Detalle en
[`S-15` §2](./specs/S-15-sincronizacion-tasa-bcv.md).

---

## 1.13 Épica E16 · Integridad de semillas y flujos — [`S-16`](./specs/S-16-integridad-seeds.md)

> **Origen:** revisión del 2026-10-31 sobre el volumen real de datos. El escaneo de huérfanos
> encontró diez relaciones rotas (productos, facturas, pagos, cuentas y tasas apuntando a monedas,
> bancos o usuarios inexistentes) porque las tablas de documentos no tienen FK y las semillas mezclaban
> ids fijos con `upserts` por código. El barrido visual de los cinco roles destapó además 15 defectos
> de UI/contrato en los flujos de punta a punta.

| ID      | Tarea                                                                                           | Artefactos                                                    | Depende | Verificación                                                      | Talla | Estado |
| ------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------- | ----------------------------------------------------------------- | ----- | ------ |
| T-16-01 | Gate de integridad con 44 reglas SQL y reporte por módulo                                       | `seed-integrity.ts`                                           | —       | `db:verify` → `Integridad OK: 44 reglas`                          | M     | ✅     |
| T-16-02 | Enganchar el gate a la semilla, al comando manual y a CI                                        | `seed-test.ts`, `db:verify`, `tests/integration/seed.test.ts` | T-16-01 | la semilla falla si deja huérfanos; el test siembra 2 veces       | S     | ✅     |
| T-16-03 | Resolver ids de moneda y banco por código tras el upsert                                        | `seed-test.ts`                                                | T-16-01 | 0 huérfanos en `products.currency_id` y `bank_accounts.bank_id`   | M     | ✅     |
| T-16-04 | Convertir los upserts no-op a `excluded.*`                                                      | `seed-test.ts`                                                | T-16-01 | volver a sembrar actualiza de verdad los maestros                 | M     | ✅     |
| T-16-05 | Sembrar compras, nota de crédito, préstamo y movimientos de inventario                          | `seed-test.ts`                                                | T-16-03 | Compras y CxP dejan de estar vacías en un entorno recién sembrado | M     | ✅     |
| T-16-06 | Ajustes legales de retención (IVA 75/100 %, ISLR 1 %) + comprobantes y líneas                   | `seedPurchaseRetentions`                                      | T-16-05 | TXT/XML del SENIAT con importes reales                            | M     | ✅     |
| T-16-07 | `reset.ts` borra también el esquema `drizzle`                                                   | `reset.ts`                                                    | —       | `db:reset` + `migrate` deja la base migrada y sembrada            | S     | ✅     |
| T-16-08 | Migración `0025` con índice único en `inventory_moves.code`                                     | `drizzle/0025_inventory_move_code_unique.sql`                 | —       | la regla de integridad pasa                                       | S     | ✅     |
| T-16-09 | Permiso propio de CxP (`finance:payables:view`) y `@RequirePermissions`                         | `seed-rbac.ts`, `permissions.ts`, `billing.controller.ts`     | —       | el vendedor ya no entra a Cuentas por pagar                       | S     | ✅     |
| T-16-10 | MANAGER ve la retención en la ficha de la compra que paga (el libro fiscal sigue en ACCOUNTANT) | `invoice-detail-view.tsx` (sección Retenciones)               | T-16-09 | la ficha muestra el comprobante sin abrir `/finance/retentions`   | S     | ✅     |
| T-16-11 | Diálogo de cobro/pago compartido entre CxC y CxP                                                | `payment-dialog.tsx`, `invoice-detail-view.tsx`               | —       | factura emitida → "Registrar cobro" → PAY, estado `Pagada`        | M     | ✅     |
| T-16-12 | Eventos `PAYMENT_REGISTERED`/`PAYMENT_VOIDED` en el histórico                                   | `document-events.service.ts`, `treasury.service.ts`           | T-16-11 | la ficha muestra los 5 hitos del flujo                            | M     | ✅     |
| T-16-13 | KPI de facturación por tipo de documento                                                        | `billing.service.ts`, `use-invoices.ts`                       | —       | ventas: 3 emitidas / Bs.S 61.393,00 sin sumar compras             | S     | ✅     |
| T-16-14 | Tesorería: saldo en moneda funcional y datos de la cuenta                                       | `treasury.service.ts`, `treasury-view.tsx`                    | —       | `Saldo total (VES) Bs.S 60.225,00 · Banco Provincial · USD`       | S     | ✅     |
| T-16-15 | Correlativo de pagos con ancho único                                                            | `treasury.service.ts`                                         | —       | `PAY-000006` y no `PAY-00005`                                     | S     | ✅     |
| T-16-16 | Base/IVA del comprobante en la moneda del documento                                             | `retentions-view.tsx`                                         | T-16-06 | fila USD: base en USD, retenido en Bs.S                           | S     | ✅     |

**Gate de salida E16:** la base de desarrollo y la de CI se siembran y quedan coherentes (44 reglas),
los cinco roles recorren sus pantallas sin errores de consola ni `NaN`, y los flujos venta y compra
llegan hasta el cobro/pago con su comprobante y su histórico completo. Detalle en
[`S-16`](./specs/S-16-integridad-seeds.md).

---

## 1.14 Épica E17 · Integridad referencial (FK reales) — [`S-17`](./specs/S-17-integridad-referencial.md)

> **Origen:** `S-16` dejó anotado el riesgo estructural: las tablas de documentos se crearon sin FK y
> el gate de semillas sólo detectaba los huérfanos después. La auditoría encontró diez relaciones
> rotas que la base aceptaba sin protestar.

| ID      | Tarea                                                                                     | Artefactos                                                    | Depende | Verificación                                                     | Talla | Estado |
| ------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------- | ---------------------------------------------------------------- | ----- | ------ |
| T-17-01 | Migración `0026` con las FK del núcleo y semántica de borrado                             | `drizzle/0026_foreign_keys_core.sql`                          | —       | 148 FK creadas y `convalidated`                                  | L     | ✅     |
| T-17-02 | Declarar las mismas relaciones en el esquema de Drizzle                                   | `schema.ts` (`.references(...)`, `AnyPgColumn` en los ciclos) | T-17-01 | `typecheck` OK; el modelo describe la base                       | M     | ✅     |
| T-17-03 | Limpieza de vínculos opcionales antes de declarar la FK                                   | bloque de `UPDATE` de la migración                            | T-17-01 | una base con residuos migra; los obligatorios fallan a propósito | S     | ✅     |
| T-17-04 | Reglas del gate: columna de referencia sin FK, FK sin validar, huérfanos y saldo negativo | `seed-integrity.ts` (48 reglas)                               | T-17-01 | `db-setup` → `Integridad OK: 48 reglas`                          | S     | ✅     |
| T-17-05 | Recrear la base de prueba si la migración no valida residuos                              | `prepare-test-databases.ts`                                   | T-17-01 | `test:db:prepare` migra o recrea y sigue                         | S     | ✅     |
| T-17-06 | Usuario y empleado reales en las pruebas que registran autor                              | `factories.ts` (`ensureTestUser`), 5 archivos de prueba       | T-17-01 | backend 1135 pruebas en verde                                    | M     | ✅     |
| T-17-07 | Verificación desde cero (reset + migrate + seed ×2)                                       | —                                                             | T-17-06 | `db:reset` + `db-setup` dos veces sin duplicados                 | S     | ✅     |
| T-17-08 | Semilla: pagos a proveedor reales, imputaciones corregibles y saldo recalculado           | `seed-test.ts` (`recalculateInvoiceBalances`)                 | T-17-04 | ninguna factura queda con saldo negativo ni "pagada" sin pago    | M     | ✅     |

**Gate de salida E17:** cualquier `INSERT` con un padre inexistente falla en la base, borrar un
documento no arrastra maestros, y sembrar desde cero deja la base coherente con las 48 reglas del
gate. Detalle en [`S-17`](./specs/S-17-integridad-referencial.md).

---

## 1.15 Épica E18 · Imputación multimoneda de cobros y pagos — [`S-18`](./specs/S-18-multimoneda-imputacion.md)

> **Origen:** `S-08` congeló la tasa en la factura, pero el cobro seguía derivando el saldo dividiendo
> el importe en moneda funcional entre esa tasa congelada: un cobro a tasa distinta sobre-imputaba la
> factura. Además el pago no llevaba cuenta bancaria, nada impedía cobrar en divisa sobre una cuenta en
> bolívares y la diferencia cambiaria no se registraba en ninguna parte.

| ID      | Tarea                                                                              | Artefactos                                                           | Depende | Verificación                                                                  |
| ------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| T-18-01 | Migración `0027`: `invoice_amount`, `exchange_rate` y `exchange_difference_base`   | `drizzle/0027_payment_allocation_multicurrency.sql`, `schema.ts`     | —       | migración aplicada y `conformed` con las imputaciones previas convertidas     |
| T-18-02 | Cuenta bancaria obligatoria, misma sucursal, activa y de la moneda del pago        | `treasury.service.ts` (`resolveBankAccountForPayment`)               | T-18-01 | pago USD a cuenta VES ⇒ `400`; sin cuenta ⇒ `400`                             |
| T-18-03 | Cálculo bidireccional de la imputación (par o convertida a la tasa del día)        | `treasury.service.ts` (`PaymentAllocationPlan`)                      | T-18-01 | `Σ invoice_amount` = total del documento para cualquier mezcla de monedas     |
| T-18-04 | Diferencia cambiaria guardada por imputación y resumida en `payments.metadata`     | `treasury.service.ts`                                                | T-18-03 | factura USD a tasa 36,50 cobrada a 40 ⇒ diferencia 209,09 por 59,74 imputados |
| T-18-05 | Línea contable de resultado cambiario y asiento automático del pago                | `accounting.service.ts` (`applyMapToPayment`), `treasury.module.ts`  | T-18-04 | asiento cuadrado: débito = crédito + diferencia cambiaria                     |
| T-18-06 | Anulación revierte todas las facturas imputadas y anula el asiento                 | `treasury.service.ts` (`voidPayment`), `cancelEntryBySource`         | T-18-05 | factura vuelve a `POSTED`, banco revertido, asiento `CANCELLED`               |
| T-18-07 | Nota de crédito de venta descuenta el saldo del cliente                            | `invoice-balance.ts`                                                 | T-18-03 | el filtro ya no restringe a `PURCHASE`                                        |
| T-18-08 | Histórico del documento con el cobro en las dos monedas                            | `recordPaymentEvents`                                                | T-18-03 | `Cobro PAY-000006 por 2389.6 VES (59.74 USD) del cliente`                     |
| T-18-09 | Diálogo de cobro/pago que parte de la cuenta y envía `bankAccountId`               | `payment-dialog.tsx`, `invoice-detail-view.tsx`, `payables-view.tsx` | T-18-02 | monto sugerido = saldo × tasa factura / tasa cuenta                           |
| T-18-10 | Semillas: mapeos contables, imputaciones multimoneda y saldos iniciales por cuenta | `seed-test.ts`                                                       | T-18-01 | `current_balance = initial_balance + movimientos POSTED` de su moneda         |
| T-18-11 | Reglas de multimoneda en el gate (52 en total)                                     | `seed-integrity.ts`                                                  | T-18-10 | `db-setup` → `Integridad OK: 52 reglas`                                       |
| T-18-12 | Prueba de certificación con factura en divisa abonada en Bs y en USD               | `treasury-multicurrency.test.ts` + corrida manual contra la API      | T-18-09 | saldo 0,00 · asientos cuadrados · banco sin mezclar monedas                   |

**Gate de salida E18:** ningún cobro o pago puede mover una cuenta de otra moneda; el saldo de la
factura siempre baja en su moneda; la diferencia cambiaria existe en la imputación y en el libro; y
anular revierte documento, banco y asiento. Detalle en [`S-18`](./specs/S-18-multimoneda-imputacion.md).

---

## 1.16 Épica E19 · Asiento fiscal de la factura y banco por cuenta contable — [`S-19`](./specs/S-19-asiento-fiscal-factura.md)

> **Origen:** al certificar `S-18` el libro quedó cuadrado pero incompleto: la factura se contabilizaba
> en dos líneas (total a Clientes contra total a Ingresos, con el IVA y el IGTF como ingreso) y todos
> los cobros entraban a `1.1.1.002` sin distinguir banco.

| ID      | Tarea                                                                   | Artefactos                                                             | Depende | Verificación                                                               |
| ------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| T-19-01 | Asiento de la factura con desglose de base, IVA e IGTF                  | `accounting.service.ts` (`createEntryFromInvoice`)                     | —       | venta: Clientes = Ingresos + IVA débito + IGTF por pagar; cuadrado         |
| T-19-02 | IVA de la compra como crédito fiscal y IGTF al costo                    | `accounting.service.ts`                                                | T-19-01 | compra 1.000 + 160 ⇒ Mercancía 1.000 · IVA crédito 160 · Proveedores 1.160 |
| T-19-03 | Cuenta `2.1.1.007 IGTF por pagar` en el plan base                       | `seed-chart-of-accounts.ts`                                            | T-19-01 | existe y es imputable                                                      |
| T-19-04 | Migración `0028`: `bank_accounts.accounting_account_id` (FK `set null`) | `drizzle/0028_bank_account_ledger.sql`, `schema.ts`                    | —       | columna y FK creadas                                                       |
| T-19-05 | La pata del banco usa la cuenta contable de la cuenta bancaria          | `accounting.service.ts` (`applyMapToPayment`)                          | T-19-04 | cobro a cuenta en divisa ⇒ `1.1.1.003`                                     |
| T-19-06 | Posteo automático al emitir y anulación al anular                       | `billing.service.ts`, `billing.module.ts`                              | T-19-01 | factura emitida tiene asiento; anulada lo deja `CANCELLED`                 |
| T-19-07 | Alta y listado de cuentas bancarias con su cuenta contable              | `treasury.dto.ts`, `treasury.service.ts`, `treasury-operations.dto.ts` | T-19-04 | `POST/GET /v1/treasury/bank-accounts` devuelve y acepta el vínculo         |
| T-19-08 | Columna y selector de cuenta contable en la UI de tesorería             | `treasury-accounts-view.tsx`, `treasury-operations.ts`                 | T-19-07 | sólo ofrece hojas de `1.1.1.*`                                             |
| T-19-09 | Semilla: enlace de las cuatro cuentas bancarias con el plan             | `seed-test.ts` (`linkBankAccountsToLedger`)                            | T-19-03 | USD → `1.1.1.003` · VES → `1.1.1.002`                                      |
| T-19-10 | Tres reglas nuevas del gate (55 en total)                               | `seed-integrity.ts`                                                    | T-19-09 | `db-setup` → `Integridad OK: 55 reglas`                                    |
| T-19-11 | Pruebas del asiento fiscal y del banco por cuenta                       | `accounting-fiscal-entry.test.ts`                                      | T-19-06 | backend 1144 pruebas en verde                                              |

**Gate de salida E19:** ninguna factura emitida lleva IVA ni IGTF a ingresos, cada cuenta bancaria
tiene su hoja del plan y el mayor permite conciliar banco por banco. Detalle en
[`S-19`](./specs/S-19-asiento-fiscal-factura.md).

---

## 1.17 Épica E20 · Maestros de bancos y conceptos de impuesto en la UI — [`S-20`](./specs/S-20-maestros-bancos-impuestos-ui.md)

> **Origen:** dos rutas de Configuración mostraban el cartel de módulo pendiente aunque el backend
> estaba terminado. Nadie podía dar de alta un banco ni un concepto de retención, y el maestro de
> conceptos estaba vacío en la base.

| ID      | Tarea                                                              | Artefactos                                                 | Depende | Verificación                                  |
| ------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | ------- | --------------------------------------------- |
| T-20-01 | Cliente de API de bancos y de conceptos con su contrato            | `modules/settings/banks/api.ts`, `.../tax-concepts/api.ts` | —       | pruebas de contrato de rutas y cuerpos        |
| T-20-02 | Pantalla de bancos: listado, búsqueda, alta/edición y activación   | `banks-view.tsx`, `settings/banks/page.tsx`                | T-20-01 | 3 bancos visibles; toggle y diálogo funcionan |
| T-20-03 | Pantalla de conceptos: listado con porcentaje/base/sustraendo      | `tax-concepts-view.tsx`, `settings/tax-concepts/page.tsx`  | T-20-01 | alta y borrado desde la UI verificados        |
| T-20-04 | Concepto de ISLR en la ficha del partner                           | `partner-dialog.tsx`, `partner.schema.ts`                  | T-20-03 | el proveedor muestra `ISLR-SER`               |
| T-20-05 | Semilla de los conceptos del Art. 79 y clasificación del proveedor | `seed-test.ts` (`seedTaxConcepts`)                         | T-20-03 | 6 conceptos, sin duplicar al resembrar        |

**Gate de salida E20:** ninguna ruta del menú de Configuración queda en stub y cada maestro se puede
administrar de punta a punta desde la aplicación. Detalle en
[`S-20`](./specs/S-20-maestros-bancos-impuestos-ui.md).

---

## 1.18 Épica E21 · Regla de retención de ISLR unificada — [`S-21`](./specs/S-21-regla-retencion-islr.md)

> **Origen:** `S-20` dejó el catálogo de conceptos administrable, pero al revisar el cálculo se vio que
> el concepto **no se usaba**: el ISLR salía siempre de los parámetros de la empresa, la tasa del
> proveedor era decorativa y la línea del comprobante guardaba `concept_id = null`.

| ID      | Tarea                                                                  | Artefactos                                                              | Depende | Verificación                                          |
| ------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- | ----------------------------------------------------- |
| T-21-01 | Resolver la regla de ISLR con precedencia concepto → tasa → empresa    | `supplier-retention.service.ts` (`resolveIslrRule`)                     | —       | empresa 2 % + concepto 1 % ⇒ retiene 1 %              |
| T-21-02 | Migración `0029`: `applied_rate` y `rule_source` en `tax_retentions`   | `drizzle/0029_retention_rule_source.sql`, `schema.ts`                   | —       | columnas creadas y migradas en dev y test             |
| T-21-03 | El comprobante y su línea registran la regla y el concepto             | `upsertRetention`                                                       | T-21-02 | línea con `ISLR-SER`; voucher con `applied_rate` 1,00 |
| T-21-04 | `RetentionResult` expone tasa, origen y concepto                       | `supplier-retention.service.ts`                                         | T-21-01 | el llamador ve `islrRuleSource: CONCEPT`              |
| T-21-05 | Semilla con la misma precedencia y arreglo de comprobantes heredados   | `seed-test.ts` (`seedPurchaseRetentions`)                               | T-21-03 | sembrar dos veces no duplica y completa filas viejas  |
| T-21-06 | Dos reglas nuevas del gate (57 en total)                               | `seed-integrity.ts`                                                     | T-21-05 | `db-setup` → `Integridad OK: 57 reglas`               |
| T-21-07 | Pantalla de parámetros de retención con la precedencia explicada       | `retention-settings-view.tsx`, `lib/navigation.ts`, `lib/breadcrumb.ts` | T-21-01 | guardar 1,5 % y restaurar 1 % desde la UI             |
| T-21-08 | Pruebas de la regla (concepto, tasa propia, empresa, concepto apagado) | `supplier-retention-rule.test.ts`                                       | T-21-04 | backend 1150 pruebas en verde                         |

**Gate de salida E21:** un comprobante de retención siempre se puede explicar —qué porcentaje se aplicó
y de dónde salió— y el catálogo de conceptos manda de verdad en el cálculo. Detalle en
[`S-21`](./specs/S-21-regla-retencion-islr.md).

---

## 1.19 Épica E22 · Sustraendo de ISLR en unidades tributarias — [`S-22`](./specs/S-22-sustraendo-unidad-tributaria.md)

> **Origen:** con `S-21` el concepto ya mandaba en la retención, pero el sustraendo sólo se podía
> expresar en bolívares. La ley lo expresa en UT y el valor de la UT cambia por providencia, así que
> había que convertirlo a mano cada vez.

| ID      | Tarea                                                                | Artefactos                                                       | Depende | Verificación                                         |
| ------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ------- | ---------------------------------------------------- |
| T-22-01 | Migración `0030`: tabla `tax_units` y `tax_concepts.sustraendo_unit` | `drizzle/0030_tax_unit.sql`, `schema.ts`                         | —       | columnas y tabla creadas                             |
| T-22-02 | Resolver la UT vigente a una fecha                                   | `supplier-retention.service.ts` (`resolveUnitValue`)             | T-22-01 | devuelve 1.000 en 2025 y 2.000 en 2026 con dos filas |
| T-22-03 | Convertir el sustraendo en UT al retener                             | `resolveIslrRule`                                                | T-22-02 | 0,10 UT × 43 Bs ⇒ resta 4,30                         |
| T-22-04 | API y semilla del campo `sustraendoUnit`                             | `tax-concepts.dto.ts`, `tax-concepts.service.ts`, `seed-test.ts` | T-22-01 | concepto guardado en UT y devuelto igual             |
| T-22-05 | Semilla del valor de la UT con su vigencia                           | `seed-test.ts` (`seedTaxUnit`)                                   | T-22-01 | UT 43 Bs desde 02/06/2025, sin duplicar              |
| T-22-06 | Dos reglas nuevas del gate (59 en total)                             | `seed-integrity.ts`                                              | T-22-05 | `db-setup` → `Integridad OK: 59 reglas`              |
| T-22-07 | Selector Bs/UT en el maestro de conceptos                            | `tax-concepts-view.tsx`, `.../api.ts`                            | T-22-04 | cambiar a UT y ver `0,5 UT` en el listado            |

**Gate de salida E22:** un concepto puede declarar su sustraendo en la unidad que usa la ley y el
cálculo lo convierte con la UT vigente al documento. Detalle en
[`S-22`](./specs/S-22-sustraendo-unidad-tributaria.md).

---

## 1.20 Épica E23 · Alta de movimientos de inventario — [`S-23`](./specs/S-23-movimientos-inventario.md)

> **Origen:** la pantalla de movimientos sólo listaba, aprobaba y rechazaba. El `POST` existía pero no
> había formulario; el cliente enviaba un vocabulario que el API no acepta; el tipo **Ajuste** que la UI
> ofrecía no existía en el backend; y cancelar un borrador fallaba porque `reject` exige motivo.

| ID      | Tarea                                                              | Artefactos                                 | Depende | Verificación                                                     |
| ------- | ------------------------------------------------------------------ | ------------------------------------------ | ------- | ---------------------------------------------------------------- |
| T-23-01 | Soporte de `AJUSTE` en el DTO y en la aprobación (stock = contado) | `inventory.dto.ts`, `inventory.service.ts` | —       | ajuste a 20 deja 20; ajuste a 0 deja 0                           |
| T-23-02 | `currentStock()` reutilizable para el ajuste y la UI               | `inventory.service.ts`                     | T-23-01 | delta correcto al subir y al bajar                               |
| T-23-03 | Validación de líneas obligatorias y almacén por tipo               | `inventory.service.ts`                     | T-23-01 | `400` con mensaje claro en ambos casos                           |
| T-23-04 | Cliente con mapeo de vocabulario y almacenes por tipo              | `api/moves.ts`, `hooks/use-moves.ts`       | T-23-01 | el formulario crea en vez de responder `400 type must be one of` |
| T-23-05 | Cancelar un borrador enviando motivo                               | `api/moves.ts`                             | T-23-04 | `POST /reject` con `reason`                                      |
| T-23-06 | Formulario de alta con líneas de producto                          | `move-form-dialog.tsx`, `moves-view.tsx`   | T-23-04 | alta de entrada verificada en el navegador                       |
| T-23-07 | Semilla con los cuatro tipos y un borrador                         | `seed-test.ts` (`seedInventoryMoves`)      | —       | tarjetas 2/2/1/1 en la pantalla                                  |
| T-23-08 | Pruebas del efecto de cada tipo sobre el stock                     | `inventory-moves.test.ts`                  | T-23-01 | backend 1162 pruebas en verde                                    |

**Gate de salida E23:** cualquier movimiento de inventario se puede crear desde la aplicación, nace en
borrador y su efecto sobre el stock es el esperado para los cuatro tipos. Detalle en
[`S-23`](./specs/S-23-movimientos-inventario.md).

---

## 1.21 Épica E24 · Controles de inventario: lotes, costo promedio y aprobación en lote — [`S-25`](./specs/S-25-controles-inventario.md)

> **Origen:** el WAREHOUSE podía crear y aprobar sus propios ajustes, los lotes existían en el esquema
> pero nadie los creaba ni los consultaba, y `add_stock` recibía el costo de la entrada y lo descartaba.
> La recomendación de retirar el permiso de aprobación se **descartó**: el almacén es maestro de su rol.
> El control se ejerce como en SAP: motivo obligatorio y tolerancia con escalamiento.

| ID      | Tarea                                                                      | Artefactos                                                         | Depende | Verificación                                              |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------- | --------------------------------------------------------- |
| T-25-01 | Migración `0031`: `reason_code`, `requires_second_approval`, único de lote | `0031_inventory_adjustment_controls.sql`, `schema.ts`              | —       | migración aplicada en dev y en la base de pruebas         |
| T-25-02 | Catálogo de motivos y validación del ajuste                                | `inventory.service.ts`, `inventory.dto.ts`                         | T-25-01 | `400` sin motivo y con motivo inexistente                 |
| T-25-03 | Tolerancia configurable y marca de segunda aprobación                      | `inventory.service.ts`                                             | T-25-02 | 5 % no escala; 50 % escala                                |
| T-25-04 | Bloqueo de autoaprobación del ajuste escalado                              | `inventory.service.ts`                                             | T-25-03 | `403` al creador, `200` al gerente                        |
| T-25-05 | Aprobación en lote con resultado por documento                             | `inventory.controller.ts`, `inventory.service.ts`                  | T-25-04 | `{ approved, failed }` sin revertir los válidos           |
| T-25-06 | Lotes: alta en la recepción, consulta FEFO y alta manual                   | `inventory.service.ts`, `inventory.controller.ts`                  | T-25-01 | lote creado por número; salida con lote inexistente `400` |
| T-25-07 | Costo promedio móvil en el maestro de material                             | `inventory.service.ts`                                             | T-25-06 | 10@100 + 10@200 → 150; la salida no lo cambia             |
| T-25-08 | Consecutivo de movimiento tolerante a concurrencia                         | `inventory.service.ts`                                             | —       | dos altas simultáneas no devuelven 500                    |
| T-25-09 | UI: motivo, selector FEFO, selección múltiple y costo/valor en stock       | `move-form-dialog.tsx`, `moves-view.tsx`, `stock-view.tsx`, `api/` | T-25-06 | alta de ajuste y aprobación en lote desde el navegador    |
| T-25-10 | Semilla con producto por lotes, ajuste escalado y entrada con lote         | `seed-test.ts`                                                     | T-25-06 | producto con dos lotes y existencia repartida             |
| T-25-11 | Gate de integridad a 62 reglas                                             | `seed-integrity.ts`                                                | T-25-10 | `db:verify` 62/62 tras `db:reset`                         |
| T-25-12 | Pruebas de controles, lotes, costo y lote de aprobación                    | `inventory-controls.test.ts`, `inventory-moves.test.ts`            | T-25-01 | suites en verde                                           |

**Gate de salida E24:** un ajuste no se registra sin motivo; el faltante material necesita dos firmas sin
quitarle el permiso al almacén; los productos con lotes se reciben, se consultan por FEFO y se valoran al
costo promedio móvil. Detalle en [`S-25`](./specs/S-25-controles-inventario.md).

---

## 1.22 Épica E25 · Despacho por lote: vencimiento y excepción FEFO — [`S-26`](./specs/S-26-despacho-por-lote.md)

> **Origen:** `S-25` dejó el FEFO como sugerencia y permitía despachar un lote vencido, uno bloqueado o
> ninguno (producto con lotes, línea sin lote). El vencimiento es un control de calidad y la rotación es
> una regla, no una preferencia: ambas se validan al crear el documento.

| ID      | Tarea                                                            | Artefactos                                                     | Depende | Verificación                                                         |
| ------- | ---------------------------------------------------------------- | -------------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| T-26-01 | Migración `0032`: `fefo_override` y su motivo                    | `0032_inventory_batch_dispatch.sql`, `schema.ts`               | —       | migración aplicada en dev y en la base de pruebas                    |
| T-26-02 | Exigir lote en toda salida de un producto con lotes              | `inventory.service.ts`                                         | T-26-01 | `400` sin lote                                                       |
| T-26-03 | Rechazar lote bloqueado y lote vencido (comparación por día)     | `inventory.service.ts`                                         | T-26-02 | `400` bloqueado / vencido; vence hoy sí pasa                         |
| T-26-04 | Sugerencia FEFO que ignora vencidos y bloqueados                 | `inventory.service.ts`                                         | T-26-03 | el sugerido es el primer lote utilizable                             |
| T-26-05 | Excepción FEFO con motivo obligatorio y auditoría                | `inventory.service.ts`, `inventory.dto.ts`                     | T-26-04 | `400` sin motivo; `201` y motivo guardado con él                     |
| T-26-06 | Estado del lote (`isActive`, `expired`) en el catálogo de lotes  | `inventory.service.ts`, `inventory.dto.ts`                     | T-26-03 | el API expone ambos campos                                           |
| T-26-07 | UI: opciones deshabilitadas y motivo en el formulario            | `move-form-dialog.tsx`, `api/moves.ts`                         | T-26-06 | no se puede elegir un vencido; el botón espera el motivo             |
| T-26-08 | Distintivo «Fuera de FEFO» en el listado                         | `moves-view.tsx`                                               | T-26-05 | se ve en los movimientos con excepción                               |
| T-26-09 | Semilla con lote vencido, lote bloqueado y salida con excepción  | `seed-test.ts`                                                 | T-26-01 | 4 lotes y `MOV-000009` con su motivo                                 |
| T-26-10 | Gate de integridad a 66 reglas                                   | `seed-integrity.ts`                                            | T-26-09 | `db:verify` 66/66 tras `db:reset`                                    |
| T-26-11 | Pruebas del despacho por lote                                    | `inventory-batch-dispatch.test.ts`                             | T-26-03 | 9 pruebas en verde                                                   |
| T-26-12 | Migración `0033` y reserva de lote por salida                    | `0033_inventory_batch_reservations.sql`, `schema.ts`           | T-26-01 | tabla e índice creados; reserva activa por línea                     |
| T-26-13 | Reserva transaccional: candado por lote, validación y liberación | `inventory.service.ts`                                         | T-26-12 | dos salidas no prometen la misma existencia; aprobar/rechazar libera |
| T-26-14 | Job diario de bloqueo de lotes vencidos                          | `cron.service.ts`, `cron.module.ts`                            | T-26-03 | 00:05 America/Caracas; idempotente; vence hoy no se bloquea          |
| T-26-15 | Pruebas de reserva y bloqueo automático                          | `inventory-batch-reservations.test.ts`, `cron.service.test.ts` | T-26-13 | 9 pruebas nuevas en verde                                            |

**Gate de salida E25:** no sale mercancía vencida ni de un lote bloqueado, ningún producto con lotes sale
sin lote, toda excepción a la rotación FEFO queda registrada con su motivo, dos salidas simultáneas no
prometen el mismo lote y el vencido se bloquea solo. Detalle en
[`S-26`](./specs/S-26-despacho-por-lote.md).

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

| ID      | Tarea                                                   | Artefactos                                       | Depende | Verificación                                               | Talla | Estado |
| ------- | ------------------------------------------------------- | ------------------------------------------------ | ------- | ---------------------------------------------------------- | ----- | ------ |
| T-07-01 | `GET /v1/audit` paginado con filtros + índice           | `modules/audit/*` + índice                       | E0      | filtros por entidad, usuario y fecha                       | M     | ✅     |
| T-07-02 | Módulo y pantalla de notas de crédito                   | `modules/credit-notes/*`, `finance/credit-notes` | E4      | NC aplicada descuenta saldo                                | L     | ✅     |
| T-07-03 | Módulo y pantalla de préstamos                          | `modules/loans/*`, `finance/loans`               | E5      | devolución total cierra (PAID + `returnDate`); parcial no  | L     | ✅     |
| T-07-04 | Visor de auditoría con diff legible                     | `settings/audit`                                 | T-07-01 | "campo: antes → después"                                   | M     | ✅     |
| T-07-05 | Home del dashboard con KPIs, gráfico y actividad reales | `app/(dashboard)/dashboard/page.tsx`             | E0, BI  | 4 KPIs por sucursal                                        | M     | ✅     |
| T-07-06 | Pantalla de stock por almacén con alertas de mínimo     | `inventory/stock`                                | E1      | lista bajo mínimo                                          | M     | ✅     |
| T-07-07 | Navegación y permisos de UI sincronizados               | `lib/navigation.ts`, `lib/permissions.ts`        | todas   | cada módulo visible solo con permiso                       | S     | ✅     |
| T-07-08 | Auditoría legible: autor, módulo, etiquetas y resultado | `common/audit/*`, `0036_audit_detail.sql`        | T-07-04 | fila guarda `actorName`, `module`, `actionLabel`, `result` | M     | ✅     |
| T-07-09 | `before`/`after` real leído de la tabla                 | `audit-write.interceptor.ts`                     | T-07-08 | `PATCH` deja `changedFields` y omite el no-op              | M     | ✅     |
| T-07-10 | Auditoría de seguridad: login y `403`                   | `auth.controller.ts`, `permissions.guard.ts`     | T-07-08 | login fallido deja `LOGIN_FAILED` + `DENIED`               | S     | ✅     |
| T-07-11 | Búsqueda libre (`q`), facetas con conteo y export CSV   | `modules/audit/*`, `0037_audit_permissions.sql`  | T-07-09 | `GET /audit?q=` y `/audit/facets` con conteos              | M     | ✅     |
| T-07-12 | Visor con filtros en la URL y ficha de detalle          | `modules/audit/components/*`                     | T-07-11 | recargar la página conserva la búsqueda                    | M     | ✅     |
| T-07-13 | Permisos propios `settings:audit:view` / `:export`      | `seed-rbac.ts`, `lib/permissions.ts`             | T-07-11 | ADMIN exporta; MANAGER sólo consulta                       | S     | ✅     |

---

## 9. Tareas transversales (aplican a toda épica)

| ID    | Tarea                                                           | Cuándo            | Verificación                                      | Estado |
| ----- | --------------------------------------------------------------- | ----------------- | ------------------------------------------------- | ------ |
| TX-01 | Un PR por frente, con la spec enlazada y evidencia de ejecución | siempre           | revisión                                          | ✅     |
| TX-02 | `pnpm openapi:export` + `pnpm sync:types` tras cambiar un DTO   | siempre           | `shared-types` sin diff manual                    | ✅     |
| TX-03 | Permisos nuevos en `seed-rbac.ts` **y** `lib/permissions.ts`    | al crear permisos | seed idempotente                                  | ✅     |
| TX-04 | Actualizar `docs/API-CONTRACTS.md` y `09-BITACORA.md`           | al cerrar cada PR | bitácora con BT nuevo                             | ✅     |
| TX-05 | Gate completo antes de merge                                    | al cerrar cada PR | lint · typecheck · build · coverage · e2e · audit | ✅     |
| TX-06 | Rollback descrito (migración reversible o feature flag)         | en cada migración | sección de rollback en el PR                      | ✅     |

---

## 10. Secuencia y registro de avance

> **El número de la épica identifica la spec, no el orden de ejecución.** La secuencia acordada el
> 2026-10-26 adelanta la obligación fiscal (E6) antes de compras/CxP (E3) y de tesorería (E5), e
> incorpora multimoneda (E8) antes de contabilidad porque el libro debe nacer con moneda funcional.

| Ola | Semanas | Épica / tareas                         | Tareas  | Hechas  |
| --- | ------- | -------------------------------------- | ------- | ------- |
| 1   | 1-2     | E0 sucursal (T-00-01 … T-00-13)        | 13      | 13      |
| 2   | 3-4     | **E8 multimoneda (T-08-01 … T-08-13)** | 13      | 13      |
| 3   | 5       | E1 frentes A, B y C                    | 17      | 17      |
| 4   | 6-7     | E2 nómina                              | 11      | 11      |
| 5   | 8-9     | E4 contabilidad                        | 9       | 9       |
| 6   | 10-11   | E6 reportes fiscales                   | 6       | 6       |
| 7   | 12-13   | E3 compras y CxP                       | 9       | 9       |
| 8   | 14-15   | E5 tesorería                           | 9       | 9       |
| 9   | 16      | E7 frontend restante                   | 7       | 7       |
| —   | —       | Transversales                          | 6       | 6       |
| —   | —       | **Total**                              | **100** | **100** |

> **Las 100 tareas del WBS están cerradas.** Lo que queda abierto son los parámetros legales y de
> negocio de `⚠️ P-28` (alícuotas, cestaticket, tramos de ISLR), que necesitan decisión del cliente y
> no código.

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
