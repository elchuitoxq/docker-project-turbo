# S-01 — Reparar contratos roto (P0)

| Campo          | Valor                                         |
| -------------- | --------------------------------------------- |
| **Estado**     | ⬜ Especificada                               |
| **Prioridad**  | 🔴 P0                                         |
| **Depende de** | S-00 (para los endpoints nuevos con sucursal) |
| **Épica**      | E1                                            |

---

## 1. Problema

Hoy hay **≥15 llamadas del frontend que el backend no atiende** (404/405) o atiende con otro
nombre/verbo. Las pantallas de HR, inventario, reportes y cierre diario están parcialmente muertas.
Detalle completo en [`../01-gap-analysis.md`](../01-gap-analysis.md) §2.

## 2. Alcance

Tres frentes independientes, cada uno es un PR:

### A. HR (8 endpoints)

| Endpoint a crear/alinear                        | Notas                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `POST /v1/hr/employees/:id/terminate`           | Body `{ date, reason, cause }`; setea `status=TERMINATED`, `terminationDate` y registra auditoría |
| `PATCH /v1/hr/departments/:id`                  | Nombre, descripción, `parentId`, `managerId`                                                      |
| `PATCH /v1/hr/positions/:id`                    | Nombre, `departmentId`, `baseSalary`, `level`, `isActive`                                         |
| `POST /v1/hr/incidents/:id/approve` · `/reject` | Cambia `status`; sólo `PENDING`; audita                                                           |
| `POST /v1/hr/payroll/generate`                  | **Mantener** y hacer que el front llame este nombre                                               |
| `POST /v1/hr/payroll/:id/process`               | **Mantener** y alinear el front                                                                   |
| `POST /v1/hr/payroll/:id/pay`                   | Genera el pago en tesorería (`payments`) por el neto; marca `PAID`                                |
| `GET`/`PATCH /v1/hr/settings`                   | CRUD sobre `payroll_settings` (ver `S-02`)                                                        |

> Decisión: **no** se crean alias `/calculate` ni `/approve`; se corrige el cliente
> (`modules/hr/api.ts`) para usar los nombres reales. Menos superficie, menos deuda.

### B. Inventario

| Cambio                                 | Detalle                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Rutas                                  | El front pasa a `/inventory/warehouses` (el backend ya es correcto)                                              |
| `GET /v1/inventory/warehouses/:id`     | Nuevo (con `branchId` validado)                                                                                  |
| `DELETE /v1/inventory/warehouses/:id`  | Nuevo: borrado lógico (`isActive=false`) sólo si no tiene stock ni movimientos                                   |
| `POST /v1/inventory/moves/:id/cancel`  | Alias explícito de `reject` para movimientos en `DRAFT` (o el front usa `reject`); **elegir uno** y documentarlo |
| `GET /v1/products/categories`          | El front se corrige (deja de llamar `/product-categories`)                                                       |
| `GET /v1/inventory/stock/:warehouseId` | Ya existe: agregar pantalla (ver `S-07`)                                                                         |

### C. Facturación, reportes y cierre

| Cambio                                                  | Detalle                                                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update de factura                                       | El front usa `PATCH` (API correcta)                                                                                                                     |
| `GET /v1/billing/invoices`                              | Agregar `type` (SALE/PURCHASE) **y** paginación `page`/`limit` con envoltura `{ data, total, page, limit }` (breaking: versionar en `API-CONTRACTS.md`) |
| `GET /v1/reports/balance-sheet?date`                    | Nuevo — depende de `S-04`; mientras tanto el front debe mostrar "no disponible" en vez de 404                                                           |
| `GET /v1/reports/income-statement?from&to`              | Ídem                                                                                                                                                    |
| `GET /v1/treasury/daily-close/:date`                    | Extender el existente con fecha                                                                                                                         |
| `POST /v1/treasury/daily-close/:date/close` · `/reopen` | Nuevos — dependen de `S-05`                                                                                                                             |
| `modules/orders/api.ts`                                 | Dejar de llamar `/billing/invoices`; usar `/orders`                                                                                                     |

**No incluye:** nuevas reglas de negocio; sólo alinear contratos y completar CRUDs faltantes.

## 3. Historias de usuario

