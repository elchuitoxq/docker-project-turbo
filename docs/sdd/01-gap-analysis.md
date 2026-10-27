# 01 — Análisis de brechas

> **Método:** inventario de controladores (`@Controller`/`@Get|@Post|@Patch|@Delete`), de rutas
> (`app/**/page.tsx`) y de llamadas del cliente (`apiClient.*`) en `apps/frontend/modules`, más
> contraste con `docs/API-CONTRACTS.md`, `docs/PROJECT-STATUS.md` y `docs/PLANNING.md`.
> **Fecha:** 2026-10-26.

## Leyenda

| Símbolo | Significado                                               |
| ------- | --------------------------------------------------------- |
| ✅      | Backend y frontend alineados y funcionales                |
| 🟡      | Existe backend, UI incompleta o parcial                   |
| 🔴      | **Roto**: el frontend llama algo que el backend no expone |
| ⚪      | Existe backend sin ninguna UI                             |
| ⛔      | No existe en ninguna capa                                 |

---

## 1. Matriz por módulo

| #   | Módulo                  | Backend                                                                                         | Frontend                                           | Estado | Brecha principal                                                                                                                     |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `auth`                  | login, me, logout, forgot, reset, cookie httpOnly                                               | login + reset                                      | ✅     | —                                                                                                                                    |
| 2   | `users`                 | CRUD + roles + branches + `me/profile`                                                          | `settings/users`                                   | ✅     | —                                                                                                                                    |
| 3   | `roles`                 | CRUD + catálogo de permisos                                                                     | `settings/roles`                                   | ✅     | —                                                                                                                                    |
| 4   | `branches`              | companies + branches (CRUD, desactivar)                                                         | `settings/branches`                                | ✅     | —                                                                                                                                    |
| 5   | `partners`              | CRUD + stats; `DELETE` es un **falso borrado**                                                  | `operations/partners` + estado de cuenta           | 🟡     | `DELETE` solo toca `isSpecialTaxpayer` (`API-CONTRACTS.md` L48-56)                                                                   |
| 6   | `products`              | CRUD + categorías                                                                               | `inventory/products`                               | 🔴     | Front llama `/product-categories`; API expone `/products/categories`                                                                 |
| 7   | `inventory`             | almacenes, stock, movimientos, approve/reject                                                   | `inventory/{products,warehouses,moves}`            | 🔴     | Front usa prefijo `/warehouses` (sin `/inventory`) y `moves/:id/cancel` (API tiene `reject`); sin UI de stock ni de `DELETE` almacén |
| 8   | `orders`                | listado, detalle, confirm, cancel, invoice, stats                                               | `operations/orders` (solo lectura)                 | 🟡     | Sin acciones de confirmar/cancelar/facturar en UI; `orders/api.ts` pega a `/billing/invoices`                                        |
| 9   | `billing`               | invoices CRUD, post, void, stats, fiscal-json                                                   | `finance/invoices`, `operations/{sales,purchases}` | 🔴     | Update con `POST` (API: `PATCH`); filtro `type` y paginación inexistentes en API                                                     |
| 10  | `credit-notes`          | 5 endpoints (post, void, apply)                                                                 | —                                                  | ⚪     | Sin UI                                                                                                                               |
| 11  | `treasury`              | payments CRUD/void, methods, bank-accounts, statements, daily-close, available-credit-notes     | `finance/treasury`, `finance/daily-close`          | 🔴     | `daily-close` con fecha, `close` y `reopen` no existen en API                                                                        |
| 12  | `reports` (fiscal)      | summary, libro-ventas, libro-compras, retenciones TXT/XML                                       | `finance/reports`, `finance/retentions`            | 🔴     | UI llama `balance-sheet` e `income-statement`, que **no existen**                                                                    |
| 13  | `hr`                    | employees, departments, positions, payroll (generate/process/payslip), incidents, concept-types | `hr/*` (5 pantallas)                               | 🔴     | **8 endpoints** que la UI espera no existen (ver §2.1)                                                                               |
| 14  | `accounting`            | accounts CRUD, entries CRUD, mapeos, asientos desde factura/pago                                | —                                                  | ⚪     | Sin UI ni cierre contable                                                                                                            |
| 15  | `loans`                 | listado, detalle, approve, reject, pay                                                          | —                                                  | ⚪     | Sin UI                                                                                                                               |
| 16  | `audit`                 | `GET /audit/:entityTable/:entityId`                                                             | —                                                  | ⚪     | Sin UI ni endpoint de listado/búsqueda                                                                                               |
| 17  | `bi`                    | kpis, chart, activity                                                                           | `dashboard/bi`                                     | ✅     | El **home** del dashboard es un stub                                                                                                 |
| 18  | `settings/currencies`   | tasas (`latest`, historial)                                                                     | `settings/currencies`                              | 🟡     | Tasa sin actualización automática ni validación de frescura; falta override manual auditado y UI de carga (ver §5)                   |
| 19  | `settings/banks`        | listado, alta, toggle                                                                           | `settings/banks`                                   | ✅     | —                                                                                                                                    |
| 20  | `settings/tax-concepts` | CRUD                                                                                            | `settings/tax-concepts`                            | ✅     | —                                                                                                                                    |
| 21  | `cron`                  | trigger BCV                                                                                     | —                                                  | ✅     | Correcto sin UI (admin)                                                                                                              |
| 22  | `health`                | `GET /health`                                                                                   | —                                                  | ✅     | —                                                                                                                                    |

