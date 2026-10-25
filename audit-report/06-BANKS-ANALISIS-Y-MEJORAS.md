# ANÁLISIS Y MEJORAS: SISTEMA DE BANCOS

## Situación Actual: 3 Entidades Involucradas

| Entidad | Propósito | Ubicación Schema | Uso Real |
|---------|-----------|------------------|----------|
| `banks` | Catálogo maestro (Banesco=0134, Mercantil=0105) | `packages/db/src/schema.ts:845` | CRUD en `/settings/banks` |
| `bankAccounts` | Cuentas bancarias de la **empresa** (para pagos) | `packages/db/src/schema.ts:564` | Treasury module - pagos |
| `employees` | Campos sueltos: `bankId`, `bankName`, `accountNumber`, `accountType` | `packages/db/src/schema.ts:881-886` | Nómina |

---

## Problemas Identificados

### Problema 1: `employees.bankId` → `banks` Es Inútil

```typescript
// employees table (schema.ts:881)
bankId: uuid("bank_id").references(() => banks.id), // Link to Bank Master
bankName: text("bank_name"),      // LEGACY - texto libre
accountNumber: text("account_number"), // LEGACY - texto libre  
accountType: text("account_type").default("CHECKING"), // LEGACY
```

**Issue**: `banks` es solo un catálogo de bancos (Banesco, Mercantil), no tiene relación con `bankAccounts`. El campo `employees.bankId` apunta a una entidad que no tiene sentido en el contexto de empleados.

### Problema 2: `bankAccounts` Es Para la EMPRESA, No Empleados

```typescript
// bankAccounts table (schema.ts:564-582)
bankAccounts = pgTable("bank_accounts", {
  name: text("name").notNull(),        // "Banesco Principal USD"
  accountNumber: text("account_number"),
  type: text("type").notNull(),        // CHECKING, SAVINGS, WALLET
  currencyId: uuid("currency_id").references(() => currencies.id),
  branchId: uuid("branch_id").references(() => branches.id),
  currentBalance: numeric("current_balance", {...}).default("0"), // ← Solo EMPRESA tiene saldo
  isActive: boolean("is_active").default(true),
  ...
})
```

**Issue**: Cuando payroll procesa pagos, busca en `bankAccounts` (cuentas de la empresa) para debitar. Pero los datos de la cuenta DEL EMPLEADO están en campos sueltos legacy.

### Problema 3: Campos Legacy Sin Normalizar

```typescript
// employees tiene campos duplicados y sin normalizar:
employees: {
  bankId: UUID → banks.id         // Relación confusa
  bankName: string                // Texto libre, no referenciado
  accountNumber: string            // Texto libre, 20 dígitos
  accountType: string             // CHECKING, SAVINGS
}
```

### Problema 4: Payroll No Sabe a Qué Cuenta Transferir

```typescript
// payroll.service.ts - processPayment()
async processPayment(id: string, data: { bankAccountId: string }) {
  // Busca la cuenta de la EMPRESA para debitar
  const account = await db.query.bankAccounts.findFirst({
    where: eq(bankAccounts.id, data.bankAccountId),
  });
  // Pero... ¿cómo sabe qué cuenta del EMPLEADO acreditar?
  // Los campos legacy employees.bankName, employees.accountNumber no se usan
}
```

---

## Flujo Actual (Roto)

```
┌─────────────────────────────────────────────────────────────────────┐
│  employees                                                          │
│  ├─ bankId ──────────→ banks (catálogo puro: "Banesco", "0134")  │
│  ├─ bankName (texto libre: "Banesco") ───────────────────────────┐ │
│  ├─ accountNumber (texto libre: "0102-...") ────────────────────┐ │
│  └─ accountType (CHECKING) ────────────────────────────────────┐ │ │
│                                                                     │ │
│  payments                                                           │ │
│  └─ bankAccountId ──→ bankAccounts (cuentas de la EMPRESA)     │ │ │
│                                                                     │ │
│  payroll.service.ts                                                 │ │
│  ├─ Debita: bankAccounts (cuenta empresa) ✅                      │ │
│  └─ Accredita a: ??? (no hay tabla employeeBankAccounts) ❌     │ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## PROPUESTA DE MEJORA: Tabla `employeeBankAccounts`

### Nueva Estructura Normalizada

```typescript
// employeeBankAccounts (NUEVA TABLA)
export const employeeBankAccounts = pgTable("employee_bank_accounts", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  employeeId: uuid("employee_id")
    .references(() => employees.id)
    .notNull(),
  bankId: uuid("bank_id")
    .references(() => banks.id)
    .notNull(), // Catálogo de bancos
  accountNumber: text("account_number").notNull(), // "0102-1234-56-7891234567"
  accountType: text("account_type").default("CHECKING"), // CHECKING, SAVINGS
  currencyId: uuid("currency_id").references(() => currencies.id),
  isPrimary: boolean("is_primary").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### employees (modificado)

```typescript
// Eliminar campos legacy, solo mantener referencia rápida opcional
employees: {
  // ... otros campos ...
  
  // ELIMINAR: bankName, accountNumber, accountType
  // MANTENER: bankId (opcional, para referencia rápida al banco preferido)
  // NOTA: La información bancaria real ahora está en employeeBankAccounts
}
```

### Relaciones

```typescript
// employeesRelations
export const employeesRelations = relations(employees, ({ one, many }) => ({
  // ... otras relaciones ...
  bankAccounts: many(employeeBankAccounts), // Un empleado puede tener varias cuentas
}));

// employeeBankAccountsRelations  
export const employeeBankAccountsRelations = relations(
  employeeBankAccounts,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeBankAccounts.employeeId],
      references: [employees.id],
    }),
    bank: one(banks, {
      fields: [employeeBankAccounts.bankId],
      references: [banks.id],
    }),
    currency: one(currencies, {
      fields: [employeeBankAccounts.currencyId],
      references: [currencies.id],
    }),
  })
);
```

---

## Flujo Corregido (Con Nueva Tabla)

```
┌─────────────────────────────────────────────────────────────────────┐
│  banks (catálogo puro)                                              │
│  name: "Banesco", code: "0134"                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↑ N
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  employeeBankAccounts (NUEVA)                                       │
│  ├─ employeeId ──────→ employees                                    │
│  ├─ bankId ──────────→ banks.id                                     │
│  ├─ accountNumber: "0102-1234-56-7891234567"                        │
│  ├─ accountType: "CHECKING"                                         │
│  ├─ currencyId ─────→ currencies                                    │
│  └─ isPrimary: true                                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  employees                                                          │
│  ├─ ... otros campos ...                                            │
│  └─ bankAccounts: [employeeBankAccounts]  ← AHORA SÍ tiene sentido  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  payroll.service.ts                                                  │
│  ├─ Debita: bankAccounts (cuenta empresa) ✅                        │
│  └─ Accredita a: employeeBankAccounts WHERE isPrimary=true ✅       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Beneficios de la Nueva Estructura

| Beneficio | Descripción |
|-----------|-------------|
| **Normalización** | Un empleado puede tener múltiples cuentas (ahorro, corriente, digital) |
| **Integridad** | `bankId` ahora apunta a un banco real con código SUDEBAN válido |
| **Auditoría** | Historial de cuentas por empleado |
| **Migración gradual** | Campos legacy pueden depreciarse lentamente |
| **Flexibilidad** | Cada cuenta tiene su moneda (USD/VES) |

---

## Script de Migración Sugerido

```sql
-- ============================================
-- MIGRACIÓN: employeeBankAccounts
-- ============================================

-- 1. Crear nueva tabla
CREATE TABLE employee_bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) NOT NULL,
  bank_id UUID REFERENCES banks(id) NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT DEFAULT 'CHECKING',
  currency_id UUID REFERENCES currencies(id),
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Migrar datos legacy de employees
INSERT INTO employee_bank_accounts (employee_id, bank_id, account_number, account_type, is_primary)
SELECT 
  e.id,
  COALESCE(e.bank_id, (SELECT id FROM banks WHERE code = '0102' LIMIT 1)), -- Default a un banco
  e.account_number,
  COALESCE(e.account_type, 'CHECKING'),
  true
