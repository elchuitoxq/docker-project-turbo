# S-09 — UI de los flujos operativos del MANAGER (con multimoneda de base)

| Campo          | Valor                                                                            |
| -------------- | -------------------------------------------------------------------------------- |
| **Estado**     | 🟡 En ejecución — F1 ✅ · F2 ✅ · D-02…D-07 aplicadas · F3…F7 pendientes         |
| **Prioridad**  | 🔴 P0 (bloquea las pruebas visuales de SELLER, WAREHOUSE y ACCOUNTANT)           |
| **Depende de** | S-00 (sucursal), S-01 (contratos), S-05 (tesorería), S-08 (multimoneda)          |
| **Épica**      | E9                                                                               |
| **Origen**     | Auditoría UI del 2026-10-30 tras ejecutar la suite `MG-01…MG-24` (ver `docs/qa`) |

---

## 1. Problema

Tras correr la suite visual del rol MANAGER quedaron **14 defectos** corregidos (`DEF-001…DEF-014`)
pero la auditoría de las pantallas restantes muestra que **el backend ya tiene el flujo y la UI no**:

- el MANAGER tiene `operations:orders:create|edit|approve` y **ningún** formulario de pedido;
- existe `POST /v1/billing/invoices` (con moneda y tasa) y **ninguna** pantalla de emisión;
- `products.currencyId` y `partners.creditDays` existen en esquema y DTO **sin campo en el formulario**;
- `PATCH /v1/treasury/bank-accounts/:id` y `POST /v1/settings/currencies/rates` existen **sin UI**;
- `settings/currencies`, `settings/banks` y `settings/tax-concepts` son `ModuleStub`.

Y el requisito **multimoneda** (S-08, decisión D-01 del 2026-10-26) está implementado en el **motor**
(`MoneyService`, `payments.amountBase`, `reports/summary` con bloque `usd`) pero **no en la interfaz**:

- `formatCurrency()` tiene `currency: 'USD'` por defecto → **74 de 80** llamadas de la app (93 con
  utilidades y tests) muestran montos en USD aunque el documento esté en VES;
- `formatDual()` sólo se usa en **2** lugares (diálogo de pago de CxP);
- no hay forma de elegir moneda ni de ver la tasa aplicada al emitir;
- no hay pantalla de tasas (ni override manual auditado, HU-5 de S-08).

## 2. Auditoría: UI real por proceso del MANAGER (2026-10-30)

> Retrato del 2026-10-30. El estado **actual** del cargo (permisos, actuaciones y prohibiciones) está en
> [`S-14`](./S-14-actuaciones-rol-manager.md); las filas de procesos 22 y 23 ya cambiaron con `D-02` y
> `D-04`.

Leyenda: **✔** existe y funciona · **◐** existe a medias · **✘** no existe.