**Resumen:** 8 módulos ✅ · 3 🟡 · 5 🔴 · 4 ⚪ · 2 ⛔ (ver §4).

---

## 2. Defectos de contrato (frontend ↔ backend)

### 2.1 HR — 8 endpoints inexistentes

| Archivo:línea               | Llamada del frontend               | API real                       | Fix                                              |
| --------------------------- | ---------------------------------- | ------------------------------ | ------------------------------------------------ |
| `modules/hr/api.ts:109`     | `POST /hr/employees/:id/terminate` | —                              | Crear endpoint o usar `PATCH` con `status/causa` |
| `modules/hr/api.ts:115`     | `PATCH /hr/departments/:id`        | —                              | Crear `PATCH`                                    |
| `modules/hr/api.ts:121`     | `PATCH /hr/positions/:id`          | —                              | Crear `PATCH`                                    |
| `modules/hr/api.ts:133`     | `POST /hr/incidents/:id/approve`   | —                              | Crear endpoint                                   |
| `modules/hr/api.ts:134`     | `POST /hr/incidents/:id/reject`    | —                              | Crear endpoint                                   |
| `modules/hr/api.ts:140`     | `POST /hr/payroll/calculate`       | `POST /hr/payroll/generate`    | Alinear nombre                                   |
| `modules/hr/api.ts:141`     | `POST /hr/payroll/:id/approve`     | `POST /hr/payroll/:id/process` | Alinear nombre                                   |
| `modules/hr/api.ts:142`     | `POST /hr/payroll/:id/pay`         | —                              | Crear endpoint (genera pago/tesorería)           |
| `modules/hr/api.ts:144-145` | `GET/PATCH /hr/settings`           | —                              | Crear CRUD sobre `payroll_settings`              |

### 2.2 Inventario y productos

| Archivo:línea                               | Frontend                                             | API real                                                                 |
| ------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `modules/inventory/api/warehouses.ts:13-18` | `/warehouses` (GET list/detail, POST, PATCH, DELETE) | `GET/POST/PATCH /inventory/warehouses`; **no hay** `GET :id` ni `DELETE` |
| `modules/inventory/api/moves.ts:52`         | `POST /inventory/moves/:id/cancel`                   | `POST /inventory/moves/:id/reject`                                       |
| `modules/inventory/api/products.ts:24`      | `GET /product-categories`                            | `GET /products/categories`                                               |

### 2.3 Facturación, reportes y cierre

| Archivo:línea                           | Frontend                                  | API real                                                            |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `modules/finance/api/invoices.ts:73`    | `POST /billing/invoices/:id` (update)     | `PATCH /billing/invoices/:id`                                       |
| `modules/finance/api/invoices.ts`       | filtro `type` + respuesta paginada        | arreglo plano, sin `type` ni paginación (`API-CONTRACTS.md` L71-80) |
| `modules/finance/api/reports.ts:5`      | `GET /reports/balance-sheet?date`         | ⛔ no existe                                                        |
| `modules/finance/api/reports.ts:7`      | `GET /reports/income-statement?from&to`   | ⛔ no existe                                                        |
| `modules/finance/api/daily-close.ts:24` | `GET /treasury/daily-close/:date`         | `GET /treasury/daily-close` (sin fecha)                             |
| `modules/finance/api/daily-close.ts:26` | `POST /treasury/daily-close/:date/close`  | ⛔                                                                  |
| `modules/finance/api/daily-close.ts:28` | `POST /treasury/daily-close/:date/reopen` | ⛔                                                                  |
| `modules/orders/api.ts:33-36`           | usa `/billing/invoices` para órdenes      | debería usar `/orders`                                              |

### 2.4 Defectos de comportamiento

| Hallazgo                                                                         | Evidencia                            |
| -------------------------------------------------------------------------------- | ------------------------------------ |
| `DELETE /partners/:id` no elimina ni desactiva: solo `isSpecialTaxpayer = false` | `API-CONTRACTS.md` L48-56            |
| `GET /partners` sin paginación; el front pagina en memoria                       | `API-CONTRACTS.md` L57-58            |
| `GET /treasury/statements/:partnerId` sin rango de fechas ni movimientos         | `API-CONTRACTS.md` L61-66            |
| Home del dashboard es un stub ("conectar a /bi/kpis")                            | `app/(dashboard)/dashboard/page.tsx` |

---

## 3. Pantallas planificadas que no existen

De `docs/PLANNING.md` §5.2 ("31 páginas") contra las 22 rutas actuales:

