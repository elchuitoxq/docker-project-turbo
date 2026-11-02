# S-10 — Vistas de detalle de pedido, venta, compra y facturación

| Campo          | Valor                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| **Estado**     | 🟢 Entregada (F1…F5) · pendientes `T-10-16`/`T-10-17` (casos QA)        |
| **Prioridad**  | 🔴 P0 — sin detalle no se puede operar ni auditar un documento          |
| **Depende de** | S-01 (contratos), S-09 (moneda visible y formularios), S-05 (tesorería) |
| **Épica**      | E10                                                                     |
| **Origen**     | Revisión del 2026-10-30: las cuatro pantallas son listados sin ficha    |

---

## 1. Problema

Las cuatro pantallas de documentos comerciales son **sólo listados**. No existe forma de abrir un
documento y ver qué contiene:

| Pantalla    | Ruta actual             | Hoy                        | Consecuencia                                                            |
| ----------- | ----------------------- | -------------------------- | ----------------------------------------------------------------------- |
| Pedidos     | `/operations/orders`    | tabla, código sin enlace   | no se ve el detalle de líneas, ni se confirma/factura desde la UI       |
| Ventas      | `/operations/sales`     | tabla, código sin enlace   | el vendedor no puede revisar lo que emitió ni imprimirlo                |
| Compras     | `/operations/purchases` | tabla de CxP, sin enlace   | no se ve la factura del proveedor, sus retenciones ni sus pagos         |
| Facturación | `/finance/invoices`     | tabla con acciones en menú | se postea/anula a ciegas: el usuario no puede ver líneas ni saldo antes |

Además, el backend ya devuelve casi todo lo necesario para alimentar una ficha —salvo nombres de
producto y documentos relacionados—, así que el trabajo es mayoritariamente de UI y de enriquecer **dos**
respuestas de lectura (`GET /orders/:id` y `GET /billing/invoices/:id`).

## 2. Alcance

1. **Ficha compartida** de documento (cabecera, líneas, totales, partes relacionadas, acciones).
2. **Cuatro rutas de detalle** con su enlace desde el listado y navegación de vuelta.
3. **Enriquecer las respuestas** `GET /v1/orders/:id` y `GET /v1/billing/invoices/:id` (nombres de
   producto, moneda, partes relacionadas, saldo y pagos).
4. **Acciones en contexto** reutilizando los endpoints existentes (postear, anular, confirmar,
   cancelar, facturar) con los permisos ya definidos.
5. **Imprimible** del documento (HTML con hoja de impresión) y **JSON fiscal** para facturas.

**No incluye:** envío por correo, PDF en servidor, firma digital ni plantillas configurables.

## 3. Historias de usuario

| ID   | Historia                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------- |
| HU-1 | Como gerente abro un pedido y veo sus líneas, su moneda, su tasa y qué factura generó.                        |
| HU-2 | Como vendedor abro una venta y la imprimo tal como quedó emitida.                                             |
| HU-3 | Como gerente abro una compra y veo el número de factura del proveedor, la retención y los pagos aplicados.    |
| HU-4 | Como gerente abro una factura en borrador, reviso los totales y la posteo desde la ficha.                     |
| HU-5 | Como contador abro una factura y veo el saldo real (total, pagado, saldo) en su moneda y en moneda funcional. |

## 4. Modelo de datos

**Sin tablas nuevas.** Todo sale de lo existente: `orders`, `order_items`, `invoices`, `invoice_items`,
`payments`, `payment_allocations`, `credit_notes`, `credit_note_usages`, `tax_retentions`,
`document_links`, `warehouses`, `products`, `partners`, `branches`, `users`.

Lo único que falta es **exponerlo**: hoy `GET /orders/:id` no trae nombre de producto ni tercero, y
`GET /billing/invoices/:id` no trae pagos ni notas aplicadas.

## 5. Contrato HTTP (sólo lectura, ampliando lo existente)

### 5.1 `GET /v1/orders/:id` — ampliar `OrderResponseDto`

Campos nuevos (todos calculados, sin migración):

