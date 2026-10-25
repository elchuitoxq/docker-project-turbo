# TESORERÍA Y FACTURACIÓN - LÓGICA DE NEGOCIO

## Reglas Críticas (14 Reglas del Skill)

### Regla 1: UUID v7 Validation

```typescript
// El sistema usa UUID v7 para todos los PKs
// ⚠️ NO usar IsUUID(4) en DTOs, usar @IsUUID('all')
```

### Regla 2: DTO Sanitization

```typescript
// PROBLEMA: Empty strings ("") causan errores de validación UUID
// SOLUCIÓN: Convertir a undefined antes de enviar

const payload = {
  ...data,
  warehouseId: data.warehouseId || undefined,  // Sanitizar
  items: data.items.map(item => ({
    ...item,
    currencyId: item.currencyId || undefined,
  })),
};
```

### Regla 3: Decimals - Usar decimal.js

```typescript
// ⚠️ NUNCA usar floats para dinero
import Decimal from 'decimal.js';

// Correcto
const total = new Decimal(base).times(taxRate);
```

### Regla 4: Purchase Logic

```
Flow: Order (Purchase) → Invoice (Draft) → Invoice (Posted)
Inventario: Se afecta en creación de Invoice (si warehouseId presente)
```

### Regla 5: Balance Logic (Crítico)

```typescript
// Income (Venta/Cobro): balance = balance + amount
// Expense (Compra/Pago): balance = balance - amount

// ⚠️ SIEMPRE validar paymentType antes de aplicar
```

### Regla 6: Rate Inheritance

```typescript
// Si pagas una factura específica, DEBES usar invoice.exchangeRate
// NO usar tasa manual para pagos de facturas
// Tasa manual SOLO para advance payments (pagos sin factura)
```

### Regla 7: Invalidación de Queries

```typescript
// Al crear/anular/postar facturas, invalidar AMBOS
queryClient.invalidateQueries({ queryKey: ['invoices'] });      // Ventas
queryClient.invalidateQueries({ queryKey: ['purchases'] });    // Compras
```

---

## Flujo Completo: Factura → Pago → Anulación

### 2.1 Creación de Factura (Billing)

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /billing/invoices                                         │
│  Status: DRAFT                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Validar partner existe                                     │
│  2. Validar productos y precios                                │
│  3. Calcular:                                                   │
│     - totalBase = Σ(item.quantity × item.price)                │
│     - totalTax = totalBase × (isExempt ? 0 : taxRate/100)     │
│     - totalIgtf = (applyIgtf && currency!='VES')             │
│                   ? (totalBase + totalTax) × 0.03 : 0         │
│     - total = totalBase + totalTax + totalIgtf                  │
│  4. Guardar con status=DRAFT, exchangeRate snapshot            │
│  5. Retornar invoice con ID                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Emisión de Factura (Post)

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /billing/invoices/:id/post                                │
│  Status: DRAFT → POSTED                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TRANSACCIÓN ATÓMICA:                                          │
│                                                                 │
│  1. Generar código correlativo: "A-00001" (o "C-00001")       │
│     ⚠️ Buscar último código INDEPENDIENTE del status           │
│                                                                 │
│  2. Si tipo=PURCHASE y warehouseId presente:                   │
│     - Crear InventoryMove tipo=IN                               │
│     - Actualizar stock                                          │
│     - Actualizar product.cost (WAC)                            │
│                                                                 │
│  3. Crear Asiento Contable via AccountingService:              │
│     - Cuentas por Cobrar (Débito)                              │
│     - Ingresos por Venta (Crédito)                            │
│     - IVA Débito Fiscal (Crédito)                             │
│                                                                 │
│  4. Actualizar status → POSTED                                  │
│  5. Invalidar queries: ['invoices', 'purchases']               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Registro de Pago (Treasury)

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /treasury/payments                                        │
│  type: INCOME (Cobro) o EXPENSE (Pago)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Validaciones:                                               │
│     - Si methodCode.startsWith('RET_'):                        │
│       → Es retención, crear comprobante dentro de tx           │
│     - Si hay invoiceId:                                         │
│       → Usar invoice.exchangeRate (NO tasa manual)             │
│     - Si amount > invoice.total:                               │
│       → Crear Credit Note por saldo a favor                    │
│                                                                 │
│  2. Si paymentMethod es 'BALANCE_USD' o 'BALANCE_VES':        │
│     → NO afectar bank_accounts.currentBalance                  │
│     → Usar Credit Note para cruzar saldo                       │
│                                                                 │
│  3. TRANSACCIÓN:                                               │
│     a. Insertar payment                                        │
│     b. Si bankAccountId: Actualizar saldo                      │
│        - INCOME: balance += amount                             │
│        - EXPENSE: balance -= amount (⚠️ validar fondos)       │
│     c. Crear payment_allocations (si hay invoice)              │
│     d. Si hay sobrepago: Crear creditNote                      │
│     e. Si methodCode='RET_*': Crear taxRetention              │
│     f. Actualizar status invoice (PAID/PARTIALLY_PAID)        │
│     g. Crear documentLinks                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Flujo de Pagos Multi-Moneda (Unified Statement)