| ID   | Historia                                                                                      |
| ---- | --------------------------------------------------------------------------------------------- |
| HU-1 | Como analista de HR puedo editar departamentos, cargos y aprobar incidencias sin errores 404. |
| HU-2 | Como almacenero puedo ver, crear y desactivar almacenes.                                      |
| HU-3 | Como facturador puedo filtrar por tipo y paginar facturas desde el servidor.                  |
| HU-4 | Como gerente, la pantalla de reportes me dice "no disponible" en lugar de romperse.           |

## 4. Modelo de datos

- `warehouses.isActive` ya existe → el "delete" es lógico.
- `employees.status`/`terminationDate` ya existen.
- `payroll_settings` ya existe (se explota en `S-02`).
- **Sin migraciones nuevas** salvo índices para paginación (`invoices(branch_id, status, type, created_at)`).

## 5. Contrato HTTP

- Todos los nuevos endpoints: `x-branch-id` obligatorio, `@RequirePermissions` según tabla:
  `hr:employees:edit`, `hr:departments:manage`, `hr:positions:manage`, `hr:incidents:approve`,
  `hr:payroll:process`, `hr:payroll:pay`, `inventory:warehouses:manage`, `billing:invoices:edit`.
- Errores: `400` DTO, `403` permisos/sucursal, `404` recurso, `409` estado inválido (p. ej. aprobar
  una incidencia ya resuelta).
- Swagger + `openapi:export` + `sync:types` en el mismo PR.

## 6. UI/UX

- Errores de estado (`409`) se muestran como toast con el motivo del backend.
- Estados vacíos y `skeleton` en tablas paginadas.
- El detalle de nómina y la ficha de empleado quedan para `S-02`/`S-07`.

## 7. Reglas de negocio

1. No se puede aprobar/rechazar una incidencia que no esté `PENDING`.
2. No se puede terminar un empleado con nómina abierta (`DRAFT`/`CALCULATED`): `409`.
3. Un almacén con stock ≠ 0 o movimientos no se desactiva: `409` con detalle.
4. Cambiar el `baseSalary` de un cargo **no** altera salarios ya registrados en empleados.
5. La paginación usa `createdAt DESC` estable con `id` como desempate.

## 8. Criterios de aceptación (Gherkin)

```gherkin
Escenario: editar departamento
  Dado un usuario con hr:departments:manage
  Cuando hace PATCH /v1/hr/departments/:id con { name: "Operaciones" }
  Entonces recibe 200 con el departamento actualizado
  Y la UI refleja el cambio sin recargar

Escenario: aprobar incidencia duplicada
  Dado una incidencia ya APPROVED
  Cuando se intenta aprobar de nuevo
  Entonces recibe 409

Escenario: desactivar almacén con stock
  Dado un almacén con 10 unidades
  Cuando se intenta DELETE
  Entonces recibe 409 y el almacén sigue activo

Escenario: facturas paginadas por tipo
  Cuando GET /v1/billing/invoices?type=PURCHASE&page=2&limit=20
  Entonces recibe { data: [...], total, page: 2, limit: 20 }
  Y todos los ítems son de tipo PURCHASE
```

## 9. Plan de pruebas

| Tipo        | Caso                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| Unitario    | Cada método nuevo del servicio (feliz + `409` + `403`)                        |
| Integración | Paginación con 25 facturas; almacén con stock; terminación con nómina abierta |
| E2E         | HR: editar cargo → recargar → persiste. Inventario: crear/desactivar almacén  |
| Contrato    | `openapi.json` contiene los 12 endpoints nuevos/corregidos                    |
| Regresión   | `rg "/product-categories                                                      | /warehouses\` | " apps/frontend` → 0 resultados |

## 10. Riesgos

| Riesgo                                                               | Mitigación                                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Cambiar el shape de `GET /billing/invoices` rompe `finance/invoices` | Un solo PR con backend + front; `API-CONTRACTS.md` actualizado; tests de la vista |
| `payroll/:id/pay` duplica pagos                                      | Idempotencia por `payrollRunId` único en `payments`                               |
| Alias `cancel` vs `reject`                                           | Elegir uno, documentarlo y borrar el otro del cliente                             |