FROM employees e
WHERE e.account_number IS NOT NULL;

-- 3. Agregar constraint única por empleado primario
CREATE UNIQUE INDEX employee_bank_primary_unique 
ON employee_bank_accounts (employee_id) 
WHERE is_primary = true;

-- 4. (Opcional) Marcar campos legacy como deprecated en comentarios
-- COMMENT ON COLUMN employees.bank_name IS 'DEPRECATED: Use employee_bank_accounts';
-- COMMENT ON COLUMN employees.account_number IS 'DEPRECATED: Use employee_bank_accounts';
-- COMMENT ON COLUMN employees.account_type IS 'DEPRECATED: Use employee_bank_accounts';

-- 5. Agregar FK de employees.bankId -> banks (si no existe)
-- Nota: Esta relación ahora es solo "banco preferido", no la cuenta real
```

---

## Alternativa B: Unificar bankAccounts (No Recomendada)

### Opción: Campo Polimórfico

```typescript
bankAccounts = pgTable("bank_accounts", {
  // ... campos existentes ...
  ownerType: text("owner_type"),  // 'COMPANY' | 'EMPLOYEE'
  ownerId: uuid("owner_id"),      // branchId o employeeId
})
```

**Contra**: 
- Rompe la relación `payments.bankAccountId` (no queda claro si es cuenta empresa o empleado)
- Mezcla concerns de diferentes dominios
- Más difícil de auditar

---

## Recomendación Final

**OPCIÓN A** (Tabla `employeeBankAccounts`) es la correcta porque:

1. ✅ Separación clara de concerns
2. ✅ Un empleado puede tener **múltiples** cuentas
3. ✅ Permite auditoría por cuenta
4. ✅ Mantiene `banks` como catálogo puro
5. ✅ Migración limpia (campos legacy deprecables gradualmente)
6. ✅ La relación `employees → banks` ahora tiene sentido semántico

---

## Impacto en Código Backend

### Cambios Requeridos

| Archivo | Cambio |
|---------|--------|
| `schema.ts` | Agregar tabla `employeeBankAccounts` |
| `employees.service.ts` | Actualizar CRUD para incluir cuentas bancarias |
| `payroll.service.ts` | `processPayment()` debe buscar `employeeBankAccounts` |
| `banks.controller.ts` | No cambia (catálogo sigue igual) |
| `bank-accounts.controller.ts` | No cambia (cuentas empresa) |

### Snippet: Payroll ProcessPayment Mejorado

```typescript
// payroll.service.ts
async processPayment(id: string, data: { bankAccountId: string, employeeId: string }) {
  // 1. Obtener cuenta de la empresa para debitar
  const companyAccount = await db.query.bankAccounts.findFirst({
    where: eq(bankAccounts.id, data.bankAccountId),
  });

  // 2. Obtener cuenta PRIMARY del empleado
  const employeeAccount = await db.query.employeeBankAccounts.findFirst({
    where: and(
      eq(employeeBankAccounts.employeeId, data.employeeId),
      eq(employeeBankAccounts.isPrimary, true)
    ),
    with: { bank: true }
  });

  if (!employeeAccount) {
    throw new Error('Empleado no tiene cuenta bancaria configurada');
  }

  // 3. Generar archivo TXT para banco
  // usar: employeeAccount.bank.code + employeeAccount.accountNumber
}
```