| Campo                                       | Origen                               |
| ------------------------------------------- | ------------------------------------ |
| `partnerName`, `partnerTaxId`               | `partners`                           |
| `warehouseName`                             | `warehouses`                         |
| `branchName`                                | `branches`                           |
| `currencyCode`                              | `currencies.code` (por `currencyId`) |
| `items[].productName`, `items[].productSku` | `products`                           |
| `invoiceId`, `invoiceCode`, `invoiceStatus` | `invoices` donde `orderId = :id`     |
| `createdByName`                             | `users.name` (por `userId`)          |

### 5.2 `GET /v1/billing/invoices/:id` — ampliar `InvoiceResponseDto`

| Campo                                       | Origen                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `currencyCode`                              | `currencies.code`                                                                                             |
| `branchName`                                | `branches`                                                                                                    |
| `orderId`, `orderCode`                      | `orders` (por `invoices.orderId`)                                                                             |
| `items[].productName`, `items[].productSku` | `products`                                                                                                    |
| `paidAmount`, `balance`, `daysOverdue`      | `paid_amount` (ya existe) y `total − paid` a la tasa del documento                                            |
| `payments[]`                                | `payment_allocations` → `payments` (`id`, `code`, `date`, `amount`, `currencyCode`, `exchangeRate`, `status`) |
| `creditNotes[]`                             | `credit_note_usages` → `credit_notes` (`id`, `code`, `total`, `status`, `availableAmount`)                    |
| `retentions[]`                              | `tax_retentions` (sólo compras: tipo, base, monto retenido)                                                   |
| `createdByName`                             | `users.name`                                                                                                  |

Sin endpoints nuevos: el detalle de venta, compra y facturación consumen **el mismo**
`GET /v1/billing/invoices/:id`; el tipo (`SALE`/`PURCHASE`) lo valida la ruta de la UI.

### 5.3 Endpoints ya disponibles que la ficha reutiliza

| Uso                         | Endpoint                                       | Permiso                           |
| --------------------------- | ---------------------------------------------- | --------------------------------- |
| Postear / anular factura    | `POST /billing/invoices/:id/post`, `/:id/void` | `finance:invoices:post` / `:void` |
| JSON fiscal                 | `GET /billing/invoices/:id/fiscal-json`        | `finance:invoices:view`           |
| Confirmar / cancelar pedido | `POST /orders/:id/confirm`, `/:id/cancel`      | `operations:orders:approve`       |
| Facturar pedido             | `POST /orders/:id/invoice`                     | `operations:orders:approve`       |
| Registrar pago (compra)     | enlace a `/finance/payables` con el documento  | `finance:payments:create`         |

## 6. UI/UX

### 6.1 Estructura de la ficha (común a los cuatro documentos)

```
┌ Cabecera: tipo + número + estado + acciones (Postear / Anular / Confirmar / Facturar / Imprimir)
│ Tercero: nombre + RIF · Sucursal · Almacén (si aplica) · Emitido por + fecha
├ Totales: Base imponible · IVA · IGTF · Total (moneda del documento · equivalente en base) · Pagado · Saldo
├ Líneas: SKU · Producto · Cantidad · Precio · Impuesto · Total   (en la moneda del documento)
├ Partes relacionadas: pedido ↔ factura, pagos aplicados, notas de crédito, retenciones
└ Pie: tasa congelada del documento + fecha, notas, folio fiscal
```

- **Moneda**: la del documento manda el símbolo; el total se muestra **dual** con la tasa del documento
  (regla 5 de `S-09`), nunca con la tasa de hoy.
- **Estados**: badge con el mismo mapa que los listados (`DRAFT`/`POSTED`/`PAID`/`VOID`/`CANCELLED`).
- **Acciones deshabilitadas** (no ocultas) cuando el estado no lo permite, con `title` del motivo; se
  **ocultan** sólo cuando falta el permiso.
- **Cargando / vacío / error**: skeleton de cabecera + líneas; 404 con enlace "volver al listado".
- **Responsive**: la tabla de líneas pasa a tarjetas en móvil; los totales quedan siempre visibles.
- **Imprimible**: `@media print` oculta sidebar/acciones y deja cabecera, líneas, totales y pie fiscal.

