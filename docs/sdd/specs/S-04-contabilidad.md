# S-04 — Contabilidad y cierre de período

| Campo          | Valor                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| **Estado**     | ✅ Implementada (T-04-01 … T-04-09)                                            |
| **Prioridad**  | 🟠 P1                                                                          |
| **Depende de** | S-00, S-01                                                                     |
| **Épica**      | E4 · **Fuente:** `audit-report/02-BACKEND` (módulo Accounting) y `04-DATABASE` |

> **Nota de implementación (2026-10-27):** los permisos se crearon con prefijo `finance:` y no
> `accounting:` (`finance:accounts:*`, `finance:entries:*`, `finance:close:*`) para no romper el
> agrupamiento por módulo del RBAC; `finance:reports:view` ya existía. La naturaleza de cuenta usa
> `ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE | COST | ORDER` (migración `0013` normalizó los
> datos) y el plan base se siembra con `seed-chart-of-accounts.ts`.

---

## 1. Problema

El backend tiene plan de cuentas, asientos, líneas, mapeos y generación desde factura/pago, pero
**no hay ninguna pantalla** y no existe cierre de período ni estados financieros. En la práctica la
contabilidad no se puede operar; `finance/reports` llama endpoints inexistentes.

## 2. Alcance

1. **Plan de cuentas**: CRUD jerárquico (`accounting_accounts`) con tipo, naturaleza, imputable.
2. **Asientos**: manuales (con validación de partida doble) y automáticos por evento
   (factura, pago, retención, nómina, movimiento de inventario).
3. **Mapeos** (`accounting_maps`): qué cuenta usar por tipo de operación y sucursal.
4. **Cierre de período**: bloquear asientos con fecha ≤ cierre; reabrir con permiso y auditoría.
5. **Estados financieros**: balance de comprobación, balance general y estado de resultados
   (endpoints que el front ya espera: `balance-sheet`, `income-statement`).
6. **UI**: `finance/accounting/accounts`, `finance/accounting/entries`, cierre y reportes.

**No incluye:** activos fijos/depreciación, centros de costo y presupuestos (backlog).

## 3. Historias de usuario

| ID   | Historia                                                                          |
| ---- | --------------------------------------------------------------------------------- |
| HU-1 | Como contador mantengo el plan de cuentas sin tocar la base.                      |
| HU-2 | Como contador registro un asiento manual y el sistema valida debe = haber.        |
| HU-3 | Como contador veo los asientos generados por una factura y su origen.             |
| HU-4 | Como contador cierro el mes; nadie puede registrar asientos en ese período.       |
| HU-5 | Como gerente consulto balance general y estado de resultados por rango de fechas. |

## 4. Modelo de datos

| Tabla                           | Cambio                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `accounting_accounts`           | Ya existe: `code` único por empresa, `parentId`, `type`, `nature`, `isPostable` |
| `accounting_entries` / `_lines` | Ya existe: `sourceType`/`sourceId`, `periodId`, `status` (DRAFT/POSTED)         |
| `accounting_maps`               | Ya existe: clave `(companyId, operation, branchId?)` → cuentas                  |
| **Nueva** `accounting_periods`  | `companyId`, `year`, `month`, `status` (OPEN/CLOSED), `closedBy/At`             |
| Índices                         | `entries(company_id, entry_date)`, `lines(account_id, entry_id)`                |

## 5. Contrato HTTP

```
GET/POST/PATCH /v1/accounting/accounts          → ya existe; agregar validación jerárquica
GET/POST       /v1/accounting/entries           → ya existe; agregar ?from&to&sourceType
POST           /v1/accounting/entries/:id/post  → nuevo: DRAFT → POSTED
GET/PATCH      /v1/accounting/maps              → ya existe
GET            /v1/accounting/periods           → nuevo
POST           /v1/accounting/periods/:id/close → nuevo (permiso accounting:periods:close)
POST           /v1/accounting/periods/:id/reopen→ nuevo (auditado, motivo obligatorio)
GET            /v1/reports/balance-sheet?date=  → nuevo (activo/pasivo/patrimonio)
GET            /v1/reports/income-statement?from&to → nuevo (ingresos/costos/gastos/resultado)
GET            /v1/reports/trial-balance?from&to    → nuevo
```

Permisos: `accounting:accounts:manage`, `accounting:entries:create|post`,
`accounting:periods:close`, `accounting:reports:view`.

## 6. UI/UX

- Árbol de cuentas con búsqueda y edición inline; no permitir borrar cuentas con movimientos.
- Asiento: grilla de líneas con total en vivo (debe/haber), indicador rojo si no cuadra.
- Cierre: selector de período, resumen (asientos, débitos, créditos) y confirmación con texto.
- Reportes: filtros de fecha, exportación CSV/PDF y totales fijos al pie.

## 7. Reglas de negocio

1. `SUM(debe) = SUM(haber)` por asiento (validación en servicio **y** constraint diferido si es posible).
2. No se puede postear un asiento en un período cerrado (`409`).
3. Una cuenta imputable no puede tener hijas; una cuenta con movimientos no cambia de naturaleza.
4. Los asientos automáticos son idempotentes por `(sourceType, sourceId)`.
5. Reabrir un período exige motivo, permiso y deja registro en `audit_logs`.
6. Los reportes excluyen asientos `DRAFT`.

## 8. Criterios de aceptación (Gherkin)

```gherkin
Escenario: asiento descuadrado
  Cuando registro un asiento con debe 100 y haber 90
  Entonces recibe 400 y no se persiste

Escenario: período cerrado
  Dado el período 2026-10 cerrado
  Cuando intento postear un asiento con fecha 2026-10-15
  Entonces recibe 409

Escenario: asiento automático idempotente
  Dado una factura publicada
  Cuando se reintenta la generación del asiento
  Entonces no se duplica

Escenario: balance
  Cuando consulto balance-sheet al 2026-10-31
  Entonces activo = pasivo + patrimonio
```

## 9. Plan de pruebas

| Tipo        | Caso                                                            |
| ----------- | --------------------------------------------------------------- |
| Unitario    | Validación de partida doble, jerarquía de cuentas, idempotencia |
| Integración | Factura → asiento → balance; cierre y rechazo posterior         |
| E2E         | Contador crea asiento manual y lo ve en el balance              |
| Propiedad   | Para cualquier set de asientos, `activo = pasivo + patrimonio`  |

## 10. Riesgos

| Riesgo                          | Mitigación                                                      |
| ------------------------------- | --------------------------------------------------------------- |
| Datos históricos sin asientos   | Migración de apertura con asiento de saldo inicial por sucursal |
| Duplicar asientos al reintentar | Clave única `(sourceType, sourceId)`                            |
| Reportes lentos                 | Índices + consultas por período (nunca full scan)               |