| #   | Proceso                | Ruta                                                | Permiso MANAGER                               | Backend                                                                             | UI  | Qué falta                                                                            |
| --- | ---------------------- | --------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------ |
| 1   | Panel                  | `/dashboard`                                        | `dashboard:view`                              | `/bi/kpis`, `/bi/chart`, `/bi/activity`                                             | ✔   | Nada funcional; hereda la brecha M1 (montos sin moneda explícita)                    |
| 2   | Clientes y Proveedores | `/operations/partners`                              | `:view`, `:create`, `:edit`                   | CRUD + `stats` + `statement`                                                        | ◐   | `creditDays`, desactivar (`DELETE`), estado de cuenta, stats                         |
| 3   | Ventas                 | `/operations/sales`                                 | `:sales:view`                                 | `GET/POST/PATCH /billing/invoices`, `post`                                          | ◐   | **Emisión de factura** y **ficha del documento** (`S-10`)                            |
| 4   | Pedidos                | `/operations/orders`                                | `:view`, `:create`, `:edit`, `:approve`       | CRUD + `confirm` + `cancel` + `invoice`                                             | ◐   | **Todo el flujo**: crear, editar, confirmar, cancelar, facturar + **ficha** (`S-10`) |
| 5   | Productos              | `/inventory/products`                               | `:view`, `:create`, `:edit`                   | CRUD + `categories`                                                                 | ◐   | `currencyId` (moneda del precio), desactivar                                         |
| 6   | Stock                  | `/inventory/stock`                                  | `inventory:products:view`                     | `GET /inventory/stock/:warehouseId`                                                 | ✔   | Nada                                                                                 |
| 7   | Facturación            | `/finance/invoices`                                 | `finance:invoices:view`                       | `post`, `void`, `fiscal-json`                                                       | ◐   | Emisión y edición; `post`/`void` ocultos (el MANAGER no los tiene)                   |
| 8   | Cuentas por pagar      | `/finance/payables`                                 | `invoices:view` + `payments:create`           | `payables`, `aging`, retención, pagos                                               | ✔   | Alta de CxP depende de facturas de compra (proceso 10)                               |
| 9   | Notas de crédito       | `/finance/credit-notes`                             | `credit-notes:manage`                         | CRUD + `post` + `void` + `apply`                                                    | ✔   | Hereda moneda/tasa de la factura; mostrar dual (§3.1)                                |
| 10  | Préstamos              | `/finance/loans`                                    | `loans:manage`                                | CRUD + `approve` + `reject` + `pay`                                                 | ✔   | Nada                                                                                 |
| 11  | Tesorería              | `/finance/treasury`                                 | `treasury:view` + `payments:create`           | `payments`, `void`                                                                  | ◐   | Cobro/pago manual, anulación con permiso propio (hoy usa `invoices:void`)            |
| 12  | Cuentas bancarias      | `/finance/treasury/accounts`                        | `treasury:create_account`                     | `POST`, `PATCH`, `toggle`                                                           | ◐   | **Editar** y desactivar; moneda de la cuenta                                         |
| 13  | Conciliación           | `/finance/treasury/reconciliation`                  | gate `treasury:create_account`                | `import`, `match`, `unmatch`                                                        | ✔   | Semántica de permiso (debería ser de conciliación, no de alta de cuenta)             |
| 14  | Caja chica             | `/finance/treasury/petty-cash`                      | gate `treasury:create_account`                | fondos, movimientos, `close`                                                        | ✔   | Ya pide moneda; mostrar dual en movimientos (§3.1)                                   |
| 15  | Cierre diario          | `/finance/daily-close`                              | gate `treasury:create_account`                | `close`, `reopen`                                                                   | ✔   | Semántica de permiso igual que 13                                                    |
| 16  | Contabilidad           | `/finance/accounting` + `/periods`                  | `accounts:view`, `entries:view`, `close:view` | `accounts`, `entries`, `periods`                                                    | ◐   | Sin balance de comprobación ni estado de resultados (ni endpoint ni pantalla)        |
| 17  | RRHH (empleados)       | `/hr/employees`, `/hr/positions`, `/hr/departments` | `hr:employees:view`, `hr:view`                | HR CRUD                                                                             | ✔   | Nada                                                                                 |
| 18  | Sucursales             | `/settings/branches`                                | `branches:view`                               | `/settings/branches`                                                                | ✔   | Nada                                                                                 |
| 19  | Métodos de pago        | `/settings/methods`                                 | `treasury:view`                               | `POST`, `PATCH`, `toggle`                                                           | ◐   | Editar nombre/flags; mapeo método → cuenta (`payment_method_accounts`)               |
| 20  | Bancos                 | `/settings/banks`                                   | `banks:view`                                  | `GET`, `POST`, `PATCH`, `toggle`                                                    | ✘   | `ModuleStub` → lista de solo lectura + gestión si `:manage`                          |
| 21  | Impuestos              | `/settings/tax-concepts`                            | `taxes:view`                                  | `GET`, `POST`, `PATCH`, `DELETE`                                                    | ✘   | `ModuleStub` → lista de solo lectura + gestión si `:manage`                          |
| 22  | Monedas y tasas        | `/settings/currencies`                              | **sin permiso**                               | `list`, `create`, `rates/latest`, `rates/:code`, `history`, `POST rates`, `refresh` | ✘   | **Moneda base, tasa vigente, historial, override manual, refresh BCV**               |
| 23  | Compras                | `/operations/purchases`                             | **sin permiso**                               | `GET /billing/invoices?type=PURCHASE`                                               | ◐   | Nadie ve el ítem del menú → CxP no tiene alta de factura de compra                   |

### 2.1 Brechas multimoneda verificadas (código al 2026-10-30)

| #   | Brecha                                                                                                                                                                                                               | Evidencia                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| M1  | Todo monto sin moneda explícita se pinta en **USD**                                                                                                                                                                  | `lib/utils.ts:8` (`currency = 'USD'`); 74 de 80 llamadas de la app sin 2.º argumento (6 con moneda) |
| M2  | Monto dual sólo en el diálogo de pago de CxP                                                                                                                                                                         | `formatDual` aparece en 2 sitios de `payables-view.tsx`                                             |
| M3  | Ningún formulario permite elegir moneda ni ver la tasa aplicada                                                                                                                                                      | no existe formulario de factura/pedido/pago manual                                                  |
| M4  | Producto no expone su moneda de precio                                                                                                                                                                               | `products.currencyId` en esquema y DTO; ausente en `product-dialog`                                 |
| M5  | Listas no muestran la tasa del documento                                                                                                                                                                             | `invoices-view`, `orders-view`, `treasury-view` sólo hacen `formatCurrency`                         |
| M6  | Pantalla de monedas/tasas es un stub                                                                                                                                                                                 | `app/(dashboard)/dashboard/settings/currencies/page.tsx`                                            |
| M7  | Nadie tiene `settings:currencies:view` (sólo ADMIN/SUPER_ADMIN por `ALL_PERMISSIONS`); además los `GET` de monedas y tasas **no exigen permiso** (sólo JWT, `@SkipBranch`), así que el gate real es únicamente de UI | `ROLE_PERMISSIONS` en `seed-rbac.ts`; `currencies.controller.ts:34-48`                              |
| M8  | Sin `GET /health/rates` (contrato S-08 §5)                                                                                                                                                                           | `health.controller.ts` sólo expone chequeos; el frontend usa `rates/latest`                         |
| M9  | La spec S-08 declara `settings:currencies:override`, el código usa `manage`                                                                                                                                          | `currencies.controller.ts:119,135`                                                                  |
| M10 | Rutas de la spec (`/currencies/:code/rate`) ≠ implementadas (`/currencies/rates/:code`, `POST /rates`)                                                                                                               | `currencies.controller.ts:64-122`                                                                   |
| M11 | Reportes: el backend ya devuelve `usd` + `closingRate`, **ninguna pantalla lo consume**                                                                                                                              | `reports.service.ts:58-61,405-410`; `reports-view.tsx`                                              |
| M12 | MANAGER no tiene `finance:reports:view` → no ve ningún reporte                                                                                                                                                       | `ROLE_PERMISSIONS.MANAGER`                                                                          |