### 6.2 Rutas y navegación

| Documento | Ruta de detalle                        | Listado que enlaza           |
| --------- | -------------------------------------- | ---------------------------- |
| Pedido    | `/dashboard/operations/orders/[id]`    | Pedidos (`code` → ficha)     |
| Venta     | `/dashboard/operations/sales/[id]`     | Ventas (`code` → ficha)      |
| Compra    | `/dashboard/operations/purchases/[id]` | Compras (`factura` → ficha)  |
| Factura   | `/dashboard/finance/invoices/[id]`     | Facturación (`code` → ficha) |

`routeRequirement()` ya hereda el permiso del listado por prefijo, así que una URL escrita a mano queda
protegida sin cambios en `navigation.ts`. Cada ruta valida el tipo y responde 404 si el documento no
corresponde (p. ej. abrir una compra en `/sales/:id`).

### 6.3 Componentes

| Componente            | Responsabilidad                                                  |
| --------------------- | ---------------------------------------------------------------- |
| `DocumentShell`       | Layout, breadcrumb, estados de carga/error y slot de acciones    |
| `DocumentHeader`      | Tipo, número, estado, tercero, sucursal, fechas, autor           |
| `DocumentTotals`      | Base, IVA, IGTF, total dual, pagado, saldo, tasa congelada       |
| `DocumentLines`       | Líneas con SKU, producto, cantidad, precio, impuesto y total     |
| `DocumentRelated`     | Pedido ↔ factura, pagos aplicados, notas de crédito, retenciones |
| `DocumentActions`     | Botones por estado + permisos + confirmaciones                   |
| `DocumentPrintStyles` | Hoja `@media print` compartida                                   |

## 7. Reglas de negocio

1. **La ficha no recalcula nada**: muestra lo que el backend devolvió; el total dual usa
   `exchangeRate` del documento.
2. **Una compra no se postea desde Compras**: se ve el documento y se enlaza a CxP para pagar.
3. **Un pedido facturado no se vuelve a facturar**: si `invoiceId` existe, la acción "Facturar"
   desaparece y se muestra el enlace a la factura.
4. **Anular exige motivo** (diálogo existente) y sólo desde `POSTED`.
5. **Postear valida el estado** en el backend; la UI deshabilita y explica, nunca falla en silencio.
6. **El saldo se muestra en la moneda del documento** y su equivalente en base; nunca se suman
   monedas distintas.
7. **Ninguna acción nueva** requiere permisos nuevos: se reutiliza la matriz vigente (D-03/D-05 de
   `S-09`).

## 8. Criterios de aceptación

```gherkin
Escenario: abrir un pedido desde el listado
  Dado un pedido DRAFT con 2 líneas
  Cuando hago clic en su código
  Entonces veo cabecera, líneas con nombre y SKU, total dual y las acciones Confirmar/Cancelar/Editar

Escenario: pedido ya facturado
  Dado un pedido con factura asociada
  Cuando abro su ficha
  Entonces no veo la acción "Facturar"
  Y veo el enlace a la factura generada

Escenario: factura en borrador se postea desde la ficha
  Dado una factura DRAFT y un usuario con finance:invoices:post
  Cuando pulso "Postear" y confirmo
  Entonces el estado pasa a POSTED sin salir de la ficha
  Y los totales se mantienen idénticos

Escenario: saldo de una factura con pagos en otra moneda
  Dado una factura USD 100 a tasa 36,50 con un pago de 1.825,00 VES a tasa 36,50
  Cuando abro su ficha
  Entonces veo Pagado USD 50,00 y Saldo USD 50,00
  Y el equivalente en Bs usa la tasa de la factura, no la del día

Escenario: venta fuera de su ruta
  Dado una compra (PURCHASE)
  Cuando abro /dashboard/operations/sales/<id>
  Entonces recibo una pantalla 404 con enlace al listado de Ventas

Escenario: impresión
  Cuando imprimo la ficha
  Entonces se ocultan sidebar y acciones
  Y se imprimen cabecera, líneas, totales y pie fiscal
```

## 9. Plan de tareas

### F1 · Base compartida y backend

