# S-05 — Tesorería y cobranzas

| Campo          | Valor                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| **Estado**     | ✅ Implementada (T-05-01 … T-05-09)                                       |
| **Prioridad**  | 🟡 P2                                                                     |
| **Depende de** | S-00, S-01 (C)                                                            |
| **Épica**      | E5 · **Fuente:** `audit-report/07-TESORERIA-BILLING-LOGIC.md`, `06-BANKS` |

---

## 1. Problema

Hay pagos, cuentas y anulación, pero faltan las piezas operativas: **métodos de pago**, **alta/edición
de cuentas bancarias**, **cierre diario con fecha**, **conciliación** y un **estado de cuenta con
rango de fechas**. El frontend llama endpoints de cierre diario que no existen.

## 2. Alcance

1. **Métodos de pago** (`payment_methods`): CRUD, código especial (efectivo, transferencia, PagoMóvil,
   Zelle, divisa) y bandera `appliesIgtf`.
2. **Cuentas bancarias**: CRUD por sucursal con banco, número, moneda, saldo inicial.
3. **Cierre diario**: abrir/cerrar/reabrir por fecha y sucursal; bloquea pagos con fecha cerrada.
4. **Conciliación bancaria**: importar líneas de extracto (CSV) y conciliar contra pagos/cobros.
5. **Estado de cuenta de partner** con `from`/`to`, saldo inicial, movimientos y saldo final.
6. **Caja chica** (fondo fijo): apertura, rendiciones y reposición (nuevo).
7. **UI**: `settings/methods`, `treasury/accounts`, `treasury/daily-close` (extendida),
   `treasury/reconciliation`, `treasury/statements/[partnerId]`.

**No incluye:** integración automática con bancos (sólo importación CSV) ni conciliación de tarjetas.

## 3. Historias de usuario

| ID   | Historia                                                                              |
| ---- | ------------------------------------------------------------------------------------- |
| HU-1 | Como administrador creo métodos de pago y cuentas bancarias por sucursal.             |
| HU-2 | Como cajero cierro la caja del día y el sistema no permite nuevos pagos en esa fecha. |
| HU-3 | Como tesorero importo el extracto y marco qué pagos están conciliados.                |
| HU-4 | Como vendedor envío al cliente su estado de cuenta por rango de fechas.               |
| HU-5 | Como cajero administro la caja chica con rendiciones y reposición.                    |

## 4. Modelo de datos

| Tabla                                                 | Cambio                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `payment_methods`                                     | Existe: agregar `appliesIgtf`, `requiresReference`, `isCash`                       |
| `bank_accounts`                                       | Existe: `branchId` obligatorio, `initialBalance`, `currencyId`                     |
| **Nueva** `daily_closes`                              | `branchId`, `date`, `status` (OPEN/CLOSED), `closedBy/At`, `totals jsonb`, `notes` |
| **Nueva** `bank_statement_lines`                      | `bankAccountId`, `date`, `amount`, `reference`, `matchedPaymentId`                 |
| **Nueva** `petty_cash_funds` + `petty_cash_movements` | Fondo, responsable, movimientos                                                    |
| `payments`                                            | `reference`, `bankStatementLineId` (conciliación)                                  |

## 5. Contrato HTTP

```
GET/POST/PATCH /v1/treasury/methods             → ya existe; completar PATCH y desactivación
GET/POST/PATCH /v1/treasury/bank-accounts       → ya existe; agregar PATCH y saldo
GET            /v1/treasury/daily-close/:date   → nuevo (con fecha y sucursal)
POST           /v1/treasury/daily-close/:date/close   → nuevo
POST           /v1/treasury/daily-close/:date/reopen  → nuevo (motivo + permiso)
POST           /v1/treasury/reconciliation/import     → CSV → bank_statement_lines
POST           /v1/treasury/reconciliation/:lineId/match   → vincula pago/cobro
GET            /v1/treasury/statements/:partnerId?from&to  → extiende el actual
GET/POST       /v1/treasury/petty-cash                  → fondo y movimientos
```

Permisos: `treasury:methods:manage`, `treasury:accounts:manage`, `treasury:daily-close:close`,
`treasury:reconciliation:manage`, `treasury:statements:view`, `treasury:petty-cash:manage`.

## 6. UI/UX

- Cierre diario: tarjetas de totales por método, diferencia esperado vs contado, confirmación bloqueante.
- Conciliación: dos columnas (extracto | sistema) con matching sugerido por monto+fecha+referencia.
- Estado de cuenta: rango de fechas, saldo inicial/final, exportación PDF.

## 7. Reglas de negocio

1. No se registran pagos/cobros con fecha de un cierre `CLOSED` (`409`).
2. El cierre calcula totales por método y moneda; guarda un snapshot inmutable (`totals jsonb`).
3. Reabrir exige permiso, motivo y auditoría; recalcula el snapshot.
4. Una línea de extracto se concilia con **un** pago; desconciliar es explícito y auditado.
5. La caja chica nunca queda negativa; la reposición se registra como gasto.
6. El estado de cuenta incluye saldo inicial y todos los movimientos del rango (no sólo últimos N).

## 8. Criterios de aceptación (Gherkin)

```gherkin
Escenario: pago en día cerrado
  Dado el cierre del 2026-10-25 en CLOSED
  Cuando registro un pago con esa fecha
  Entonces recibe 409

Escenario: conciliación
  Dado un extracto con una línea de 500 el 2026-10-24
  Cuando la concilio con el pago P-123
  Entonces el pago queda marcado como conciliado
  Y la línea no puede conciliarse con otro pago

Escenario: estado de cuenta con rango
  Cuando consulto statements/:id?from=2026-10-01&to=2026-10-31
  Entonces recibo saldo inicial, movimientos ordenados y saldo final
```

## 9. Plan de pruebas

| Tipo        | Caso                                                                              |
| ----------- | --------------------------------------------------------------------------------- |
| Unitario    | Cálculo de totales de cierre, validación de día cerrado, matching de conciliación |
| Integración | Pago → cierre → intento de pago bloqueado → reapertura → pago permitido           |
| E2E         | Tesorero cierra el día y ve la diferencia                                         |
| Importación | CSV con formato inválido → error claro sin dejar líneas a medias (transacción)    |

## 10. Riesgos

| Riesgo                                   | Mitigación                                                          |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Cierres con datos incompletos            | Snapshot + estado `OPEN` hasta confirmación explícita               |
| Formatos de extracto distintos por banco | Parser por perfil de banco (configurable), empezar por CSV genérico |
| Cambios que invalidan cierres            | Reapertura auditada; nunca editar el snapshot en sitio              |
