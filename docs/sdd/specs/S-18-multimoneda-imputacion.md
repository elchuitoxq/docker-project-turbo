# S-18 — Imputación multimoneda de cobros y pagos

| Campo      | Valor                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| Estado     | Implementado                                                                     |
| Prioridad  | P0                                                                               |
| Alcance    | `apps/backend` (tesorería, facturación, contabilidad), `apps/frontend`, semillas |
| Depende de | S-03, S-05, S-08, S-16, S-17                                                     |
| Fecha      | 2026-10-31                                                                       |

## 1. Contexto

`S-08` dejó la facturación multimoneda: cada documento nace con su moneda y con la tasa **congelada**
del día de emisión (`invoices.exchange_rate`). Lo que quedó a medias fue el **cobro y el pago**: la
imputación guardaba `amount` (importe del pago) y `amount_base` (su valor en moneda funcional), pero el
saldo del documento se derivaba dividiendo `amount_base` entre la tasa congelada de la factura. Con
tres consecuencias reales:

1. **Sobre-imputación al cambiar la tasa.** Factura de 100 USD a 36,50 (3.650 Bs). Si el cliente paga
   al día siguiente con la tasa a 40, el cobro vale 4.000 Bs, pero el sistema imputaba
   `4.000 / 36,5 = 109,59 USD`: la factura se cerraba con 9,59 USD de "regalo".
2. **Cuentas mezcladas.** El pago no indicaba cuenta bancaria (la UI nunca enviaba `bankAccountId`), y
   nada impedía cobrar en dólares sobre una cuenta en bolívares. El saldo bancario se movía con el
   importe "pelado", sin validar la moneda de la cuenta: el extracto dejaba de conciliar.
3. **Resultado cambiario invisible.** La diferencia entre la tasa del pago y la de la factura no se
   registraba en ninguna parte: ni en la imputación ni en el asiento.

La regla de negocio que fija esta spec, en palabras del usuario: **si se paga en dólares, entra a una
cuenta en dólares a la tasa del día; si se paga en bolívares, entra a una cuenta en bolívares. No se
mezclan monedas en un mismo saldo, y la factura —que es multimoneda— rebaja su saldo en SU moneda, se
cobre en la moneda que se cobre.**

## 2. Objetivo

1. Una imputación guarda el importe en **las dos monedas**: la del pago y la del documento.
2. El saldo de la factura baja siempre en la moneda del documento.
3. La cuenta bancaria es obligatoria cuando el método afecta saldo, y su moneda debe coincidir con la
   del pago.
4. La diferencia cambiaria se calcula, se guarda por imputación y se contabiliza.
5. Anular un cobro/pago revierte saldo del documento, saldo bancario y asiento.

## 3. Reglas de cálculo

| Caso                                  | Imputación (`invoice_amount`)                                          | Diferencia cambiaria (`amount_base − invoice_amount × tasa_factura`) |
| ------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Pago y factura en la **misma** moneda | `= amount` (a la par)                                                  | Resultado de valorar el pago a la tasa del día                       |
| Pago y factura en **distinta** moneda | `= amount_base / tasa_de_la_moneda_de_la_factura_en_la_fecha_del_pago` | Resultado de cobrar a la tasa del día contra la tasa congelada       |

Notas:

- La tasa de conversión es la **vigente en la fecha del pago** de la moneda de la factura, no la
  congelada del documento. Si la moneda de la factura es la funcional (Bs), la tasa es 1.
- `invoice_amount` es la unidad de `invoices.total`: sumar `Σ invoice_amount` de las imputaciones
  `POSTED` da el pagado en moneda del documento.
- La diferencia cambiaria suma por imputación en `payment_allocations.exchange_difference_base` y su
  total se copia a `payments.metadata.exchangeDifference` para consulta rápida.

## 4. Modelo de datos (`0027_payment_allocation_multicurrency`)

`payment_allocations` gana tres columnas:

| Columna                    | Tipo             | Uso                                                              |
| -------------------------- | ---------------- | ---------------------------------------------------------------- |
| `invoice_amount`           | `numeric(20,2)`  | Importe imputado **en la moneda del documento**                  |
| `exchange_rate`            | `numeric(20,10)` | Tasa aplicada al pago (la de la moneda de la cuenta en su fecha) |
| `exchange_difference_base` | `numeric(20,2)`  | Resultado cambiario de la imputación, en moneda funcional        |

Las filas anteriores a la migración se rellenan copiando `amount` en `invoice_amount`, salvo las de
moneda distinta a la del documento, que se convierten con la tasa congelada de la factura (el mejor
dato disponible). `amount` y `amount_base` se conservan: el asiento los sigue necesitando.

## 5. Cambios en el backend

