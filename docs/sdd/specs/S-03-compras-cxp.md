# S-03 — Compras y cuentas por pagar (CxP)

| Campo          | Valor                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| **Estado**     | ⬜ Especificada                                                                              |
| **Prioridad**  | 🟠 P1                                                                                        |
| **Depende de** | S-00, S-01 (C)                                                                               |
| **Épica**      | E3 · **Fuentes:** `audit-report/07-TESORERIA-BILLING-LOGIC.md`, `08-FISCALIDAD-VENEZUELA.md` |

---

## 1. Problema

Existe `invoices.type = 'PURCHASE'` y la pantalla `operations/purchases` reutiliza la vista de ventas,
pero **no hay flujo de compras**: ni vencimientos, ni CxP, ni retenciones al proveedor, ni pago con
comprobante. El ciclo de compras está a medias y no es auditable.

## 2. Alcance

1. **Factura de proveedor**: alta con fecha de emisión, vencimiento, número de factura del proveedor
   (`supplierInvoiceNumber`) y días de crédito del partner.
2. **Retenciones de compra**: al publicar, calcular IVA (75 %/100 %) e ISLR según concepto y
   generar `tax_retentions` + comprobante.
3. **CxP**: antigüedad de saldos por proveedor y sucursal; estado `PENDING / PARTIAL / PAID / OVERDUE`.
4. **Pago a proveedor**: desde tesorería, con asignación a facturas (`payment_allocations`) y
   retención descontada.
5. **Devolución / nota de crédito de compra** (reutiliza `credit_notes` con `type`).
6. **UI**: listado de compras con saldo y vencimiento, detalle con retenciones y pagos, pantalla de CxP.

**No incluye:** órdenes de compra formales (existe `orders` tipo PURCHASE; se puede usar en una
iteración posterior), ni recepción por lote contra orden (queda en backlog).

## 3. Historias de usuario

| ID   | Historia                                                                               |
| ---- | -------------------------------------------------------------------------------------- |
| HU-1 | Como comprador registro una factura de proveedor con su vencimiento.                   |
| HU-2 | Al publicarla, el sistema genera la retención de IVA/ISLR y me muestra el comprobante. |
| HU-3 | Como analista de CxP veo qué facturas vencen esta semana y cuánto debo por proveedor.  |
| HU-4 | Como tesorero pago una o varias facturas, con retención descontada y comprobante.      |
| HU-5 | Como contador, cada pago genera su asiento automáticamente.                            |

## 4. Modelo de datos

| Tabla                                   | Cambio                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `invoices`                              | Agregar `supplierInvoiceNumber`, `supplierInvoiceDate`, `dueDate`, `paidAmount` (cache), `type` ya existe |
| `partners`                              | Agregar `creditDays` (días de crédito por defecto)                                                        |
| `payments`                              | Agregar `direction` (`IN`/`OUT`) y `retentionAmount`                                                      |
| `tax_retentions`                        | Ya existe: vincular `invoiceId` y `voucherNumber` secuencial                                              |
| `credit_notes`                          | Agregar `type` (`SALE`/`PURCHASE`)                                                                        |
| **Nueva** `supplier_retention_settings` | Por empresa: % IVA retenido, conceptos ISLR y sustraendo                                                  |

## 5. Contrato HTTP

```
POST   /v1/billing/invoices                 → ya existe (type=PURCHASE) + dueDate/supplierInvoiceNumber
POST   /v1/billing/invoices/:id/post        → genera retenciones y asiento; devuelve comprobantes
GET    /v1/billing/payables?branchId&from&to → antigüedad de saldos por proveedor
GET    /v1/billing/payables/aging           → buckets 0-30/31-60/61-90/+90
POST   /v1/treasury/payments                → direction=OUT + allocations[] + retentionIds[]
GET    /v1/treasury/retentions              → comprobantes emitidos (filtros por fecha/proveedor)
POST   /v1/credit-notes                     → type=PURCHASE (devolución a proveedor)
```

Permisos: `billing:purchases:view|create|post|void`, `treasury:payments:create`,
`treasury:retentions:view`.

## 6. UI/UX

- `operations/purchases`: tabla con proveedor, factura, emisión, vencimiento, total, retenido, saldo, estado.
- Detalle: cabecera fiscal, líneas, retenciones, pagos, comprobantes descargables.
- `finance/payables` (nueva): aging por proveedor + acción "Pagar".
- El formulario de pago muestra retención calculada y neto a pagar antes de confirmar.

## 7. Reglas de negocio

1. Sólo se publica una factura con RIF de proveedor válido y número único por proveedor.
2. Retención de IVA por defecto 75 % (100 % en supuestos especiales) sobre el IVA de la factura.
3. Retención de ISLR según concepto del proveedor y tabla del decreto vigente (parametrizable).
4. El pago no puede exceder el saldo de la factura; el sobrante queda como anticipo (no se permite
   sobrepago silencioso).
5. Una factura con pagos no se anula: se emite nota de crédito o se anula el pago primero.
6. La secuencia de comprobantes es por sucursal y año, sin huecos (auditoría fiscal).
7. Todo en la moneda de la factura; si el pago es en divisa se aplica IGTF cuando corresponda.

## 8. Criterios de aceptación (Gherkin)

```gherkin
Escenario: publicación con retención
  Dado una factura de compra por 1.000 + IVA 16 %
  Y un proveedor con retención de IVA del 75 %
  Cuando se publica
  Entonces se genera una retención de 120
  Y el saldo a pagar es 1.040

Escenario: pago parcial
  Dado una factura con saldo 1.040
  Cuando pago 500
  Entonces el estado es PARTIAL y el saldo 540
  Y el asiento registra banco 500 / CxP 500

Escenario: vencimiento
  Dado una factura con dueDate anterior a hoy y saldo > 0
  Entonces aparece como OVERDUE en el aging
```

## 9. Plan de pruebas

| Tipo        | Caso                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| Unitario    | Cálculo de retenciones; validación de sobrepago; aging por buckets           |
| Integración | Ciclo completo factura→publicar→pagar→asiento→comprobante en una transacción |
| E2E         | Registrar compra, publicar, pagar y ver el estado en CxP                     |
| Fiscal      | Secuencia de comprobante sin huecos y con formato válido                     |

## 10. Riesgos

| Riesgo                                       | Mitigación                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Duplicar lógica de ventas                    | Extraer `InvoiceService` común con estrategia por `type`                   |
| Retenciones mal calculadas → problema fiscal | Tabla de casos + revisión con negocio + tests con montos reales            |
| Migración de facturas históricas             | Backfill de `dueDate` = emisión y `paidAmount` desde `payment_allocations` |