```
┌─────────────────────────────────────────────────────────────────┐
│  getAccountStatement(partnerId, reportingCurrencyId='USD')      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Obtener todas las transacciones del partner                │
│  2. Para CADA transacción:                                       │
│     - Si es VES: Convertir a USD usando rate.histórico         │
│     - Si es USD: Mantener como está                            │
│                                                                 │
│  3. Detectar cross-currency allocations:                       │
│     - payment_allocations dice cuánto se asignó de cada pago   │
│     - Reducción de deuda = allocation.amount en moneda reporte │
│                                                                 │
│  4. Calcular balance cumulativo en moneda reporte              │
│                                                                 │
│  5. Retornar con columnas:                                     │
│     - MONTO ORIGINAL: amount + currency (realidad legal)      │
│     - MONTO REPORTE: debit/credit + balance (en reporting $)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## voidPayment: Proceso de 8 Pasos (Rollback Completo)

```typescript
// treasury.service.ts - voidPayment()

async voidPayment(paymentId, branchId?, userId?) {
  
  // PASO 1: Validar Credit Notes Hijos
  // ─────────────────────────────────
  // Si el pago generó surplus (NC de sobrepago), verificar
  // que esas NC NO estén gastadas en otros pagos
  // ⚠️ Si están gastadas, BLOQUEAR la anulación
  const childCreditNotes = await findChildCreditNotes(paymentId);
  for (const cn of childCreditNotes) {
    const used = await getUsedAmount(cn.id);
    if (used > 0) throw new Error('NC ya fue utilizada');
  }
  
  // PASO 2: Revertir Ledger de Banco
  // ─────────────────────────────────
  // bankAccount.currentBalance -= amount (si era INCOME)
  // bankAccount.currentBalance += amount (si era EXPENSE)
  if (payment.bankAccountId) {
    await tx.update(bankAccounts)
      .set({ 
        currentBalance: payment.type === 'INCOME'
          ? sql`current_balance - ${payment.amount}`
          : sql`current_balance + ${payment.amount}`
      })
      .where(eq(bankAccounts.id, payment.bankAccountId));
  }
  
  // PASO 3: Liberar Credit Note Usages
  // ─────────────────────────────────
  // Si el pago USÓ una NC existente (no generó, usó),
  // devolver ese monto a available
  const usages = await findUsagesByPayment(paymentId);
  for (const usage of usages) {
    await deleteCreditNoteUsage(usage.id);
  }
  
  // PASO 4: Eliminar Credit Notes Hijas
  // ─────────────────────────────────
  // Las NC generadas por sobrepago de ESTE pago
  await deleteChildCreditNotes(paymentId);
  
  // PASO 5: Cleanup de Retenciones
  // ─────────────────────────────────
  // Eliminar tax_retention_lines
  // Si el tax_retention queda vacío → eliminar
  // Si tiene líneas → recalcular totales
  await deleteRetentionLines(paymentId);
  await cleanupEmptyRetentions();
  
  // PASO 6: Eliminar Payment Allocations
  // ─────────────────────────────────
  // Desvincular pagos de facturas
  await deletePaymentAllocations(paymentId);
  
  // PASO 7: Limpiar Document Links
  // ─────────────────────────────────
  await deleteDocumentLinks(paymentId);
  
  // PASO 8: Reabrir Facturas
  // ─────────────────────────────────
  // Recalcular cuánto falta por pagar de cada factura
  // Si unpaidBalance > 0: Cambiar status
  // POSTED → (si era PAYMENT) volver a POSTED
  // PAID → PARTIALLY_PAID o POSTED según corresponda
  const allocations = await findAllocationsByPayment(paymentId);
  for (const alloc of allocations) {
    const invoice = await getInvoice(alloc.invoiceId);
    const paid = await getPaidAmount(invoice.id);
    const total = invoice.total;
    if (paid < total) {
      await updateInvoiceStatus(invoice.id, 
        paid > 0 ? 'PARTIALLY_PAID' : 'POSTED');
    }
  }
  
  // Finalmente: Marcar pago como VOID
  await tx.update(payments)
    .set({ status: 'VOID' })
    .where(eq(payments.id, paymentId));
}
```

---

## Credit Notes: Saldo a Favor y Cruce

### 3.1 Auto-Credit (Sobrepago)

```
Pago con amount > totalInvoice
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  surplus = payment.amount - totalAllocations                    │
│  if (surplus > 0) {                                            │
│    // Crear NC de anticipo                                      │
│    code: "NC-ADV-" + timestamp                                  │
│    status: POSTED                                               │
│    total: surplus                                               │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Consumo (Cruce de Saldo)

```
Método: BALANCE_USD o BALANCE_VES
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Buscar NCs POSTED del partner en esa moneda                 │
│  2. Calcular remainingAmount = total - Σ(usages)                │
│  3. Allocation amount = min(remaining, payment.amount)         │
│  4. Crear credit_note_usages                                    │
│  5. payment NO afecta bank_accounts.currentBalance             │
│     ⚠️ Porque no hay movimiento de efectivo                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sequential Code Generation

```typescript
// Para evitar unique constraint collisions

const prefix = type === "SALE" ? "A" : "C";  // A=venta, C=compra

// 1. Buscar ÚLTIMO código INDEPENDIENTE del status
const lastRecord = await tx.query.invoices.findFirst({
  where: and(
    eq(invoices.type, type),
    like(invoices.code, `${prefix}-%`),
    // ⚠️ NO filtrar por status (DRAFT, VOID todos cuentan)
  ),
  orderBy: desc(invoices.code),
});

// 2. Incrementar safely
const lastNum = lastRecord?.code.split("-")[1] || "0";
const nextCode = `${prefix}-${(parseInt(lastNum) + 1).toString().padStart(5, "0")}`;

// Resultado: A-00001, A-00002, ... A-99999
```

---

## Payment Methods - Códigos Especiales

| Code | Descripción | Afecta Balance | Notas |
|------|-------------|----------------|-------|
| CASH_USD | Efectivo USD | Sí | - |
| CASH_VES | Efectivo Bs | Sí | - |
| POS | Punto de Venta | Sí | - |
| ZELLE | Zelle | Sí | - |
| TRANSFER | Transferencia | Sí | - |
| RET_IVA_75 | Retención IVA 75% | No | Genera comprobante |
| RET_IVA_100 | Retención IVA 100% | No | Genera comprobante |
| RET_ISLR | Retención ISLR | No | Genera comprobante |
| BALANCE_USD | Cruce saldo USD | No | Usa NC |
| BALANCE_VES | Cruce saldo Bs | No | Usa NC |

---

## Drizzle & Nullable UUIDs

```typescript
// PROBLEMA: eq(table.col, null) falla o produce SQL incorrecto
// SOLUCIÓN: Usar isNull() para null

import { isNull, eq, and } from "drizzle-orm";

const where = and(
  eq(paymentMethods.code, data.code),
  data.branchId
    ? eq(paymentMethods.branchId, data.branchId)
    : isNull(paymentMethods.branchId),  // ← Así
);
```

---

## Estado de Facturas

```
┌─────────┐     POST      ┌─────────┐
│  DRAFT  │ ──────────→  │ POSTED  │
└─────────┘               └─────────┘
     │                         │
     │ DELETE                  │ PAY (partial)
     ▼                         ▼
┌─────────┐               ┌─────────────────┐
│ (delete)│               │ PARTIALLY_PAID │
└─────────┘               └─────────────────┘
                                │
                                │ PAY (full)
                                ▼
                          ┌─────────┐
                          │  PAID   │
                          └─────────┘
                                │
                                │ VOID
                                ▼
                          ┌─────────┐
                          │  VOID   │  ← Nunca se borra, status=VOID
                          └─────────┘
```

---

## Imports Comunes en Treasury

```typescript
// ⚠️ CUIDADO con imports duplicados
import { db, bankAccounts, payments, paymentMethods, 
         paymentAllocations, creditNotes, creditNoteUsages,
         taxRetentions, taxRetentionLines } from '@repo/db';
```