### 2.2 Defectos nuevos detectados en la auditoría

No aparecieron en la suite visual porque los roles de prueba no alcanzan la acción o porque el efecto es
silencioso. Se registran aquí y se corrigen dentro de las tareas indicadas.

| ID      | Sev. | Defecto                                                                                                                                                                      | Evidencia                                               | Se corrige en            |
| ------- | :--: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------ |
| DEF-015 |  S2  | `productsService.remove()` **no borra ni desactiva nada**: responde `Product … deleted successfully` y el producto sigue igual, aunque Swagger lo anuncia como _soft delete_ | `products.service.ts:144-152`                           | T-09-25                  |
| DEF-016 |  S1  | Montos mostrados en USD por defecto en toda la app (74 de 80 llamadas)                                                                                                       | `lib/utils.ts:8`                                        | T-09-01 ✅               |
| DEF-017 |  S2  | "Anular pago" se habilita con `finance:invoices:void` y `finance:payments:void` existe en el catálogo sin asignarse a ningún rol                                             | `treasury-view.tsx:255`; `seed-rbac.ts:52`              | T-09-20 ✅               |
| DEF-018 |  S3  | Conciliación y cierre diario usan `finance:treasury:create_account` como permiso de acción                                                                                   | `reconciliation-view.tsx:51`, `daily-close-view.tsx:51` | T-09-21                  |
| DEF-019 |  S3  | `GET /v1/health/rates` documentado en `S-08` §5 no existe; el frontend usa `GET /settings/currencies/rates/latest`                                                           | `health.controller.ts`, `lib/rates.ts`                  | T-09-03 ✅               |
| DEF-020 |  S3  | `S-08` declara el permiso `settings:currencies:override` y las rutas `/currencies/:code/rate`, ninguna existe en código                                                      | `currencies.controller.ts:64-122`                       | T-09-04 ✅               |
| DEF-021 |  S2  | Las tarjetas de Facturación mostraban vacío/`NaN`: la UI leía `draft/posted/void/totalPosted` y el backend devuelve `draftCount/postedCount/voidCount/totalAmount`           | `invoices-view.tsx`, `InvoiceStatsDto`                  | T-09-02 ✅               |
| DEF-022 |  S1  | `GET /billing/invoices/stats` sumaba `total` de documentos en monedas distintas: importe sin significado. Ahora agrega en moneda funcional (`total × exchangeRate`)          | `billing.service.ts getStats`                           | T-09-02 ✅               |
| DEF-023 |  S2  | `invoices.total_base` es la **base imponible** en la moneda del documento, mientras en CxP `totalBase` es el monto en moneda funcional: el mismo nombre para dos cosas       | `schema.ts`, `billing.service.ts`                       | Documentado en `S-08` §4 |

> Cierre del 2026-10-30: DEF-016, DEF-017, DEF-019, DEF-020, DEF-021 y DEF-022 corregidos y verificados
> (ver §14 «Avance de ejecución»). DEF-015, DEF-018 y DEF-023 quedan abiertos con tarea asignada.

## 3. Alcance

Ocho slices verticales (API + UI + test) sobre lo que ya existe en backend:

- **A. Moneda visible (M1, M2, M5)** — formateo por moneda y dual obligatorio en documentos.
- **B. Administración de monedas y tasas (M6–M10)** — pantalla real, override auditado, refresh BCV.
- **C. Emisión de facturas** — formulario VENTA/COMPRA con moneda, tasa congelada y vencimiento.
- **D. Pedidos** — crear/editar/confirmar/cancelar/facturar.
- **E. Tesorería y bancos** — cobro/pago manual, anulación con permiso propio, edición de cuentas.
- **F. Maestros** — `creditDays`, desactivar tercero/producto, moneda del producto, bancos e impuestos.
- **G. Reportes y contabilidad** — columnas VES + USD, balance de comprobación y estado de resultados.
- **H. RBAC y QA** — permisos nuevos, casos `MG-25…MG-40` y `CT-16…CT-20`.

