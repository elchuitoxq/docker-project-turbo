# ESTRATEGIA DE SEED DATA - 6 LEVEL HIERARCHY

## 1. Principio Core

El archivo `packages/db/seed-test.ts` es la **Fuente de Verdad** para:
- Testing de Integración
- Demos del Sistema
- Load Testing
- Validación en Desarrollo

---

## 2. Jerarquía de Seeding (6 Niveles)

### Level 1: Infraestructura
```
Secuencia: Roles → Users → Branches
```

```typescript
// 1.1 Crear roles
const roles = await seedRoles(['ADMIN', 'MANAGER', 'SELLER', 'WAREHOUSE', 'ACCOUNTANT']);

// 1.2 Crear usuario admin
const admin = await seedUser({
  email: 'admin@company.com',
  name: 'Admin User',
  role: 'ADMIN',
  branches: [mainBranch.id]
});

// 1.3 Crear branches
const mainBranch = await seedBranch({
  name: 'Sucursal Principal',
  taxId: 'J-12345678-9',
  address: 'Caracas, Venezuela',
});
```

### Level 1.6: HR ( semi-independiente)
```
Secuencia: JobPositions → Employees → Contracts
```

```typescript
// 1.6.1 Posiciones
await seedJobPositions([
  { name: 'Gerente', salaryMin: 1500, salaryMax: 3000 },
  { name: 'Vendedor', salaryMin: 500, salaryMax: 1000 },
  { name: 'Contador', salaryMin: 800, salaryMax: 1500 },
]);

// 1.6.2 Empleados
const employees = await seedEmployees([
  { firstName: 'Juan', lastName: 'Pérez', position: 'Vendedor', salary: 600 },
  { firstName: 'María', lastName: 'García', position: 'Contador', salary: 1000 },
]);
```

### Level 2: Finanzas
```
Secuencia: Currencies → ExchangeRates → BankAccounts
```

```typescript
// 2.1 Monedas
const usd = await seedCurrency({ code: 'USD', name: 'US Dollar', symbol: '$' });
const ves = await seedCurrency({ code: 'VES', name: 'Bolívar', symbol: 'Bs' });

// 2.2 Tasas de cambio
// ⚠️ CRÍTICO: Calcular hacia ATRÁS desde la tasa actual
const currentRate = 45.50;
for (let i = 30; i >= 0; i--) {
  const date = subDays(new Date(), i);
  const historicalRate = currentRate - (Math.random() * 2);
  await seedExchangeRate({
    currencyId: ves.id,
    rate: historicalRate,
    date,
    source: i === 0 ? 'BCV_SCRAPER' : 'HISTORICAL',
  });
}

// 2.3 Cuentas bancarias (EMPRESA)
await seedBankAccounts([
  { name: 'Banesco Principal USD', currency: 'USD', balance: 50000 },
  { name: 'Mercantil Cuenta Corriente', currency: 'USD', balance: 30000 },
  { name: 'Caja Chica VES', currency: 'VES', balance: 1000000 },
]);
```

### Level 3: Maestros
```
Secuencia: Partners → Products
```

```typescript
// 3.1 Partners (Clientes y Proveedores)
// ⚠️ Usar nombres REALES, no "Test 1"
const partners = await seedPartners([
  {
    name: 'Corporación Acme C.A.',
    taxId: 'J-40123456-7',
    type: 'CUSTOMER',
    taxpayerType: 'SPECIAL',
    retentionRate: 75,
  },
  {
    name: 'Distribuidora Occidental',
    taxId: 'J-40987654-3',
    type: 'SUPPLIER',
    taxpayerType: 'ORDINARY',
  },
]);

// 3.2 Productos
await seedProducts([
  { sku: 'LAP-001', name: 'Laptop Dell XPS 15', price: 1299.99, category: 'Computación' },
  { sku: 'MON-001', name: 'Monitor LG 27"', price: 399.99, category: 'Computación' },
  { sku: 'SVC-001', name: 'Servicio de Instalación', price: 150.00, category: 'Servicios' },
]);
```

### Level 4: Inventario
```
Secuencia: Warehouses → Stock (Initial)
```

```typescript
// 4.1 Almacenes
const mainWarehouse = await seedWarehouse({
  name: 'Almacén Principal',
  branchId: mainBranch.id,
});

// 4.2 Stock inicial
await seedStock([
  { warehouse: mainWarehouse, product: laptop, quantity: 50 },
  { warehouse: mainWarehouse, product: monitor, quantity: 100 },
]);
```

### Level 5: Transacciones
```
Secuencia: Orders → Invoices → CreditNotes
```

```typescript
// 5.1 Orders (Pedidos)
const order1 = await seedOrder({
  code: 'PED-0001',
  partner: partners[0],
  type: 'SALE',
  items: [
    { product: laptop, quantity: 2, price: 1299.99 },
  ],
});

// 5.2 Invoices (Facturas)
// ⚠️ CRÍTICO: totalTax = totalBase * 0.16
const invoice1 = await seedInvoice({
  code: 'A-0001',
  partner: partners[0],
  type: 'SALE',
  status: 'POSTED',
  items: [
    { product: laptop, quantity: 2, price: 1299.99 },
  ],
  // Calculado automáticamente:
  // totalBase: 2599.98
  // totalTax: 415.99 (2599.98 * 0.16)
  // total: 3015.97
});

// 5.3 Credit Notes (Notas de Crédito)
// Solo si hay devoluciones
```