| ID      | Tarea                                                                                                             | Artefactos                                                           | Verificación                                              | Talla |
| ------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ----- |
| T-10-01 | Ampliar `GET /orders/:id`: tercero, almacén, sucursal, moneda, nombres de producto y factura asociada             | `orders.service.ts`, `orders.dto.ts`                                 | unit: pedido facturado trae `invoiceCode`                 | M     |
| T-10-02 | Ampliar `GET /billing/invoices/:id`: moneda, sucursal, pedido, pagos, notas aplicadas, retenciones, saldo y autor | `billing.service.ts`, `billing.dto.ts`                               | integración: factura USD con pago VES trae saldo correcto | L     |
| T-10-03 | Tipos de la ficha en `shared-types` + clientes `ordersApi.getDetail`, `invoicesApi.getDetail`                     | `packages/shared-types`, `modules/orders/*`, `modules/finance/api/*` | typecheck falla si el contrato cambia                     | S     |
| T-10-04 | Componentes compartidos `DocumentShell`, `DocumentHeader`, `DocumentTotals`, `DocumentLines`                      | `modules/documents/components/*` (nuevo)                             | storybook manual: cabecera con estado y dual              | L     |
| T-10-05 | `DocumentActions` + `DocumentRelated` + `ConfirmDialog` reutilizable                                              | `modules/documents/components/*`                                     | acciones deshabilitadas con motivo                        | M     |

### F2 · Facturación y ventas

| ID      | Tarea                                                             | Artefactos                                                    | Verificación                   | Talla |
| ------- | ----------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------ | ----- |
| T-10-06 | Ruta `/finance/invoices/[id]` con la ficha completa               | `app/.../finance/invoices/[id]/page.tsx`, `InvoiceDetailView` | abre factura SALE y PURCHASE   | M     |
| T-10-07 | Ruta `/operations/sales/[id]` reutilizando la ficha con tipo SALE | `app/.../operations/sales/[id]/page.tsx`                      | 404 si el documento no es SALE | S     |
| T-10-08 | Enlazar el `code` de ambos listados a su ficha y añadir "Volver"  | `invoices-view` (ambos), `orders/api.ts`                      | clic en código abre la ficha   | S     |

### F3 · Compras

| ID      | Tarea                                                                               | Artefactos                                   | Verificación                                | Talla |
| ------- | ----------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- | ----- |
| T-10-09 | Ruta `/operations/purchases/[id]` con número de factura del proveedor y retenciones | `app/.../operations/purchases/[id]/page.tsx` | muestra `supplierInvoiceNumber` y retención | M     |
| T-10-10 | Enlace desde la tabla de Compras y desde CxP al documento                           | `purchases-view.tsx`, `payables-view.tsx`    | dos caminos llegan a la misma ficha         | S     |

### F4 · Pedidos

| ID      | Tarea                                                                    | Artefactos                                | Verificación                         | Talla |
| ------- | ------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------ | ----- |
| T-10-11 | Ruta `/operations/orders/[id]` con líneas, total dual y factura asociada | `app/.../operations/orders/[id]/page.tsx` | pedido facturado enlaza a su factura | M     |
| T-10-12 | Acciones Confirmar / Cancelar / Facturar desde la ficha                  | `DocumentActions`, `orders-api.ts`        | confirmar deja el pedido CONFIRMED   | M     |
| T-10-13 | Enlace del código del pedido a la ficha                                  | `orders-view.tsx`                         | —                                    | S     |

### F5 · Impresión y fiscal

| ID      | Tarea                                                       | Artefactos                                | Verificación                        | Talla |
| ------- | ----------------------------------------------------------- | ----------------------------------------- | ----------------------------------- | ----- |
| T-10-14 | Hoja `@media print` y botón "Imprimir" en las cuatro fichas | `DocumentPrintStyles`, `app/globals.css`  | vista previa sin sidebar ni botones | S     |
| T-10-15 | Pestaña "Fiscal" con el JSON fiscal en facturas emitidas    | `DocumentRelated`, `GET /:id/fiscal-json` | JSON visible y descargable          | S     |

### F6 · QA y documentación