**No incluye:** revaluación por variación cambiaria, compras como módulo propio con recepción
(S-03), nómina (S-02), ni migración de datos históricos.

## 4. Historias de usuario

| ID   | Historia                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------- |
| HU-1 | Como gerente emito una factura en USD y veo el total dual con la tasa del día.                  |
| HU-2 | Como gerente creo un pedido, lo confirmo y lo facturo sin salir del módulo.                     |
| HU-3 | Como gerente registro un cobro en VES de una factura en USD y el saldo queda en cero.           |
| HU-4 | Como gerente veo la tasa BCV con su fuente y antigüedad, y el sistema me avisa si está vencida. |
| HU-5 | Como administrador fijo la tasa a mano un día sin publicación y queda auditado quién y por qué. |
| HU-6 | Como gerente consulto un reporte con columnas VES y USD a la tasa de corte.                     |
| HU-7 | Como gerente desactivo un cliente con movimientos sin borrar su historial.                      |

## 5. Reglas de negocio (multimoneda de base, no opcional)

1. **Ningún monto se formatea sin moneda.** `formatCurrency(amount)` sin código se elimina de la API
   del frontend; se reemplaza por `formatMoney(amount, code)` (y `formatDual` cuando hay tasa).
2. **Todo documento guarda moneda + tasa congelada + monto en base** al emitirse; nunca se recalcula
   con la tasa de hoy (regla de oro de S-08 §4).
3. **La tasa se elige, se muestra y se confirma.** Todo formulario de emisión muestra fuente, valor y
   antigüedad, y usa `<StaleRateGate>` si supera el umbral (`MAX_RATE_AGE_DAYS`).
4. **Dual obligatorio en documentos:** moneda del documento como principal y equivalente en base a la
   tasa **del documento** como secundario.
5. **Agregados siempre en moneda funcional (VES)**; los reportes añaden la columna USD a la tasa de
   corte y no permiten ocultarla.
6. **Permiso de acción ≠ permiso de pantalla.** Anular pago usa `finance:payments:void`; conciliar, caja
   chica y cierre diario usan permisos propios (`finance:treasury:reconcile`, `finance:treasury:petty-cash`
   y `finance:treasury:daily-close`), no `treasury:create_account`. El cierre diario **no** reutiliza
   `finance:close:manage`: ese es el cierre contable de períodos (`S-14` D-08).
7. **Desactivar antes que borrar:** terceros, productos y bancos con movimientos se desactivan
   (`isActive`/`toggle`); `DELETE` sólo si no tienen historial.

## 6. Contrato HTTP

Todo lo necesario **ya existe** salvo lo marcado como nuevo:

| Uso                       | Endpoint                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Monedas y tasas           | `GET /v1/settings/currencies`, `GET /rates/latest`, `GET /rates/:code`, `GET /rates/:code/history`, `POST /rates`, `POST /refresh` |
| Estado de la tasa (nuevo) | `GET /v1/health/rates` → `{ code, rate, date, source, ageHours, stale }`                                                           |
| Facturas                  | `POST/PATCH /v1/billing/invoices`, `/:id/post`, `/:id/void`, `GET /payables`, `/payables/aging`                                    |
| Pedidos                   | `POST/PATCH /v1/orders`, `/:id/confirm`, `/:id/cancel`, `/:id/invoice`                                                             |
| Pagos                     | `POST /v1/treasury/payments`, `POST /payments/:id/void`                                                                            |
| Cuentas bancarias         | `POST`, `PATCH /:id`, `POST /:id/toggle`                                                                                           |
| Terceros                  | `POST/PATCH/DELETE /v1/partners`, `GET /partners/:id/statement`                                                                    |
| Productos                 | `POST/PATCH/DELETE /v1/products` (+ `currencyId`)                                                                                  |
| Reportes                  | `GET /v1/reports/summary` (ya devuelve `usd` + `closingRate`)                                                                      |
| Contabilidad (nuevo)      | `GET /v1/accounting/trial-balance?from&to` y `GET /v1/accounting/income-statement?from&to`                                         |

## 7. UI/UX

- Formularios de emisión: cabecera (tercero, sucursal, almacén, **moneda**, **tasa con fuente y
  antigüedad**, fecha, vencimiento sugerido por `creditDays`), líneas con buscador de producto,
  pie con base / IVA / IGTF / total y **total dual**.
- Listas: columnas `Moneda`, `Tasa` y total dual; la moneda del documento manda el símbolo.
- `/settings/currencies`: tarjeta de moneda funcional, tabla de monedas, tasa vigente con badge de
  fuente/edad, historial paginado y diálogo de override (motivo obligatorio + confirmación explícita).
- Acciones deshabilitadas con tooltip cuando el estado no lo permite (no ocultas), salvo cuando falta
  el permiso (ahí sí se ocultan).
