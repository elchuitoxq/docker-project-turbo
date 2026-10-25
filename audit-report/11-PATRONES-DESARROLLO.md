# PATRONES DE DESARROLLO - ERP STANDARDS

## 1. Patrones UI (Frontend)

### 1.1 Tables

**Regla**: Componentes de tabla deben ser autocontenidos.

```typescript
// ✅ CORRECTO: Table contiene su propio estado de búsqueda
// GlobalPaymentsTable.tsx
const GlobalPaymentsTable = () => {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  
  // Lógica dentro del componente
  const { data, isLoading } = usePayments({ search, filters });
  
  return <Table data={data} search={search} onSearchChange={setSearch} />;
}

// ❌ INCORRECTO: Estado lifteds
const PaymentsPage = () => {
  const [search, setSearch] = useState(''); // Levantado innecesariamente
  return <GlobalPaymentsTable search={search} onSearchChange={setSearch} />;
}
```

### 1.2 Loading States

**Regla**: Combinar estados de carga para evitar errores.

```typescript
// ✅ CORRECTO
const isLoading = isLoadingData || isLoadingRelations || isLoadingSettings;
if (isLoading) return <Loader2 />;

// ❌ INCORRECTO
if (isLoadingData) return <Loader2 />;
if (isLoadingRelations) return <Loader2 />; // Puede fallar si Relations aún cargan
```

### 1.3 Currency Display

**Regla**: Usar `DualCurrencyDisplay` para precios.

```typescript
// ✅ CORRECTO
<DualCurrencyDisplay 
  amount={product.price} 
  currency="USD" 
  exchangeRate={currentRate}
/>

// ❌ INCORRECTO
<span>${product.price}</span>
<span>Bs {product.price * currentRate}</span>
```

### 1.4 Format Currency

```typescript
// ✅ CORRECTO
import { formatCurrency } from '@/lib/utils';

const formatted = formatCurrency(amount, '$'); // "$1,234.56"

// ❌ INCORRECTO
const formatted = `$${amount.toFixed(2)}`; // Pierde locale handling
```

---

## 2. Patrones Forms

### 2.1 Optimistic Updates

```typescript
// ✅ CORRECTO
const mutation = useMutation({
  mutationFn: createInvoice,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    toast.success('Invoice created');
  },
  onError: () => {
    toast.error('Failed to create invoice');
  }
});
```

### 2.2 Validación

```typescript
// ✅ CORRECTO: Validar required y constraints lógicas
const validate = (data: CreateInvoiceDto) => {
  if (data.amount <= 0) {
    return { amount: 'Must be positive' };
  }
  if (data.allocatedAmount > data.amount) {
    return { allocatedAmount: 'Cannot exceed total' };
  }
  return {};
};
```

### 2.3 DTO Sanitization (Frontend → Backend)

```typescript
// ⚠️ PROBLEMA: Empty strings rompen validación UUID
// El backend responde con "Invalid UUID" aunque el campo sea opcional

// ✅ SOLUCIÓN: Convertir empty strings a undefined
const payload = {
  ...data,
  warehouseId: data.warehouseId || undefined,  // Sanitizar
  items: data.items.map(item => ({
    ...item,
    currencyId: item.currencyId || undefined,  // Sanitizar nested
  })),
};

// JSON.stringify() ignora undefined, enviando clean payload
```

---

## 3. Patrones Database (Drizzle)

### 3.1 UUID v7

```typescript
// ✅ CORRECTO: Usar uuidv7 para PKs ordenables por tiempo
import { uuidv7 } from 'uuidv7';

const id = uuidv7(); // Genera UUID v7

// ✅ CORRECTO: En schema, usar $defaultFn
id: uuid("id").primaryKey().$defaultFn(() => uuidv7())

// ⚠️ PROBLEMA: @IsUUID('4') de class-validator rechaza UUID v7
// ✅ SOLUCIÓN: Usar @IsUUID('all') en DTOs
```

### 3.2 Nullable UUIDs

```typescript
// ⚠️ PROBLEMA: eq(table.col, null) produce SQL incorrecto
const where = eq(payments.bankAccountId, null); // ❌ Wrong

// ✅ SOLUCIÓN: Usar isNull()
import { isNull, eq, and } from "drizzle-orm";

const where = and(
  eq(paymentMethods.code, data.code),
  data.branchId
    ? eq(paymentMethods.branchId, data.branchId)
    : isNull(paymentMethods.branchId),  // ✅ Correcto
);
```

### 3.3 Decimal Math

```typescript
// ⚠️ PROBLEMA: Float math para dinero
const total = 0.1 + 0.2; // 0.30000000000000004

// ✅ SOLUCIÓN: Usar decimal.js
import Decimal from 'decimal.js';

const total = new Decimal(base).times(taxRate);
const igtf = total.times(0.03);
const finalTotal = total.plus(igtf);
```

### 3.4 Transacciones

```typescript
// ✅ CORRECTO: Operaciones complejas en transacción
await db.transaction(async (tx) => {
  const [invoice] = await tx.insert(invoices).values(data).returning();
  
  await tx.insert(invoiceItems).values(items);
  
  await tx.update(bankAccounts)
    .set({ balance: sql`balance + ${amount}` })
    .where(eq(bankAccounts.id, accountId));
  
  // Si algo falla, todo se revierte
});
```