| ID      | Tarea                                                                   | Artefactos                                           | Verificación            | Talla |
| ------- | ----------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------- | ----- |
| T-10-16 | Casos `MG-41…MG-52` (ficha por documento) y `CT-21…CT-23` (dual, print) | `docs/qa/01-manager.md`, `docs/qa/00-transversal.md` | casos ejecutables       | M     |
| T-10-17 | Ejecución con evidencias y actualización de índices                     | `docs/qa/ejecuciones/`, `docs/qa/README.md`          | 0 fallas S1/S2 abiertas | M     |

## 10. Plan de pruebas

| Nivel       | Caso                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| Unitario    | `DocumentTotals` muestra dual con la tasa del documento y no con la tasa actual         |
| Unitario    | `DocumentActions` oculta acciones sin permiso y deshabilita las inválidas por estado    |
| Integración | `GET /orders/:id` de un pedido facturado incluye `invoiceCode`/`invoiceStatus`          |
| Integración | `GET /billing/invoices/:id` de una compra incluye retenciones y `supplierInvoiceNumber` |
| Integración | Saldo de factura con pago en otra moneda cuadra en la moneda del documento              |
| Integración | Ficha de otra sucursal responde 404                                                     |
| E2E         | Listado → ficha → postear → estado actualizado → imprimir                               |
| E2E         | Pedido → confirmar → facturar → ficha de la factura generada                            |

## 11. Riesgos

| Riesgo                                                       | Mitigación                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Duplicar la ficha en cuatro rutas con lógica divergente      | Un único `DocumentShell` + vista por tipo, sin copiar componentes      |
| Ampliar el detalle encarece el listado                       | Los campos nuevos sólo se calculan en `findOne`, nunca en los listados |
| Consultas N+1 al resolver productos y pagos                  | Resolución en lote con `inArray` (mismo patrón de `partnerName`)       |
| Imprimir con datos de otra sucursal por caché de React Query | `queryClient.clear()` ya se dispara al cambiar de sucursal (S-00)      |
| Ficha y listado muestran saldos distintos                    | El saldo se calcula en el backend; la UI no lo recalcula               |

## 12. Definition of Done

- Las cuatro rutas existen, están enlazadas desde su listado y protegidas por el permiso heredado.
- La ficha muestra moneda, tasa congelada, total dual, pagado y saldo cuando aplica.
- Las acciones funcionan sin salir de la ficha y respetan estado + permiso.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build` en verde; casos `MG-41…` ejecutados con
  evidencia en `docs/qa`.

## 13. Avance de ejecución

### 2026-10-30 · F1 completa y F2 completa

| Entregado                        | Detalle                                                                                                                                                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/orders/:id` enriquecido | `partnerName`, `partnerTaxId`, `branchName`, `warehouseName`, `currencyCode`, `createdByName`, `items[].productName/productSku` y `invoiceId/invoiceCode/invoiceStatus`.                                                                                       |
| `GET /v1/billing/invoices/:id`   | `currencyCode`, `branchName`, `warehouseName`, `orderCode`, `createdByName`, `daysOverdue`, `settlement {total, paid, credited, retained, settled, balance}` en moneda del documento, `payments[]`, `creditNotes[]`, `retentions[]` y `exchangeRate` numérica. |
| Componentes compartidos          | `modules/documents`: `DocumentShell`, `DocumentHeader`, `DocumentLines`, `DocumentTotals`, `DocumentRelated`, `DocumentActions` y `status.ts`.                                                                                                                 |
| Rutas                            | `/dashboard/finance/invoices/[id]` (ventas y compras) y `/dashboard/operations/sales/[id]` (sólo `SALE`; el resto muestra "no corresponde a esta pantalla").                                                                                                   |
| Listados                         | El código de Facturación y de Ventas enlaza a la ficha; botón "Volver" en la cabecera.                                                                                                                                                                         |
| Acciones en la ficha             | Postear (sólo `DRAFT`), anular con motivo (sólo `POSTED`) e imprimir; ocultas por permiso y deshabilitadas con motivo por estado.                                                                                                                              |