- Estados vacío/cargando/error en todas las pantallas nuevas.

## 8. Criterios de aceptación

```gherkin
Escenario: factura en USD muestra dual con la tasa del documento
  Dado una tasa BCV de 36,50 del día
  Cuando emito una factura de 100 USD
  Entonces la lista muestra "US$ 100,00 · Bs. 3.650,00"
  Y la tasa 36,50 queda guardada en la factura

Escenario: tasa vencida bloquea la emisión
  Dado que la última tasa tiene más de MAX_RATE_AGE_DAYS
  Cuando abro el formulario de factura en USD
  Entonces veo el aviso de tasa vencida
  Y el botón "Emitir" queda deshabilitado hasta confirmar la tasa

Escenario: pedido confirmado y facturado
  Dado un pedido PENDING con 2 líneas
  Cuando lo confirmo y luego lo facturo
  Entonces el stock baja y se crea una factura DRAFT con la misma moneda y tasa

Escenario: cobro en VES de factura USD
  Dado una factura USD 100 con tasa 36,50 y saldo 100
  Cuando registro un pago de 3.650 VES a tasa 36,50
  Entonces el saldo queda en 0 y el listado muestra el pago con su moneda y tasa

Escenario: override manual auditado
  Dado un administrador en /settings/currencies
  Cuando fija la tasa en 40 sin motivo
  Entonces el botón está deshabilitado
  Y al guardar con motivo queda una fila con source MANUAL, autor y motivo

Escenario: moneda sin código no se puede pintar
  Dado un componente que formatea un monto
  Cuando no indica la moneda
  Entonces el typecheck falla (la firma exige el código)

Escenario: reporte dual obligatorio
  Cuando abro /finance/reports
  Entonces veo columnas VES y USD
  Y el encabezado muestra la tasa de corte y su fecha
```

## 9. Plan de tareas (fases ejecutables)

> Orden pensado para que cada fase deje la app usable: primero **corrección multimoneda**, luego los
> flujos que crean documentos, después maestros y reportes. Cada tarea = un PR pequeño.

### F1 · Moneda visible y motor alineado (bloquea al resto)

| ID      | Tarea                                                                                                         | Artefactos                                                                            | Verificación                                         | Talla |
| ------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----- |
| T-09-01 | `formatMoney(amount, code)` sin default + refactor de las 74 llamadas; `formatDual` obligatorio en documentos | `lib/utils.ts`, `lib/currency.ts` (nuevo), vistas de finanzas/inventario/HR           | typecheck rompe si falta la moneda; tests de formato | M     |
| T-09-02 | Columnas `Moneda`, `Tasa` y total dual en facturas, pedidos, pagos, NC y CxP                                  | `invoices-view`, `orders-view`, `treasury-view`, `credit-notes-view`, `payables-view` | factura USD y VES se ven distintas en la lista       | M     |
| T-09-03 | `GET /health/rates` + `global-rate-display` con fuente y antigüedad                                           | `health.controller.ts`, `global-rate-display.tsx`, `lib/rates.ts`                     | badge "BCV 36,50 · hace 2 h"; ámbar si vencida       | S     |
| T-09-04 | Alinear S-08 §5 con lo implementado (rutas de tasas y permiso de override)                                    | `docs/sdd/specs/S-08-multimoneda.md`, `docs/API-CONTRACTS.md`                         | no quedan rutas documentadas inexistentes            | S     |
| T-09-05 | Corregir tablero: `T-08-12` y `T-08-13` pasan a 🟡 con nota de lo que faltaba                                 | `docs/sdd/04-plan-de-tareas.md`                                                       | tablero coincide con el código                       | S     |

### F2 · Monedas y tasas (admin + lectura para MANAGER)

| ID      | Tarea                                                                                   | Artefactos                                                              | Verificación                                   | Talla |
| ------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- | ----- |
| T-09-06 | Módulo `settings/currencies` (api + hooks) y pantalla real: base, lista, tasa vigente   | `modules/settings/currencies/*`, `app/.../settings/currencies/page.tsx` | deja de ser `ModuleStub`                       | M     |
| T-09-07 | Historial de tasas paginado + diálogo de override (motivo obligatorio, confirmación)    | mismas + `components/rate-override-dialog.tsx`                          | override crea fila `MANUAL` con autor y motivo | M     |
| T-09-08 | Botón "Sincronizar BCV" con feedback de edad y último resultado                         | `POST /settings/currencies/refresh`                                     | error de BCV no rompe la pantalla              | S     |
| T-09-09 | RBAC: `settings:currencies:view` a MANAGER y ACCOUNTANT; `settings:currencies:override` | `seed-rbac.ts`, `lib/permissions.ts`, `navigation.ts`                   | MANAGER ve monedas, no puede override          | S     |

### F3 · Emisión de facturas

