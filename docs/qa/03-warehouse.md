# Flujos por rol: WAREHOUSE

**Cuenta:** `test-warehouse@test.local` / `Test1234!`
**Rol:** operación de almacén. Consulta catálogo y stock, y **aprueba** movimientos de inventario.

Precondición general: sesión iniciada con la cuenta WAREHOUSE, sucursal `Test Branch` activa.
Ver [README](./README.md#2-entorno-y-puesta-en-marcha).

## Menú esperado

Panel · Inventario (Productos, Almacenes, Movimientos, Stock) · Configuración (Sucursales).

Sin Operaciones, sin Finanzas, sin RRHH.

## Preparación de datos (obligatoria para WH-05 y WH-06)

La semilla no crea movimientos de inventario y la UI no tiene alta de movimientos
(hallazgo conocido #11). Crear un movimiento en estado `EN_TRAMITE` por API con la propia cuenta
WAREHOUSE:

```bash
# 1. Token del rol
TOKEN=$(curl -s -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-warehouse@test.local","password":"Test1234!"}' | jq -r .accessToken)

# 2. Alta de una ENTRADA de 5 unidades de ELEC-001 en "Almacén Principal Caracas"
curl -s -X POST http://localhost:4000/v1/inventory/moves \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-branch-id: 00000000-0000-4000-8000-000000000010" \
  -d '{
    "type": "ENTRADA",
    "toWarehouseId": "00000000-0000-4000-8000-000000000020",
    "referenceNumber": "QA-WH-001",
    "note": "Movimiento creado para pruebas QA",
    "lines": [{ "productId": "00000000-0000-4000-8000-000000000400", "quantity": "5" }]
  }'
```

Alternativa sin `curl`: Swagger en <http://localhost:4000/docs> →
`POST /v1/auth/login` para obtener el token → botón _Authorize_ → `POST /v1/inventory/moves`
con el mismo cuerpo y la cabecera `x-branch-id`.

> Identificadores de referencia en el entorno actual:
> sucursal `Test Branch` = `…000010`; almacenes `Almacén Principal Caracas` = `…000020`,
> `Punto de Venta Caracas` = `…000021`, `Depósito Sur` = `…000024`, `Test Warehouse` = `…000060`;
> producto `ELEC-001` = `…000400`. Verificables con
> `docker exec mono-postgres psql -U myuser -d mydb -c "select id,name from warehouses;"`.

## Casos

| #     | Caso                           | Pasos                                                                                                                                                              | Resultado esperado                                                                                                                                                                            |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WH-01 | Panel de inicio                | Abrir `/dashboard`.                                                                                                                                                | KPIs y gráfico cargan. Los enlaces de KPI a módulos no permitidos (Empleados, Nómina, Facturación) caen en `/forbidden` (hallazgo conocido #9).                                               |
| WH-02 | Menú acotado                   | Revisar el sidebar.                                                                                                                                                | Sólo Panel, Inventario (4 ítems) y Configuración → Sucursales. **No** Operaciones, **no** Finanzas, **no** RRHH.                                                                              |
| WH-03 | Productos (lectura)            | Inventario → Productos. Buscar `HOG`.                                                                                                                              | Listado correcto con SKU, precio y categoría. **No** hay "Nuevo producto", editar ni eliminar.                                                                                                |
| WH-04 | Almacenes (lectura)            | Inventario → Almacenes.                                                                                                                                            | Se listan los 4 almacenes de la sucursal con dirección/estado. **No** hay "Nuevo almacén" ni edición (falta `inventory:warehouses:create`/`edit`).                                            |
| WH-05 | Movimientos: listado y filtros | Inventario → Movimientos. Aplicar filtros de tipo (Entrada/Salida/Transferencia/Ajuste) y estado (Borrador/Aprobado/Rechazado/Cancelado); buscar por código o SKU. | El movimiento creado en la preparación aparece con su tipo (Entrada), producto y SKU, almacén, cantidad y estado (Borrador); los contadores por tipo cuadran y los filtros acotan el listado. |
| WH-06 | Aprobar movimiento             | En el movimiento `QA-WH-001` (o el código generado) usar "Aprobar".                                                                                                | Confirmación y toast de éxito; el estado pasa a aprobado y luego **Inventario → Stock → Almacén Principal Caracas** refleja +5 unidades de `ELEC-001`.                                        |
| WH-07 | Stock por almacén              | Inventario → Stock. Recorrer los 4 almacenes; activar el filtro de stock bajo.                                                                                     | Cantidades coherentes; productos bajo mínimo resaltados; el filtro reduce el listado.                                                                                                         |
| WH-08 | Rutas prohibidas               | Abrir por URL `/dashboard/finance/invoices`, `/dashboard/operations/partners`, `/dashboard/hr/employees`, `/dashboard/settings/banks`.                             | Todas redirigen a `/forbidden?reason=no-permission`.                                                                                                                                          |
| WH-09 | Configuración                  | Configuración → Sucursales.                                                                                                                                        | Sólo Sucursales, en modo lectura. Sin Bancos, Impuestos, Métodos de pago ni Monedas.                                                                                                          |
| WH-10 | Cambio de sucursal             | Cambiar a la segunda sucursal asignada y volver a Inventario → Stock / Movimientos.                                                                                | Los almacenes y movimientos corresponden a la sucursal elegida; al volver a `Test Branch` reaparecen los originales.                                                                          |
| WH-11 | Panel BI por URL               | Abrir `/dashboard/bi`.                                                                                                                                             | La URL redirige a `/dashboard` (el panel duplicado se retiró); no debe mostrarse ninguna pantalla de error.                                                                                   |
| WH-12 | Cierre de sesión               | Cerrar sesión y volver a entrar.                                                                                                                                   | Vuelve a `/login`; tras reingresar el menú sigue siendo el de WAREHOUSE.                                                                                                                      |

## Registro de ejecución

| #     | Estado | Observación / evidencia | Severidad |
| ----- | ------ | ----------------------- | --------- |
| WH-01 |        |                         |           |
| WH-02 |        |                         |           |
| WH-03 |        |                         |           |
| WH-04 |        |                         |           |
| WH-05 |        |                         |           |
| WH-06 |        |                         |           |
| WH-07 |        |                         |           |
| WH-08 |        |                         |           |
| WH-09 |        |                         |           |
| WH-10 |        |                         |           |
| WH-11 |        |                         |           |
| WH-12 |        |                         |           |