### Level 6: Treasury
```
Secuencia: Payments (delegated to API)
```

```typescript
// 6.1 Payments
// ⚠️ Se delegan a API o script separado (seed:transactions)
// Porque dependen de lógica compleja de treasury

// Approach: Usar endpoint API o script dedicado
await seedPaymentsFromApi();
```

### Level 7: Actualización de Saldos
```
Final Step: Recalcular bank_accounts.current_balance
```

```typescript
// 7.1 Actualizar saldos de bancos
// Sumar todos los INCOME y restar todos los EXPENSE por cuenta
await recalculateBankBalances();

// 7.2 Validar consistencia
// Verificar que sum(stock) = inventory coherente
```

---

## 3. Reglas de Consistencia (CRÍTICAS)

### 3.1 Retenciones

```typescript
// ❌ INCORRECTO: Crear solo tax_retention
await seed('tax_retentions', { ... });

// ✅ CORRECTO: Crear retention + payment JUNTO
// Esto refleja el "Unified Path"
const payment = await seed('payments', {
  methodCode: 'RET_IVA_75',
  amount: retentionAmount,
  ...
});
await seed('tax_retentions', {
  paymentId: payment.id,
  ...
});
```

### 3.2 Códigos Secuenciales

```typescript
// ✅ CORRECTO: Usar strings secuenciales
code: 'PED-0001'
code: 'A-0001'

// ❌ INCORRECTO: Usar UUIDs o strings random
code: uuid()
code: `TEST-${Math.random()}`
```

### 3.3 exchangeRates Históricos

```typescript
// ✅ CORRECTO: Calcular backwards
const currentRate = 45.50;
for (let i = 30; i >= 0; i--) {
  // Simular fluctuación diaria
  rate = currentRate - (i * 0.1) + (Math.random() * 0.5);
  await seed('exchange_rates', { rate, date: subDays(now, i) });
}

// ❌ INCORRECTO: Usar misma tasa en todos
rate = 45.50; // Todos los días igual = curva plana
```

### 3.4 Bank Balances (L7.5 Final Step)

```typescript
// ✅ CORRECTO: Recalcular después de seed transactions
async function recalculateBankBalances() {
  const accounts = await db.query.bankAccounts.findMany();
  
  for (const account of accounts) {
    const { totalIncome } = await db.query.payments.aggregate({
      where: { bankAccountId: account.id, type: 'INCOME' },
      _sum: { amount: true },
    });
    
    const { totalExpense } = await db.query.payments.aggregate({
      where: { bankAccountId: account.id, type: 'EXPENSE' },
      _sum: { amount: true },
    });
    
    await db.update(bankAccounts)
      .set({ currentBalance: totalIncome - totalExpense })
      .where(eq(bankAccounts.id, account.id));
  }
}
```

### 3.5 Fiscal Logic

```typescript
// ✅ CORRECTO: IVA = base * 0.16
totalBase = 1000;
totalTax = totalBase * 0.16; // = 160

// ❌ INCORRECTO
totalTax = Math.random() * 100; // Rompe libros fiscales
```

---

## 4. Uso de @faker-js/faker

```typescript
import { faker } from '@faker-js/faker';

// ✅ CORRECTO: Datos realistas
name: faker.company.name(),        // "Corporación Acme C.A."
taxId: `J-${faker.string.numeric(8)}-${faker.string.numeric(1)}`,
email: faker.internet.email(),

// ❌ INCORRECTO
name: 'Test Company',
email: 'test@test.com',
```

---

## 5. Scripts Disponibles

```bash
# Reset completo + seed
npm run db:setup:test

# Este comando:
# 1. Resetea la DB
# 2. Push schema
# 3. Ejecuta seed-test.ts
# 4. Ejecuta seed:transactions (pagos de treasury)
```

---

## 6. Dependencias de Seed

```
seed-test.ts
    │
    ├── L1: Roles → Users → Branches
    │
    ├── L1.6: Positions → Employees
    │
    ├── L2: Currencies → Rates → BankAccounts
    │
    ├── L3: Partners → Products
    │
    ├── L4: Warehouses → Stock
    │
    ├── L5: Orders → Invoices → CreditNotes
    │
    └── L6: Payments (delegated to API)
    
    L7.5: Recalculate Bank Balances (FINAL)
```

---

## 7. No Duplicación

```typescript
// ⚠️ REGLA: Si seed-test.ts extiende seed.ts
// NO insertar datos de "hoy" que seed.ts ya creó

// seed-test.ts SOLO inserta:
// - Datos históricos (ayer, hace 30 días, etc.)
// - Nuevos registros que seed.ts no creó

// seed.ts usualmente crea:
// - Estructura base (roles, admin user)
// - Monedas base (USD, VES)
// - Tasas de HOY
```

---

## 8. Validación Post-Seed

```typescript
// Después de seed, verificar:
const checks = [
  {
    name: 'Invoice totals consistency',
    check: async () => {
      const invoice = await db.query.invoices.findFirst();
      const expectedTax = invoice.totalBase * 0.16;
      return Math.abs(invoice.totalTax - expectedTax) < 0.01;
    }
  },
  {
    name: 'Bank balance matches transactions',
    check: async () => {
      const account = await db.query.bankAccounts.findFirst();
      const calculated = await sumPayments(account.id);
      return account.currentBalance === calculated;
    }
  },
];

for (const { name, check } of checks) {
  const passed = await check();
  if (!passed) throw new Error(`Seed validation failed: ${name}`);
}
```