| ID      | Tarea                                                                                                | Artefactos                                                                    | Verificación                             | Talla |
| ------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- | ----- |
| T-09-10 | Formulario de factura: tercero, almacén, moneda, tasa con `StaleRateGate`, líneas, IGTF, vencimiento | `modules/finance/components/invoice-form-dialog.tsx`, `hooks/use-invoices.ts` | factura DRAFT cuadra base+IVA+IGTF=total | L     |
| T-09-11 | Vencimiento sugerido por `partners.creditDays` y edición de borradores                               | `invoice-form`, `PATCH /billing/invoices/:id`                                 | pedido con 30 días propone +30           | S     |
| T-09-12 | Acciones `post`/`void` con permiso real y confirmación                                               | `invoices-view`, `usePermission`                                              | MANAGER sólo ve lo que su rol permite    | S     |
| T-09-13 | Permiso `finance:invoices:create` para MANAGER (decisión D-03)                                       | `seed-rbac.ts`, `permissions.ts`                                              | MANAGER emite desde Ventas si D-03 = sí  | S     |

**Avance 2026-10-30:** `T-09-10` y `T-09-13` cerradas. El botón "Nueva factura" de Facturación abre el
formulario con moneda, tasa (con `StaleRateGate`), vencimiento opcional, líneas con IVA y la vista
previa base + IVA + IGTF = total; la factura nace en borrador y abre su ficha. Falta `T-09-11` (sugerir
vencimiento con `creditDays`, que el frontend aún no recibe) y editar borradores desde la ficha.

### F4 · Pedidos

| ID      | Tarea                                                                      | Artefactos                                        | Verificación                                      | Talla |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- | ----- |
| T-09-14 | `ordersApi`: create, update, confirm, cancel, invoice (+ tipos de payload) | `modules/orders/api.ts` / `orders-api.ts`         | contrato tipado contra el DTO del backend         | S     |
| T-09-15 | Formulario de pedido reutilizando la cabecera del formulario de factura    | `modules/orders/components/order-form-dialog.tsx` | pedido con moneda y tasa congeladas               | L     |
| T-09-16 | Acciones por estado: confirmar, cancelar, facturar con tooltips de motivo  | `orders-view.tsx`                                 | botones deshabilitados cuando el estado no aplica | M     |
| T-09-17 | Detalle de pedido con líneas, moneda, tasa y dual                          | `orders-view.tsx` (detalle)                       | pedido USD muestra dual                           | M     |

**Avance 2026-10-30:** `T-09-14`, `T-09-15` y `T-09-16` cerradas (el detalle, `T-09-17`, se entregó en
`S-10`). El botón "Nuevo pedido" de Pedidos abre el formulario de alta —tipo, tercero filtrado por tipo,
almacén, fecha, moneda, tasa y líneas— y deja el pedido en borrador con su ficha abierta y el primer
paso del histórico (`S-12`). El código se genera en la UI (`ORD-AAAAMMDD-XXXX`) porque el backend no
tiene secuencia de pedidos.

### F5 · Tesorería y cuentas bancarias

| ID      | Tarea                                                                                           | Artefactos                                                    | Verificación                                                    | Talla |
| ------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- | ----- |
| T-09-18 | Editar cuenta bancaria (PATCH) y activar/desactivar (toggle) + moneda de la cuenta              | `treasury-accounts-view.tsx`, `api/treasury.ts`               | cuenta editada refleja banco, número y moneda                   | M     |
| T-09-19 | Cobro/pago manual desde Tesorería con moneda, tasa, asignación a facturas y gate de tasa        | `components/payment-form.tsx` (nuevo, reutiliza CxP)          | cobro VES de factura USD deja saldo 0                           | L     |
| T-09-20 | Anular pago con `finance:payments:void` (nuevo permiso) en lugar de `invoices:void`             | `treasury-view.tsx`, `treasury.controller.ts`, `seed-rbac.ts` | permiso correcto por acción                                     | S     |
| T-09-21 | Permisos propios `finance:treasury:reconcile` y `finance:close:manage` para conciliación/cierre | `seed-rbac.ts`, `reconciliation-view`, `daily-close-view`     | MANAGER conserva acceso; se retira el gate por `create_account` | S     | ✅  |

> **Cierre de `T-09-21` (2026-10-31):** se aplicó con tres permisos de tesorería —`reconcile`,
> `petty-cash` y `daily-close`— para no mezclar el cierre diario de caja con el cierre contable de
> períodos (`finance:close:manage`). Ver [`S-14` D-08](./S-14-actuaciones-rol-manager.md).

### F6 · Maestros

