# S-19 — Asiento fiscal de la factura y banco por cuenta contable

| Campo      | Valor                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| Estado     | Implementado                                                                     |
| Prioridad  | P0                                                                               |
| Alcance    | `apps/backend` (contabilidad, facturación, tesorería), `apps/frontend`, semillas |
| Depende de | S-04, S-08, S-18                                                                 |
| Fecha      | 2026-10-31                                                                       |

## 1. Contexto

`S-18` dejó el cobro y el pago cuadrando, con su diferencia cambiaria y la cuenta bancaria correcta.
Al certificarlo quedaron dos huecos del libro que impedían conciliar y leer bien el resultado:

1. **El asiento de la factura era de dos líneas.** Debitaba el total a Clientes y acreditaba el total
   a Ingresos. El IVA (16 %) y el IGTF (3 %) se contabilizaban como ingreso, así que el estado de
   resultados inflaba la venta y no existía pasivo por IVA ni por IGTF.
2. **Todo cobro entraba a `1.1.1.002` "Banco moneda funcional".** El mayor no distinguía de qué
   banco salió o entró el dinero: la conciliación por banco era imposible, y una cuenta en divisa
   también terminaba en el banco "funcional".

## 2. Objetivo

1. El asiento de la factura desglosa base, IVA e IGTF en sus cuentas.
2. Cada cuenta bancaria apunta a su cuenta del plan contable y el asiento del cobro/pago la usa.
3. El asiento se genera al emitir la factura y se anula al anularla.
4. El gate detecta una cuenta bancaria sin cuenta contable y un asiento de factura sin desglose.

## 3. Asiento de la factura (`createEntryFromInvoice`)

| Tipo   | Débito                                         | Crédito                                           |
| ------ | ---------------------------------------------- | ------------------------------------------------- |
| Venta  | `map.debit` (Clientes) por el **total**        | `map.credit` (Ingresos) por la **base** + residuo |
|        |                                                | `2.1.1.002` IVA débito fiscal por el IVA          |
|        |                                                | `2.1.1.007` IGTF por pagar por el IGTF            |
| Compra | `map.debit` (Mercancía) por la **base + IGTF** | `map.credit` (Proveedores) por el **total**       |
|        | `1.1.2.002` IVA crédito fiscal por el IVA      |                                                   |

Detalles:

- Cada componente se convierte a moneda funcional con la **tasa congelada del documento** y se redondea
  a dos decimales. El residuo de redondeo (`total − base − IVA − IGTF`) se ajusta en la línea principal
  para que la partida doble cuadre al céntimo.
- En la compra el IGTF va contra la cuenta de inventario/gasto: no es crédito fiscal recuperable.
- Si falta la cuenta de IVA o la de IGTF, el asiento no se inventa un plan: la línea se omite y, en el
  caso del IVA, se avisa con un mensaje explícito (sin él el asiento no cuadraría).

## 4. Banco ↔ cuenta contable (`0028_bank_account_ledger`)

`bank_accounts.accounting_account_id` (FK a `accounting_accounts`, `ON DELETE SET NULL`) indica la
hoja del activo que recibe los movimientos. `applyMapToPayment` la usa para la pata del banco:

| Tipo de pago | Pata del banco                                       |
| ------------ | ---------------------------------------------------- |
| Cobro        | **débito** en la cuenta contable de la cuenta banco  |
| Pago         | **crédito** en la cuenta contable de la cuenta banco |

Sin vínculo se cae al mapeo genérico (`1.1.1.002`), que es el comportamiento anterior: el sistema no
deja de contabilizar por una cuenta mal configurada, pero el gate lo marca como pendiente.

En la UI de **Cuentas bancarias** se ve el vínculo en su columna y se elige al crear la cuenta (sólo
hojas imputables de `1.1.1.*`, es decir efectivo y equivalentes). La semilla enlaza las cuentas en
divisa con `1.1.1.003` y las de bolívares con `1.1.1.002`.

## 5. Posteo y anulación automáticos

- `BillingService.post()` genera el asiento de la factura después de emitirla. Si el plan o el período
  lo impiden, registra un `WARN` y la emisión sigue: el documento fiscal no se bloquea por
  contabilidad y el asiento se puede regenerar con `POST /v1/accounting/entries/from-invoice/:id`.
