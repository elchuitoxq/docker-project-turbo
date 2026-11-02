# Flujos por rol: ACCOUNTANT

**Cuenta:** `test-accountant@test.local` / `Test1234!`
**Rol:** contabilidad, tesorería y fiscalidad. Ejecuta pagos, asientos y cierres; **no** emite ni
anula facturas, y no tiene acceso a RRHH.

Precondición general: sesión iniciada con la cuenta ACCOUNTANT, sucursal `Test Branch` activa.
Ver [README](./README.md#2-entorno-y-puesta-en-marcha).

## Menú esperado

Panel · Operaciones (Clientes y Proveedores) · Inventario (Productos, Stock) · Finanzas
(Facturación, Cuentas por pagar, Notas de crédito, Préstamos, Tesorería, Cuentas bancarias,
Conciliación, Caja chica, Cierre diario, Retenciones, Contabilidad, Cierre contable, Reportes) ·
Configuración (Sucursales, Bancos, Métodos de pago, Impuestos).

Sin RRHH, sin Ventas/Pedidos/Compras.

## Casos

| #     | Caso                             | Pasos                                                                                                                                   | Resultado esperado                                                                                                                                                    |
| ----- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Panel de inicio                  | Abrir `/dashboard`.                                                                                                                     | KPIs, gráfico y actividad cargan con datos de la sucursal.                                                                                                            |
| AC-02 | Menú acotado                     | Revisar el sidebar completo.                                                                                                            | Coincide con el menú esperado: todas las vistas financieras, sólo _Clientes y Proveedores_ en Operaciones y **sin** grupo Recursos Humanos.                           |
| AC-03 | Facturación (sólo lectura)       | Finanzas → Facturación. Buscar `INV-000001` y filtrar por estado.                                                                       | Listado correcto. **No** hay "Nueva", "Emitir" ni "Anular" (faltan `finance:invoices:create`/`post`/`void`).                                                          |
| AC-04 | Cuentas por pagar y pago         | Finanzas → Cuentas por pagar. Localizar `A-90004` (parcial) → "Registrar pago" con cuenta, fecha y monto parcial.                       | Diálogo con saldo pendiente; al confirmar se actualiza el saldo/estado y aparece el pago en Tesorería. Si la tasa está vencida se exige confirmación (StaleRateGate). |
| AC-05 | Nota de crédito completa         | Finanzas → Notas de crédito: crear → emitir → aplicar → (en otra) anular.                                                               | Los cuatro pasos funcionan y los saldos se recalculan.                                                                                                                |
| AC-06 | Préstamos de equipos             | Finanzas → Préstamos: crear, aprobar y registrar devolución.                                                                            | Ciclo completo correcto; el stock/saldo del préstamo se cierra al devolver.                                                                                           |
| AC-07 | Tesorería                        | Finanzas → Tesorería. Filtrar por tipo y estado; buscar `PAY-`.                                                                         | Listado y filtros correctos. "Nuevo pago" sin acción (hallazgo #3). **No** debe permitir anular pagos (requiere `finance:invoices:void`).                             |
| AC-08 | Cuentas bancarias                | Finanzas → Cuentas bancarias → "Nueva cuenta".                                                                                          | La cuenta se crea y queda seleccionable en pago y conciliación.                                                                                                       |
| AC-09 | Conciliación bancaria            | Finanzas → Conciliación: seleccionar cuenta y rango, "Importar extracto", conciliar una sugerencia y deshacer.                          | Contadores correctos; conciliar bloquea el pago para otra línea; deshacer lo libera.                                                                                  |
| AC-10 | Caja chica                       | Finanzas → Caja chica: abrir fondo, "Registrar gasto", "Cerrar fondo".                                                                  | El gasto reduce el disponible y el cierre bloquea nuevos movimientos.                                                                                                 |
| AC-11 | Cierre diario                    | Finanzas → Cierre diario → "Cerrar día".                                                                                                | Cierre registrado; el día queda cerrado y sin nuevas acciones.                                                                                                        |
| AC-12 | Retenciones                      | Finanzas → Retenciones. Filtrar y abrir un comprobante.                                                                                 | Listado y detalle de retenciones de la sucursal; sin acciones de emisión si no hay permiso de gestión.                                                                |
| AC-13 | Plan de cuentas: alta y edición  | Finanzas → Contabilidad → "Nueva cuenta" (con cuenta madre). Luego "Hacer imputable"/"Dejar de imputar".                                | La cuenta se crea heredando naturaleza de la madre; el cambio de imputabilidad se refleja en el árbol.                                                                |
| AC-14 | Asiento contable                 | Finanzas → Contabilidad → Asientos → "Nuevo". Registrar un asiento descuadrado (débito ≠ crédito) y luego uno cuadrado; "Contabilizar". | El descuadrado se rechaza con mensaje claro; el cuadrado se guarda como borrador y al contabilizar pasa a contabilizado y aparece en reportes.                        |
| AC-15 | Cierre de período                | Finanzas → Contabilidad → Cierre y reportes. Cerrar el mes actual y reabrirlo indicando motivo.                                         | Cerrar bloquea asientos del período; reabrir exige motivo y queda auditado. Balance y estado de resultados coherentes.                                                |
| AC-16 | Reportes fiscales                | Finanzas → Reportes. Seleccionar período, revisar validación, abrir "Libro de ventas" y "Libro de compras", "Exportar CSV".             | Los libros cargan con datos; el CSV se descarga con el período elegido.                                                                                               |
| AC-17 | RRHH fuera de alcance            | Intentar `/dashboard/hr/employees` y `/dashboard/hr/payroll` por URL; pulsar el KPI "Empleados activos".                                | Las rutas y el KPI terminan en `/forbidden` (el KPI es el hallazgo conocido #9).                                                                                      |
| AC-18 | Configuración                    | Configuración → Sucursales, Bancos, Impuestos, Métodos de pago.                                                                         | Sucursales en lectura; Bancos e Impuestos como stub (hallazgo #4); Métodos de pago permite alta. Sin Usuarios/Roles/Monedas/Auditoría.                                |
| AC-19 | Panel BI por URL                 | Abrir `/dashboard/bi`.                                                                                                                  | La URL redirige a `/dashboard`; ya no existe el panel duplicado que fallaba en runtime.                                                                               |
| AC-20 | Clientes y proveedores (lectura) | Operaciones → Clientes y Proveedores: buscar por RIF y pulsar el nombre de un cliente.                                                  | Listado sin acciones de alta/edición (falta `operations:partners:create`/`edit`). El nombre abre el estado de cuenta con saldos (hallazgo #10).                       |

## Registro de ejecución

| #     | Estado | Observación / evidencia | Severidad |
| ----- | ------ | ----------------------- | --------- |
| AC-01 |        |                         |           |
| AC-02 |        |                         |           |
| AC-03 |        |                         |           |
| AC-04 |        |                         |           |
| AC-05 |        |                         |           |
| AC-06 |        |                         |           |
| AC-07 |        |                         |           |
| AC-08 |        |                         |           |
| AC-09 |        |                         |           |
| AC-10 |        |                         |           |
| AC-11 |        |                         |           |
| AC-12 |        |                         |           |
| AC-13 |        |                         |           |
| AC-14 |        |                         |           |
| AC-15 |        |                         |           |
| AC-16 |        |                         |           |
| AC-17 |        |                         |           |
| AC-18 |        |                         |           |
| AC-19 |        |                         |           |
| AC-20 |        |                         |           |