| ID      | Tarea                                                                                                                                                                                                         | Artefactos                                                            | Verificación                                   | Talla                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------ |
| T-09-22 | `creditDays` en el diálogo de tercero y vencimiento en CxP                                                                                                                                                    | `partner-dialog.tsx`, `partners/api.ts`                               | tercero con 15 días propone vencimiento +15    | S                              |
| T-09-23 | Desactivar tercero (DELETE con historial → `isActive=false`) y estado de cuenta                                                                                                                               | `partners-table.tsx`, `partners/api.ts`, permiso `partners:statement` | tercero con facturas se desactiva, no se borra | M                              |
| T-09-24 | `currencyId` en el formulario de producto y precio con su moneda                                                                                                                                              | `product-dialog.tsx`, `inventory/api/products.ts`                     | producto en USD se lista con su símbolo        | M                              |
| T-09-25 | Baja de producto: `productsService.remove()` hoy es un **no-op** (responde "deleted" sin borrar ni desactivar). Agregar `isActive` (migración) + filtros, o borrado físico con 409 si tiene stock/movimientos | `products.service.ts`, migración, `products-view.tsx`                 | T-09-24                                        | producto con stock no se borra | S   |
| T-09-26 | Pantallas reales de Bancos e Impuestos (lista + gestión según `:manage`)                                                                                                                                      | `app/.../settings/banks/page.tsx`, `tax-concepts/page.tsx`            | dejan de ser stubs                             | M                              |
| T-09-27 | Editar método de pago y mapeo método → cuenta bancaria                                                                                                                                                        | `payment-methods-view.tsx`, `payment_method_accounts`                 | método con cuenta se usa al cobrar             | M                              |

### F7 · Reportes y contabilidad

| ID      | Tarea                                                                                      | Artefactos                                                              | Verificación                             | Talla |
| ------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------- | ----- |
| T-09-28 | Pantalla de reportes que consume `/reports/summary` con columnas VES y USD y tasa de corte | `reports-view.tsx`, `api/reports.ts`                                    | ambas columnas cuadran con `closingRate` | M     |
| T-09-29 | Libros de ventas/compras con columna USD en pantalla (el CSV sigue en base)                | `reports-view.tsx`, `reports.service.ts`                                | CSV no cambia; pantalla sí muestra dual  | M     |
| T-09-30 | `GET /accounting/trial-balance` y `/income-statement` (nuevos) + pantallas                 | `accounting.controller.ts`, `services/*`, `app/.../finance/accounting/` | balance cuadra y suma en base            | L     |
| T-09-31 | `finance:reports:view` a MANAGER (decisión D-07)                                           | `seed-rbac.ts`, `navigation.ts`                                         | MANAGER ve Reportes si D-07 = sí         | S     |

### F8 · QA y documentación

| ID      | Tarea                                                                  | Artefactos                                           | Verificación                         | Talla |
| ------- | ---------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ | ----- |
| T-09-32 | Casos nuevos `MG-25…MG-40` y transversales `CT-16…CT-20` (multimoneda) | `docs/qa/01-manager.md`, `docs/qa/00-transversal.md` | casos ejecutables con datos semilla  | M     |
| T-09-33 | Ejecutar la suite ampliada con evidencias y bitácora                   | `docs/qa/ejecuciones/2026-11-xx-manager.md`          | 0 fallas abiertas de severidad S1/S2 | M     |
| T-09-34 | Actualizar `docs/qa/README.md`, roadmap y bitácora al cerrar la épica  | docs + `docs/update/09-BITACORA.md`                  | índices sin enlaces muertos          | S     |

**Secuencia recomendada:** F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8. F1 y F2 son prerequisito de
cualquier formulario nuevo (sin tasa visible no se puede emitir correctamente).

## 10. Plan de pruebas

| Nivel       | Caso                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------ |
| Unitario    | `formatMoney` exige moneda; `formatDual` con tasa 0/NaN muestra sólo el principal          |
| Unitario    | `StaleRateGate` deshabilita el submit y exige confirmación                                 |
| Integración | `POST /orders` + `/confirm` + `/invoice` conserva moneda y tasa del pedido                 |
| Integración | `POST /billing/invoices` con `currencyId` USD y `exchangeRate` guarda `totalBase` correcto |
| Integración | Pago VES sobre factura USD a la misma tasa deja saldo 0                                    |
| Integración | `POST /settings/currencies/rates` sin motivo → 400; con motivo → fila `MANUAL` auditada    |
| Integración | `GET /health/rates` reporta `ageHours` y `stale` coherentes                                |
| Integración | `GET /accounting/trial-balance` suma cero y coincide con los asientos del período          |
| E2E         | MANAGER: crear pedido → confirmar → facturar → cobrar → cierre diario                      |
| E2E         | Tasa vencida bloquea la emisión hasta confirmar                                            |

## 11. Riesgos

| Riesgo                                                                | Mitigación                                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| El refactor de `formatCurrency` toca 78 sitios y rompe snapshots      | Tarea aislada en F1, con typecheck bloqueante y sin cambios de lógica            |
| Conceder permisos de más al MANAGER rompe la segregación de funciones | Cada permiso se decide explícitamente (§12) y queda en la matriz RBAC            |
| Formularios nuevos multiplican la conversión hecha a mano             | Sólo `MoneyService`/`lib/currency.ts`; revisión de PR rechaza multiplicar montos |
| Backfill de datos viejos sin moneda                                   | Los formularios sólo aplican a documentos nuevos; históricos quedan como están   |
| Pedidos y facturas comparten cabecera y puede divergir                | Un único `document-header` reutilizado por ambos formularios                     |