### 5.1 Tesorería (`treasury.service.ts`)

- `resolveBankAccountForPayment()`: si el método está en `PAYMENT_METHODS_BALANCE_AFFECTING`
  (`CASH_USD`, `CASH_VES`, `POS`, `ZELLE`, `TRANSFER`) **exige** `bankAccountId`; valida sucursal,
  que esté activa y que `bank_accounts.currency_id === payments.currency_id`.
- `PaymentAllocationPlan`: calcula antes de escribir `amountBase`, `invoiceAmount`, `invoiceRate` y
  `exchangeDifference`; rechaza la asignación que supere el saldo real del documento.
- El saldo de la cuenta se mueve **en su propia moneda** (`currentBalance ± amount`).
- `recordPaymentEvents()` informa en el histórico en las dos monedas:
  `Cobro PAY-000006 por 2389.6 VES (59.74 USD) del cliente`.
- `refreshInvoiceBalance()` acepta `resetWhenEmpty` para que la anulación devuelva la factura a
  `POSTED` cuando ya no queda nada aplicado.
- `voidPayment()`: revierte el saldo de **todas** las facturas imputadas (no solo `payment.invoiceId`),
  recalcula su estado y anula el asiento del pago.

### 5.2 Facturación (`invoice-balance.ts`)

`paid = Σ invoice_amount` de las imputaciones `POSTED`; además, **toda** nota de crédito `POSTED`
emitida contra la factura rebaja el saldo (antes solo se filtraban las de tipo `PURCHASE`, así que una
devolución a cliente no cerraba la factura).

### 5.3 Contabilidad (`accounting.service.ts`)

- `applyMapToPayment()` agrega la línea de resultado cambiario contra `6.1.3.001`: **crédito** si es
  ganancia (el cobro valió más que lo que estaba en libros), **débito** si es pérdida. Sin esa línea la
  partida doble no cuadra.
- Si la cuenta `6.1.3.001` no existe y hay diferencia, falla con un mensaje explícito en vez de dejar
  un "no cuadra" sin contexto.
- `cancelEntryBySource()` marca el asiento como `CANCELLED` al anular el pago (se conserva la traza y
  el mayor deja de sumarlo, porque filtra `POSTED`).
- El cobro/pago se contabiliza automáticamente al registrarse; si el mapeo o el período fallan, se
  registra un `WARN` con el código del pago y la operación sigue (misma política que nómina).

## 6. Cambios en el frontend

`payment-dialog.tsx` se reescribió alrededor de la cuenta:

1. Se elige **primero la cuenta**; de ella salen la moneda del pago y la tasa del día.
2. El importe sugerido es el saldo del documento convertido a la moneda de la cuenta
   (`saldo × tasa_factura / tasa_cuenta`), recalculado al cambiar de cuenta.
3. La etiqueta del monto y el desglose dual usan la moneda de la cuenta.
4. Se envía `bankAccountId` (antes nunca se enviaba) y `allocations` con el importe en moneda del pago;
   el backend hace la conversión a moneda del documento.
5. `invoice-detail-view.tsx` y `payables-view.tsx` pasan `invoiceRate` (tasa congelada del documento).

## 7. Semillas y gate

| Ajuste (`seed-test.ts`)                                                                            | Motivo                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `seedTransactionAccountingMaps()` (INVOICE/PAYMENT, cuentas `1.1.1.002`, `1.1.2.001`, `6.1.3.001`) | sin mapeo no hay asiento: el circuito contable no se probaba |
| Imputaciones con `invoiceAmount`/`exchangeRate`/`exchangeDifferenceBase`                           | la semilla usa las mismas columnas que el runtime            |
| Pagos a proveedor a la cuenta USD de la sucursal (`accUsd1`)                                       | un pago en divisa no puede tocar una cuenta en bolívares     |
| Saldos iniciales por cuenta (5.000 / 2.000 / 12.000 / 8.000)                                       | `current_balance = initial_balance + movimientos POSTED`     |
| `recalculateBankBalances()` filtra por moneda de la cuenta                                         | evita mezclar importes de monedas distintas al recalcular    |
| `recalculateInvoiceBalances()` usa `invoice_amount`                                                | misma regla que el runtime                                   |

El gate (`seed-integrity.ts`) suma **4 reglas** nuevas, de 48 a 52:

1. Imputación sin `invoice_amount`.
2. Imputación cuya moneda de pago no coincide con la moneda de su cuenta.
3. Imputación con diferencia cambiaria distinta de `amount_base − invoice_amount × tasa_factura`.
4. Pago `POSTED` con método que afecta saldo y sin `bank_account_id`.

## 8. Criterios de aceptación

