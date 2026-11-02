# Flujos por rol: SELLER

**Cuenta:** `test-seller@test.local` / `Test1234!`
**Rol:** atención comercial. Consulta catálogo, clientes y ventas; **no** crea clientes ni emite
facturas desde la UI actual.

Precondición general: sesión iniciada con la cuenta SELLER, sucursal `Test Branch` activa.
Ver [README](./README.md#2-entorno-y-puesta-en-marcha).

## Menú esperado

Panel · Operaciones (Clientes y Proveedores, Ventas, Pedidos) · Inventario (Productos, Stock) ·
Finanzas (Facturación, Cuentas por pagar, Cierre diario) · Configuración (Sucursales).

Sin Compras, sin Almacenes/Movimientos, sin RRHH.

## Casos

| #     | Caso                             | Pasos                                                                                                                                      | Resultado esperado                                                                                                                                                                                                              |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SL-01 | Panel de inicio                  | Abrir `/dashboard`.                                                                                                                        | KPIs, gráfico y actividad reciente cargan con datos de `Test Branch`. Sin pantalla vacía.                                                                                                                                       |
| SL-02 | Menú acotado                     | Revisar el sidebar completo.                                                                                                               | Coincide con el menú esperado de esta sección. **No** aparece Compras, ni Almacenes, ni Movimientos, ni RRHH, ni Tesorería/Notas de crédito/Préstamos/Reportes.                                                                 |
| SL-03 | Clientes y proveedores (lectura) | Operaciones → Clientes y Proveedores. Buscar por "Cliente" y por RIF; pulsar el nombre de un cliente.                                      | Listado con búsqueda y filtros. **No** hay botón "Nuevo" (falta `operations:partners:create`) ni editar/eliminar. El nombre no navega al estado de cuenta y la API lo rechaza sin `operations:partners:statement`.              |
| SL-04 | Ventas                           | Operaciones → Ventas.                                                                                                                      | Listado de facturas de venta con búsqueda por código/partner y filtro por estado (Borrador, Emitida, Anulada). Sin acciones por fila.                                                                                           |
| SL-05 | Botón "Nueva venta"              | Pulsar "Nueva venta".                                                                                                                      | No existe formulario de alta: se permanece en la misma lista (hallazgo conocido #2). Registrar el comportamiento real.                                                                                                          |
| SL-06 | Pedidos                          | Operaciones → Pedidos.                                                                                                                     | Se listan los 5 pedidos con tipo Venta/Compra y estados. Sin acciones de aprobación.                                                                                                                                            |
| SL-07 | Productos (catálogo)             | Inventario → Productos. Buscar `ELEC`.                                                                                                     | Listado con SKU, nombre, precio y categoría. **No** aparecen "Nuevo producto" ni acciones de edición/eliminación.                                                                                                               |
| SL-08 | Stock disponible                 | Inventario → Stock. Alternar almacenes.                                                                                                    | Cantidades por almacén correctas y alerta de mínimo cuando aplica. Sin acciones.                                                                                                                                                |
| SL-09 | Facturación (lectura)            | Finanzas → Facturación. Buscar `INV-000001`, filtrar Borrador/Emitida/Anulada.                                                             | Listado correcto, sin botón de alta (el formulario de factura no existe todavía). **No** debe ofrecer "Emitir" ni "Anular" (faltan `finance:invoices:post`/`void`).                                                             |
| SL-10 | Cuentas por pagar (lectura)      | Finanzas → Cuentas por pagar.                                                                                                              | Se listan facturas de compra con antigüedad. **No** aparece "Registrar pago" (falta `finance:payments:create`). Anotar si la visibilidad del módulo de proveedores para un vendedor es deseable (posible hallazgo de permisos). |
| SL-11 | Cierre diario (lectura)          | Finanzas → Cierre diario.                                                                                                                  | Se ve el estado del día. **No** aparece "Cerrar día" (falta `finance:treasury:create_account`). Anotar la visibilidad del módulo (posible hallazgo de permisos).                                                                |
| SL-12 | Rutas prohibidas                 | Abrir por URL `/dashboard/operations/purchases`, `/dashboard/inventory/warehouses`, `/dashboard/hr/payroll`, `/dashboard/finance/reports`. | Las cuatro redirigen a `/forbidden?reason=no-permission`.                                                                                                                                                                       |
| SL-13 | Configuración                    | Configuración → Sucursales.                                                                                                                | Sólo Sucursales visible y en modo lectura. Sin Bancos, Impuestos, Métodos de pago ni Monedas.                                                                                                                                   |
| SL-14 | Panel BI por URL                 | Abrir `/dashboard/bi` manualmente.                                                                                                         | La URL redirige a `/dashboard`; ya no existe el panel duplicado que fallaba en runtime.                                                                                                                                         |

## Registro de ejecución

| #     | Estado | Observación / evidencia | Severidad |
| ----- | ------ | ----------------------- | --------- |
| SL-01 |        |                         |           |
| SL-02 |        |                         |           |
| SL-03 |        |                         |           |
| SL-04 |        |                         |           |
| SL-05 |        |                         |           |
| SL-06 |        |                         |           |
| SL-07 |        |                         |           |
| SL-08 |        |                         |           |
| SL-09 |        |                         |           |
| SL-10 |        |                         |           |
| SL-11 |        |                         |           |
| SL-12 |        |                         |           |
| SL-13 |        |                         |           |
| SL-14 |        |                         |           |