## 12. Decisiones pendientes (bloquean tareas concretas)

| ID   | Decisión                                                                      | Bloquea          | Propuesta por defecto                                  |
| ---- | ----------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------ |
| D-02 | ¿Quién puede ver monedas/tasas y quién hacer override manual?                 | T-09-09          | `view`: MANAGER + ACCOUNTANT; `manage/override`: ADMIN |
| D-03 | ¿El MANAGER emite facturas directamente o sólo factura pedidos?               | T-09-13          | Sí, `finance:invoices:create` para MANAGER             |
| D-04 | ¿Se habilita `operations:purchases:view` (Compras) para MANAGER y ACCOUNTANT? | T-09-10 (compra) | Sí, para que CxP tenga origen                          |
| D-05 | ¿Se crea `finance:payments:void` y con qué alcance?                           | T-09-20          | Sí; MANAGER y ACCOUNTANT                               |
| D-06 | ¿El MANAGER ve el estado de cuenta de terceros?                               | T-09-23          | Sí, `operations:partners:statement`                    |
| D-07 | ¿El MANAGER ve reportes?                                                      | T-09-31          | Sí, `finance:reports:view`                             |

## 13. Definition of Done

- `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build` en verde.
- Cada pantalla nueva: estados vacío/cargando/error, permisos verificados y evidencia en `docs/qa`.
- Ningún monto se muestra sin su moneda; documentos muestran dual con la tasa del documento.
- La matriz RBAC de `docs/qa/README.md` se re-verifica contra la app en ejecución.
- Bitácora y tablero SDD actualizados en el mismo PR.

## 14. Avance de ejecución

### 2026-10-30 · F1 completa, F2 núcleo y decisiones D-02…D-07 aplicadas

| Entregado                            | Detalle                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatMoney` con moneda obligatoria | Se eliminó el default `'USD'`; las 74 llamadas que lo usaban reciben el código real desde el catálogo (`useCurrencyIndex`). Un monto sin moneda ahora no compila.                                                                                                                                             |
| `lib/currency.ts`                    | Catálogo cacheado (`useCurrencies`), índice `byId`/`baseCode`/`codeOf`/`symbolOf` y caída a la moneda funcional (nunca a USD). Con tests.                                                                                                                                                                     |
| Monto dual en documentos             | Facturas, pedidos, pagos, notas de crédito y CxP muestran moneda, tasa y equivalente en base; `formatDual` ya no duplica la moneda funcional (una factura en VES no inventa un equivalente en USD).                                                                                                           |
| Totales en moneda funcional          | `GET /billing/invoices/stats` agrega `total × exchangeRate`; los KPI, cierre diario, retenciones, nómina y estado de cuenta declaran la moneda de sus agregados.                                                                                                                                              |
| `GET /v1/health/rates`               | Nuevo `RateHealthController` público con `{ baseCurrency, rate, date, source, ageHours, isStale }`, consumido por el sidebar: muestra fuente (BCV/Manual), antigüedad y estado vencido.                                                                                                                       |
| Pantalla `settings/currencies`       | Reemplaza el `ModuleStub`: moneda funcional, tasa vigente con fuente y edad, tabla de monedas con su tasa, historial y diálogos de override (motivo obligatorio + confirmación) y alta de moneda.                                                                                                             |
| RBAC D-02…D-07                       | MANAGER: `settings:currencies:view`, `finance:invoices:create`, `finance:reports:view`, `operations:purchases:view`, `operations:partners:statement`, `finance:payments:void`. ACCOUNTANT: `currencies:view`, `purchases:view`, `payments:void`. Aplicado a la base de desarrollo con `seedRbac()` (aditivo). |
| Anular pago con su permiso           | La acción de Tesorería usa `finance:payments:void` (antes `finance:invoices:void`).                                                                                                                                                                                                                           |

**Verificación:** `pnpm typecheck` (6 paquetes), `pnpm lint` sin errores, 1080 tests de backend y 335 de
frontend, contenedores reconstruidos y comprobación en vivo con MANAGER: sidebar con _Compras_,
_Reportes_ y _Monedas_, badge "Manual · vencida · hace 147 d", factura USD 119,48 mostrada como
"USD 119,48 · Bs.S 4.361,02" frente a facturas VES sin duplicado, y total facturado agregado en VES.
El documento de prueba se revirtió por SQL.

**Pendiente de esta épica:** F3 (formulario de factura), F4 (pedidos), F5 (cobro manual, edición de
cuentas bancarias, permisos propios de conciliación/cierre), F6 (maestros) y F7 (reportes duales).

> La ficha de los documentos (pedido, venta, compra y factura) no forma parte de `S-09`: se planifica
> aparte en [`S-10`](./S-10-vistas-detalle-documentos.md), que consume la infraestructura multimoneda de
> esta épica.