1. Factura en USD a tasa 36,50, pago mitad en Bs (a tasa 40) y mitad en USD: saldo final 0,00 y estado
   `PAID`.
2. `Σ invoice_amount` = total del documento; `paid_amount` en moneda del documento.
3. Pago en divisa sobre cuenta en bolívares ⇒ `400`.
4. Método que afecta saldo sin cuenta ⇒ `400`.
5. Saldo bancario = saldo inicial + movimientos confirmados **de su moneda**.
6. Asiento del pago equilibrado, con línea de diferencia cambiaria cuando exista.
7. Anular el pago devuelve la factura a `POSTED`, revierte el banco y deja el asiento `CANCELLED`.
8. Histórico del documento muestra el cobro en las dos monedas y la anulación.

## 9. Verificación ejecutada (2026-10-31)

Base recreada (`db:reset` + `db:migrate` + `db:seed:dev`) → **52/52 reglas**.

| Escenario                                                                 | Resultado                                                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Factura `A-00001`: 100 + IVA 16 + IGTF 3,48 = **119,48 USD** a tasa 36,50 | emitida                                                                                                    |
| Tasa del día llevada a 40,00                                              | override manual aceptado                                                                                   |
| Abono Bs `PAY-000006`: 2.389,60 VES a cuenta `VES-001`                    | `invoice_amount` 59,74 · diferencia cambiaria 209,09 · factura `PARTIAL`                                   |
| Abono USD `PAY-000007`: 59,74 USD a cuenta `USD-001`                      | `invoice_amount` 59,74 · diferencia cambiaria 209,09 · factura **`PAID`**                                  |
| Saldos de factura                                                         | total 119,48 · imputado 119,48 · **saldo 0,00**                                                            |
| Saldos bancarios                                                          | USD-001 5.000 → 5.519,74 USD · VES-001 12.000 → 14.389,60 Bs (sin mezclar monedas)                         |
| Asientos                                                                  | 2.389,60 = Clientes 2.180,51 + diferencia cambiaria 209,09 (por cada abono, cuadrados)                     |
| Histórico                                                                 | `Cobro PAY-000006 por 2389.6 VES (59.74 USD) del cliente` → `Cobro PAY-000007 por 59.74 USD del cliente`   |
| Rechazo cuenta cruzada (pago USD a cuenta VES)                            | `400 · La cuenta VES-001-123456 está en VES: un cobro/pago en otra moneda descuadra el saldo de la cuenta` |
| Rechazo sin cuenta (método `TRANSFER`)                                    | `400 · El método de pago afecta el saldo de una cuenta: indica la cuenta bancaria del cobro/pago`          |
| Anulación (`A-00002`, abono 2.000 Bs de 59,74 USD)                        | factura `POSTED` · pagado 0,00 · asiento `CANCELLED` · banco revertido · evento `Pago PAY-000009 anulado`  |
| `db:verify` con los documentos de prueba                                  | 52/52                                                                                                      |

Pruebas automatizadas: backend **1140**, database **55**, frontend **385**; `typecheck`, `lint` y
`build` en verde (4/4). La suite nueva es `apps/backend/src/test/treasury-multicurrency.test.ts`
(7 casos: conversión, paridad, rechazos, saldo bancario, tope de saldo y anulación con asiento).

## 10. Riesgos y trabajo futuro

- ~~**Asiento de la factura**: se genera sólo desde `POST /v1/accounting/entries/from-invoice/:id`~~
  → cerrado en [`S-19`](./S-19-asiento-fiscal-factura.md): se postea al emitir, con desglose de
  base/IVA/IGTF, y se anula con la factura.
- **IGTF al momento del pago**: hoy se calcula en la factura; en un ERP convive con el IGTF del pago en
  efectivo en divisa.
- ~~**`bank_account → cuenta contable`**: el asiento usa `1.1.1.002` "Banco moneda funcional" para todas
  las cuentas~~ → cerrado en [`S-19`](./S-19-asiento-fiscal-factura.md) con
  `bank_accounts.accounting_account_id`.
- **Vista de conciliación**: el mayor ya distingue banco, pero no hay una pantalla que compare mayor,
  tesorería y extracto; `S-05` dejó la importación y el emparejamiento, no la conciliación contable.
- **Recálculo masivo**: no hay endpoint que recalcule `paid_amount`/`current_balance` para toda la
  cartera después de una corrección manual.
- **Diferencia cambiaria de cuentas por cobrar en divisa** (revaluación de fin de mes): se registra al
  cobrar, no al cierre.
- **Redondeo de la imputación**: al imputar en la moneda del documento el importe se redondea a dos
  decimales; el residuo (≤ 0,005 × tasa) cae en resultado cambiario. El saldo del documento no deriva.