**Defecto corregido de paso (`DEF-024`):** los listados de Ventas y Facturación leían `invoice.issueDate`,
campo que el API no devuelve (envía `date`); al ser `undefined`, **todas las filas mostraban la fecha de
hoy**. Ahora la columna y la ficha muestran la fecha real del documento.

**Verificación:** 5 tests de integración nuevos (`src/test/document-detail.test.ts`: ficha de factura,
saldo en divisa con pago en bolívares, ficha de pedido con factura asociada y 404 de otra sucursal), 5 tests
de componentes (`documents.test.tsx`), 1085 tests de backend y 340 de frontend en verde. Comprobado en vivo:
`A-90005` muestra Proveedor Internacional, USD, retenciones IVA/ISLR y **saldo USD 800**; `A-90020` abre en
`/operations/sales/:id` con su fecha real (28/10/2026), líneas con SKU y total en VES; abrir una compra en
la ruta de ventas muestra la pantalla de "no corresponde".
Evidencia: [2026-10-30-ficha-venta.png](../qa/evidencias/manager/2026-10-30-ficha-venta.png).

**Pendiente:** F3 (ruta de Compras y enlaces desde CxP), F4 (ficha de pedido con confirmar/cancelar/facturar)
y F5 (hoja de impresión y pestaña fiscal).

### 2026-10-30 (continuación) · F3, F4 y F5 completas

| Entregado                  | Detalle                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ficha de compra            | `/dashboard/operations/purchases/[id]` con `expectedType="PURCHASE"`: muestra el número de factura del proveedor y sus comprobantes de retención.                                                            |
| Enlaces                    | El código de Compras y el de Cuentas por pagar abren la ficha; el pedido muestra su factura y la factura muestra su pedido de origen.                                                                        |
| Ficha de pedido            | `/dashboard/operations/orders/[id]`: líneas con SKU, total dual con la tasa del pedido y bloque "Factura generada" cuando existe.                                                                            |
| Acciones del pedido        | **Confirmar** (sólo `DRAFT`), **Facturar** (sólo confirmado y si no tiene factura) y **Cancelar** (oculto si ya está facturado, con motivo).                                                                 |
| `POST /orders/:id/invoice` | Dejó de ser un stub: crea la factura con `BillingService` (misma moneda y tasa del pedido), la enlaza por `invoices.orderId`, marca el pedido `COMPLETED` y responde `409` si se intenta facturar dos veces. |
| Impresión                  | Hoja `@media print` en `styles/globals.css`: oculta sidebar, su separador, la barra superior y `[data-print="hide"]`; el documento ocupa todo el ancho.                                                      |
| Pestaña fiscal             | Acción **JSON fiscal** (sólo documentos emitidos) con el JSON del SENIAT en diálogo, copiar y descargar.                                                                                                     |
| Contrato                   | `CreateOrderDto.branchId` pasa a opcional: la sucursal la impone la cabecera `x-branch-id`, igual que en facturas.                                                                                           |

**Verificación en vivo (MANAGER):**

- `A-90003` (compra) abre en `/operations/purchases/:id` con "Factura del proveedor 00005555", líneas, saldo y
  las acciones _JSON fiscal_ / _Imprimir_; el diálogo fiscal mostró `controlCode`, `invoiceNumber` y `serial`.
- Pedido `ORD-FICHA-5023`: borrador → **Confirmar** → **Facturar** → estado **Completado**, factura
  `A-90021` creada y enlazada; la ficha de la factura muestra **"Pedido de origen → ORD-FICHA-5023"**.
  Los datos de prueba se revirtieron por SQL.
- Impresión simulada (`emulateMedia('print')`) sobre la app compilada: sidebar, separador y barra superior
  con `display: none`, título del documento visible y `main` a ancho completo.
- Cobertura: 1084 tests de backend (incluye facturación de pedido y rechazo de doble facturación),
  340 de frontend, `eslint` sin errores.

Evidencia: [2026-10-30-ficha-pedido.png](../qa/evidencias/manager/2026-10-30-ficha-pedido.png).

**Estado de la épica:** `T-10-01…T-10-15` entregadas. Queda `T-10-16`/`T-10-17` (casos `MG-41…MG-52` y
`CT-21…CT-23` con su bitácora).