| Pantalla planificada                               | Estado                                              | Spec   |
| -------------------------------------------------- | --------------------------------------------------- | ------ |
| `dashboard/hr/employees/[id]` (ficha del empleado) | ⛔                                                  | `S-02` |
| `dashboard/hr/payroll/[id]` (detalle del recibo)   | ⛔                                                  | `S-02` |
| `dashboard/hr/settings` (parámetros de nómina)     | ⛔                                                  | `S-02` |
| `dashboard/settings/methods` (métodos de pago)     | ⛔                                                  | `S-05` |
| `dashboard/treasury/accounts` (cuentas bancarias)  | ⛔ (hoy solo lectura desde el módulo treasury)      | `S-05` |
| `dashboard/treasury/statements/[partnerId]`        | 🟡 (existe en `operations/partners/[id]/statement`) | `S-05` |
| `dashboard/settings/payroll-concepts`              | ⛔                                                  | `S-02` |
| `dashboard/settings/payroll-settings`              | ⛔                                                  | `S-02` |
| UI de notas de crédito                             | ⛔                                                  | `S-07` |
| UI de contabilidad                                 | ⛔                                                  | `S-04` |
| UI de préstamos                                    | ⛔                                                  | `S-07` |
| Visor de auditoría                                 | ⛔                                                  | `S-07` |
| UI de compras / cuentas por pagar                  | ⛔                                                  | `S-03` |

---

## 4. Capacidades ausentes en todas las capas (⛔)

| Capacidad                                                                                     | Por qué importa                                                                           | Spec                     |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------ |
| **Cuentas por pagar (AP)**: facturas de proveedor, vencimientos, pagos, retenciones de compra | Hoy `invoices` soporta `type=PURCHASE` pero no hay flujo de CxP ni retención al proveedor | `S-03`                   |
| **Conciliación bancaria** (importar extracto / marcar conciliado)                             | Sin ella el cierre de caja no es auditable                                                | `S-05`                   |
| **Cierre contable del período** y estados financieros (balance, resultados)                   | `accounting` registra asientos pero no se puede cerrar ni reportar                        | `S-04`                   |
| **Caja chica** (fondo fijo, rendiciones)                                                      | Operación diaria de sucursal                                                              | `S-05`                   |
| **Activos fijos y depreciación**                                                              | Requisito contable/fiscal                                                                 | Backlog (`S-04` §futuro) |
| **Presupuestos**                                                                              | Control de gestión                                                                        | Backlog                  |

---

## 5. Multimoneda (requisito del 2026-10-26)

El negocio exige operar en multimoneda **con el precio del dólar como referencia**. Lo que hay hoy:

| Pieza                                    | Estado | Detalle                                                              |
| ---------------------------------------- | ------ | -------------------------------------------------------------------- |
| `currencies` con `isBase`                | 🟡     | Existe, pero nada garantiza **una sola** moneda base                 |
| `exchange_rates` (`rate` 20,10 + `date`) | 🟡     | Sin índice único por día ni campo de fuente (`BCV`/`MANUAL`)         |
| Facturas con moneda + tasa + total base  | ✅     | `invoices` es el único documento que lo hace bien                    |
| Pagos con monto en base                  | ⛔     | `payments` guarda `amount` + `exchangeRate` pero **no `amountBase`** |
| Retenciones con moneda                   | ⛔     | `tax_retentions` sin `currencyId` ni tasa                            |
| Libro contable con moneda funcional      | ⛔     | `accounting_entries`/`_lines` sin moneda (H-49)                      |
| Actualización automática de la tasa      | ⛔     | Scraping BCV sin `@Cron`; sólo un `GET` manual (H-50)                |
| Validación de frescura de la tasa        | ⛔     | Se usa la última fila sin importar su antigüedad (H-52)              |
| IGTF correcto                            | 🟡     | Se infiere con `rate > 1` en vez de `currencyId != base` (H-53)      |

**Spec:** [`specs/S-08-multimoneda.md`](./specs/S-08-multimoneda.md) · **Épica:** E8 · **Bloquea a:**
`S-04`, `S-06`, `S-03` y `S-05`.
| **Notificaciones transaccionales** (más allá de reset) | Facturas, vencimientos | Backlog |
| **Portal de clientes** | Autoservicio | Fuera de alcance |

---

## 5. Deuda documental detectada

| Documento                | Problema                                                                               | Acción                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `docs/PROGRESS.md`       | Marca módulos "completos" por tener controlador                                        | Ya advertido en su cabecera; el SDD exige evidencia                                                 |
| `docs/PLANNING.md`       | Estructura de módulos (14) distinta a la real (9)                                      | Se conserva como diseño; el mapeo real está en §1                                                   |
| `docs/PROJECT-STATUS.md` | Snapshot 2026-10-23: "Operations parcial", "guard solo en controladores seleccionados" | **Desactualizado**: desde 2026-10-26 hay guards globales (ver `docs/update/03-FASE-2-SEGURIDAD.md`) |
| `docs/API-CONTRACTS.md`  | "Brechas pendientes" #1 (autorización backend)                                         | **Resuelta**; #2–#4 siguen abiertas                                                                 |

> Sugerencia: al cerrar `S-01`, actualizar `PROJECT-STATUS.md` y `API-CONTRACTS.md` en el mismo PR.