---

## 4. Patrones API (Backend)

### 4.1 Return Drizzle Results Directly

```typescript
// ✅ CORRECTO: Retornar resultados Drizzle directamente
async findAll(branchId?: string) {
  return await db.query.invoices.findMany({
    where: branchId ? eq(invoices.branchId, branchId) : undefined,
  });
}

// ❌ INCORRECTO: Mapeo innecesario
async findAll(branchId?: string) {
  const rows = await db.query.invoices.findMany({...});
  return rows.map(row => ({ id: row.id, ... })); // Mapeo innecesario
}
```

### 4.2 Error Handling

```typescript
// ✅ CORRECTO
async create(data: CreateDto) {
  try {
    const [result] = await db.insert(table).values(data).returning();
    return result;
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      throw new ConflictException('Already exists');
    }
    throw error;
  }
}
```

---

## 5. Patrones Cron Jobs

### 5.1 BCV Scraper

```typescript
// ✅ CORRECTO: Con manejo de errores y logging
@Cron('0 8-18/1 * * *')
async handleCron() {
  try {
    await this.scrapeRates();
    console.log('BCV rates updated successfully');
  } catch (error) {
    console.error('Failed to scrape BCV rates:', error);
    // No throw - no queremos que el cron se detenga
  }
}

// ❌ INCORRECTO
@Cron('0 8-18/1 * * *')
async handleCron() {
  await this.scrapeRates(); // Si falla, el job muere
}
```

---

## 6. Patrones Testing

### 6.1 Seed Data Consistency

```typescript
// ✅ CORRECTO: Seguir jerarquía de seeding
// L1: Infra (Roles, Users, Branches)
// L1.6: HR (Positions, Employees)
// L2: Finance (Currencies, Rates, Accounts)
// L3: Masters (Partners, Products)
// L4: Inventory (Initial Stock)
// L5: Transactions (Invoices Sales/Purchases)
// L6: Treasury (Payments)
```

### 6.2 Fiscal Data Rules

```typescript
// ✅ CORRECTO
// Todos los invoices deben tener tax = base * 0.16
invoice.totalTax = invoice.totalBase * 0.16; // No usar números random

// ❌ INCORRECTO
invoice.totalTax = Math.random() * 100; // Rompe consistencia
```

---

## 7. Patrones Exportación

### 7.1 Blob Downloads

```typescript
// ✅ Backend: StreamableFile
@Get('export/excel')
async exportExcel(@Res res: StreamableFile) {
  const buffer = await this.generateExcel();
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="report.xlsx"',
  });
  return new StreamableFile(buffer);
}

// ✅ Frontend: responseType blob
const downloadExcel = async (id: string) => {
  const { data } = await api.get(`/resource/${id}/export`, {
    responseType: 'blob',
  });
  saveAs(data, 'report.xlsx');
};
```

### 7.2 Heavy Generation en Backend

```typescript
// ✅ CORRECTO: Generación pesada en backend
// Excel con múltiples hojas, PDFs fiscales → Backend con exceljs/pdfkit

// ❌ INCORRECTO: Generación pesada en frontend
// Reportes complejos en el browser = mala performance
```

---

## 8. Patrones Code Generation

### 8.1 Sequential Codes

```typescript
// ✅ CORRECTO: Buscar último código sin importar status
const lastRecord = await tx.query.invoices.findFirst({
  where: and(
    eq(invoices.type, type),
    like(invoices.code, `${prefix}-%`),
    // ⚠️ NO filtrar por status
  ),
  orderBy: desc(invoices.code),
});

const nextCode = `${prefix}-${(parseInt(lastNum) + 1).toString().padStart(5, "0")}`;
```

---

## 9. Patrones React/Next.js

### 9.1 Next.js 15 params

```typescript
// ⚠️ CAMBIO CRÍTICO: params es Promise en Next.js 15

// ❌ INCORRECTO
const { id } = params;

// ✅ CORRECTO
const { id } = await params;
```

### 9.2 Query Invalidation

```typescript
// ✅ CORRECTO: Invalidar todos los keys relacionados
queryClient.invalidateQueries({ queryKey: ['invoices'] });
queryClient.invalidateQueries({ queryKey: ['purchases'] }); // Si comparte lógica
queryClient.invalidateQueries({ queryKey: ['reports'] });

// ❌ INCORRECTO: Invalidar solo uno cuando hay relación
queryClient.invalidateQueries({ queryKey: ['invoices'] }); // Y purchases no se actualiza
```

---

## 10. Patrones Logging

### 10.1 Structured Logging

```typescript
// ✅ CORRECTO
console.log(JSON.stringify({
  level: 'info',
  message: 'Payment processed',
  paymentId: payment.id,
  amount: payment.amount,
  timestamp: new Date().toISOString(),
}));

// ❌ INCORRECTO
console.log(`Payment ${payment.id} processed for ${payment.amount}`);
```

---

## 11. Import Organization

```typescript
// ✅ CORRECTO: Imports organizados
// 1. External
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal packages
import { db, invoices } from '@repo/db';

// 3. Local components
import { InvoiceTable } from './components';

// ❌ INCORRECTO: Mezclar imports
import { useState } from 'react';
import { db, invoices } from '@repo/db';
import { useQuery } from '@tanstack/react-query';
```