- `BillingService.void()` anula el asiento (`CANCELLED`) con la misma política.
- Misma mecánica que `S-18` usó para cobros y pagos.

## 6. Plan de cuentas

Se agregó `2.1.1.007 IGTF por pagar` (`LIABILITY`) al catálogo base. El resto de las cuentas que usa
el asiento ya existía (`1.1.2.001`, `1.1.2.002`, `2.1.1.002`, `4.1.1.001`, `1.1.3.001`, `2.1.1.001`,
`1.1.1.002`, `1.1.1.003`), lo que confirma que el plan venía bien y el asiento era el que estaba mal.

## 7. Gate (de 52 a 55 reglas)

| Regla                                                           | Motivo                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| Las líneas se imputan a cuentas que aceptan movimientos         | evita postear contra una cuenta de grupo o inactiva      |
| Cada cuenta bancaria activa tiene su cuenta contable del activo | sin vínculo no hay conciliación por banco                |
| El asiento de la factura separa IVA e IGTF de los ingresos      | detecta una factura contabilizada como dos líneas planas |

## 8. Criterios de aceptación

1. Venta de 100 + IVA 16 + IGTF 3,48 a tasa 36,50 ⇒ Clientes 4.361,02 · Ingresos 3.650,00 ·
   IVA débito 584,00 · IGTF 127,02, y el asiento cuadra.
2. Compra de 1.000 + IVA 160 ⇒ Mercancía 1.000 · IVA crédito fiscal 160 · Proveedores 1.160.
3. Cobro a una cuenta en divisa ⇒ la pata del banco es `1.1.1.003`, no `1.1.1.002`.
4. Cobro a una cuenta en bolívares ⇒ la pata del banco es `1.1.1.002`.
5. Anular una factura deja su asiento en `CANCELLED`.
6. `db:verify` en verde con las cinco reglas nuevas.

## 9. Verificación ejecutada (2026-10-31)

| Escenario                                                             | Resultado                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `db:reset` + `db:migrate` + `db:seed:dev`                             | 28 migraciones · **55/55 reglas**                                                          |
| Factura `A-00004`: 100 + IVA 16 + IGTF 3,48 = 119,48 USD a tasa 36,50 | Clientes 4.361,02 · Ingresos 3.650,00 · IVA débito 584,00 · IGTF 127,02 · cuadrado         |
| Cobro 1.000 Bs a `VES-001`                                            | asiento: `1.1.1.002 Banco moneda funcional` 1.000,00 · Clientes 1.000,10 · FX 0,10         |
| Cobro 64,69 USD a `USD-001` (factura `A-00003`)                       | asiento: `1.1.1.003 Banco moneda extranjera` 2.361,19 · Clientes 2.587,60 · FX 226,41      |
| Anulación de factura con asiento                                      | `CANCELLED`                                                                                |
| UI de cuentas bancarias                                               | columna "Cuenta contable" con `1.1.1.003` / `1.1.1.002`; el selector sólo ofrece `1.1.1.*` |
| `db:verify` con los documentos de prueba                              | 55/55                                                                                      |

Pruebas automatizadas: backend **1144** (nueva `accounting-fiscal-entry.test.ts`, 4 casos), database
**55**, frontend **385**; `typecheck`, `lint` y `build` en verde (4/4).

> **Nota sobre el redondeo:** al imputar en la moneda del documento, el importe se redondea a dos
> decimales; la diferencia contra el importe cobrado (≤ 0,005 de la moneda del documento × tasa) cae en
> resultado cambiario. En el caso de 1.000 Bs sobre una factura en divisa a 36,50 son 0,10 Bs, que es
> exactamente lo que muestra el asiento. El saldo del documento, en cambio, nunca deriva.

## 10. Riesgos y trabajo futuro

- **Retenciones**: el comprobante se emite, pero su asiento (`2.1.1.003`) todavía no se genera.
- **Notas de crédito**: falta su asiento (contra-ingreso + IVA) para que la devolución baje el resultado.
- **IGTF del pago en efectivo en divisa**: el asiento sólo recoge el IGTF de la factura.
- **Costeo**: la compra entra a `1.1.3.001` por la base; el costo de ventas y la salida de inventario
  siguen sin asiento automático.
- **Conciliación contable**: ahora el mayor distingue bancos, así que ya existe la llave
  (`bank_accounts.accounting_account_id`) para comparar mayor, tesorería y extracto; falta la pantalla.
