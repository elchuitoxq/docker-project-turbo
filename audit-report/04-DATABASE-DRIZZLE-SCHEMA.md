# DATABASE DRIZZLE - SCHEMA COMPLETO

## Resumen

| Aspecto | Cantidad |
|---------|----------|
| Total tablas | 50+ |
| Líneas de schema | 1717 |
| Relaciones | 40+ |

---

## 1. AUDIT & SECURITY SCHEMA

### audit_logs

```typescript
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  entityTable: text("entity_table").notNull(),     // 'products', 'bank_accounts'
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),               // CREATE, UPDATE, DELETE
  changes: jsonb("changes"),                      // { field: { old: val, new: val } }
  userId: uuid("user_id").references(() => users.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  documentCode: text("document_code"),             // 'PED-001', 'FAC-002'
  documentStatus: text("document_status"),        // 'PENDING', 'PAID'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### permissions

```typescript
export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull().unique(),         // 'treasury:create_account'
  description: text("description"),
  module: text("module").notNull(),              // 'treasury', 'sales'
});
```

### roles

```typescript
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull().unique(),        // 'ADMIN', 'MANAGER'
  description: text("description"),
});
```

### users

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  refreshToken: text("refresh_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### usersRoles (junction)

```typescript
export const usersRoles = pgTable("users_roles", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  roleId: uuid("role_id").references(() => roles.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.roleId] }),
}));
```

### usersBranches (multitenant)

```typescript
export const usersBranches = pgTable("users_branches", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  isDefault: boolean("is_default").default(false),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.branchId] }),
}));
```

### userAppSettings

```typescript
export const userAppSettings = pgTable("user_app_settings", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  userId: uuid("user_id").references(() => users.id).notNull(),
  settings: jsonb("settings").default({}),       // UI preferences
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## 2. CORE / PARTNERS / CURRENCIES

### branches

```typescript
export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  address: text("address"),
  taxId: text("tax_id"),                          // RIF
  phone: text("phone"),
  email: text("email"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### currencies

```typescript
export const currencies = pgTable("currencies", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull(),                  // USD, VES
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  isBase: boolean("is_base").default(false),
}, (t) => ({
  unq: uniqueIndex("currencies_code_unq").on(t.code),
}));
```

### exchangeRates

```typescript
export const exchangeRates = pgTable("exchange_rates", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  currencyId: uuid("currency_id").references(() => currencies.id).notNull(),
  rate: numeric("rate", { precision: 20, scale: 10 }).notNull(),
  date: timestamp("date").defaultNow(),
  source: text("source").default("MANUAL"),       // BCV, MANUAL, BCV_SCRAPER
});
```

### taxConcepts (ISLR)

```typescript
export const taxConcepts = pgTable("tax_concepts", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull().unique(),         // "001"
  name: text("name").notNull(),                  // "Honorarios Profesionales"
  retentionPercentage: numeric("retention_percentage", {
    precision: 5, scale: 2,
  }).notNull(),                                  // 3.00, 5.00
  baseMin: numeric("base_min", { precision: 20, scale: 2 }).default("0"), // Min UT
  sustraendo: numeric("sustraendo", { precision: 20, scale: 4 }).default("0"),
  isEnabled: boolean("is_enabled").default(true),
});
```

### partners (Clientes/Proveedores)

```typescript
export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  email: text("email"),
  taxId: text("tax_id").notNull().unique(),     // RIF or CI
  address: text("address"),
  phone: text("phone"),
  type: text("type").default("CUSTOMER"),        // CUSTOMER, SUPPLIER, BOTH
  taxpayerType: text("taxpayer_type").default("ORDINARY"), // ORDINARY, SPECIAL
  retentionRate: numeric("retention_rate", { precision: 3, scale: 0 }).default("0"),
  isSpecialTaxpayer: boolean("is_special_taxpayer").default(false),
  creditLimit: numeric("credit_limit", { precision: 20, scale: 2 }).default("0"),
  islrConceptId: uuid("islr_concept_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### organizationModules

```typescript
export const organizationModules = pgTable("organization_modules", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  moduleKey: text("module_key").notNull(),      // 'inventory', 'sales'
  isEnabled: boolean("is_enabled").default(false),
  branchId: uuid("branch_id").references(() => branches.id),
});
```

---

## 3. INVENTORY SCHEMA

### warehouses

```typescript
export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  branchId: uuid("branch_id").references(() => branches.id),
  name: text("name").notNull(),                 // "Almacén Principal"
  address: text("address"),
  isActive: boolean("is_active").default(true),
});
```

### productCategories

```typescript
export const productCategories = pgTable("product_categories", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  description: text("description"),
  parentId: uuid("parent_id"),                  // Self-reference
});
```

### products

```typescript
export const products = pgTable("products", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => productCategories.id),
  cost: numeric("cost", { precision: 20, scale: 2 }).default("0"),
  price: numeric("price", { precision: 20, scale: 2 }).default("0"),
  isExempt: boolean("is_exempt").default(false), // Exento de IVA
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("16.00"),
  type: text("type").default("PHYSICAL"),       // PHYSICAL, SERVICE, CONSUMABLE
  minStock: numeric("min_stock", { precision: 20, scale: 2 }).default("0"),
  hasBatches: boolean("has_batches").default(false),
  currencyId: uuid("currency_id").references(() => currencies.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### productBatches

```typescript
export const productBatches = pgTable("product_batches", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchNumber: text("batch_number").notNull(),
  expirationDate: timestamp("expiration_date"),
  cost: numeric("cost", { precision: 20, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### stock

```typescript
export const stock = pgTable("stock", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => productBatches.id),
  quantity: numeric("quantity", { precision: 20, scale: 4 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### inventoryMoves

```typescript
export const inventoryMoves = pgTable("inventory_moves", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull(),                 // IN-001, OUT-005
  type: text("type").notNull(),                 // IN, OUT, TRANSFER, ADJUST
  status: text("status").notNull().default("APPROVED"), // DRAFT, APPROVED, REJECTED
  source: text("source").notNull().default("SYSTEM"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id),
  toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id),
  date: timestamp("date").defaultNow(),
  note: text("note"),
  userId: uuid("user_id").references(() => users.id),
});
```

### inventoryMoveLines

```typescript
export const inventoryMoveLines = pgTable("inventory_move_lines", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  moveId: uuid("move_id").references(() => inventoryMoves.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => productBatches.id),
  quantity: numeric("quantity", { precision: 20, scale: 4 }).notNull(),
  cost: numeric("cost", { precision: 20, scale: 2 }),
});
```

---

## 4. ORDERS & BILLING SCHEMA

### orders

```typescript
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull().unique(),       // PED-0001
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  type: text("type").default("SALE"),          // SALE, PURCHASE
  status: text("status").default("PENDING"),   // PENDING, CONFIRMED, COMPLETED, CANCELLED
  total: numeric("total", { precision: 20, scale: 2 }).default("0"),
  exchangeRate: numeric("exchange_rate", { precision: 20, scale: 10 }).default("1"),
  currencyId: uuid("currency_id").references(() => currencies.id),
  date: timestamp("date").defaultNow(),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### orderItems

```typescript
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => productBatches.id),
  quantity: numeric("quantity", { precision: 20, scale: 4 }).notNull(),
  price: numeric("price", { precision: 20, scale: 2 }).notNull(),
});
```

### invoices

```typescript
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull().unique(),       // Control Number: A-00001
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  currencyId: uuid("currency_id").references(() => currencies.id).notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 20, scale: 10 }).notNull(),
  type: text("type").default("SALE"),          // SALE, PURCHASE
  invoiceNumber: text("invoice_number"),       // External number for purchases
  userId: uuid("user_id").references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  status: text("status").default("DRAFT"),     // DRAFT, POSTED, PAID, VOID
  fiscalStatus: text("fiscal_status").default("PENDING"),
  totalBase: numeric("total_base", { precision: 20, scale: 2 }).default("0"),
  totalTax: numeric("total_tax", { precision: 20, scale: 2 }).default("0"),
  totalIgtf: numeric("total_igtf", { precision: 20, scale: 2 }).default("0"),
  total: numeric("total", { precision: 20, scale: 2 }).default("0"),
  date: timestamp("date").defaultNow(),
  dueDate: timestamp("due_date"),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### invoiceItems

```typescript
export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  quantity: numeric("quantity", { precision: 20, scale: 4 }).notNull(),
  price: numeric("price", { precision: 20, scale: 2 }).notNull(),
  cost: numeric("cost", { precision: 20, scale: 2 }),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  total: numeric("total", { precision: 20, scale: 2 }).notNull(),
});
```

### creditNotes

```typescript
export const creditNotes = pgTable("credit_notes", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull().unique(),       // NC-00001
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  currencyId: uuid("currency_id").references(() => currencies.id).notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 20, scale: 6 }).notNull(),
  status: text("status").default("DRAFT"),
  totalBase: numeric("total_base", { precision: 20, scale: 2 }).default("0"),
  totalTax: numeric("total_tax", { precision: 20, scale: 2 }).default("0"),
  totalIgtf: numeric("total_igtf", { precision: 20, scale: 2 }).default("0"),
  total: numeric("total", { precision: 20, scale: 2 }).default("0"),
  date: timestamp("date").defaultNow(),
  userId: uuid("user_id").references(() => users.id),
  parentPaymentId: uuid("parent_payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### creditNoteItems

```typescript
export const creditNoteItems = pgTable("credit_note_items", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  creditNoteId: uuid("credit_note_id").references(() => creditNotes.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  quantity: numeric("quantity", { precision: 20, scale: 4 }).notNull(),
  price: numeric("price", { precision: 20, scale: 2 }).notNull(),
  total: numeric("total", { precision: 20, scale: 2 }).notNull(),
});
```

### creditNoteUsages

```typescript
export const creditNoteUsages = pgTable("credit_note_usages", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  creditNoteId: uuid("credit_note_id").references(() => creditNotes.id).notNull(),
  paymentId: uuid("payment_id").references(() => payments.id).notNull(),
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 5. TREASURY & PAYMENTS SCHEMA

### paymentMethods

```typescript
export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),                 // "Efectivo USD"
  code: text("code").notNull(),                 // "CASH_USD", "POS", "RET_IVA_75"
  isDigital: boolean("is_digital").default(false),
  currencyId: uuid("currency_id").references(() => currencies.id),
  branchId: uuid("branch_id").references(() => branches.id),
}, (t) => ({
  unq: uniqueIndex("payment_methods_code_branch_unq").on(t.code, t.branchId),
}));
```

### bankAccounts

```typescript
export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),                 // "Banesco Principal"
  accountNumber: text("account_number"),
  type: text("type").notNull(),                 // CHECKING, SAVINGS, WALLET
  currencyId: uuid("currency_id").references(() => currencies.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id),
  currentBalance: numeric("current_balance", { precision: 20, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### payments

```typescript
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  methodId: uuid("method_id").references(() => paymentMethods.id).notNull(),
  status: text("status").default("POSTED"),     // POSTED, VOID
  type: text("type").default("INCOME"),        // INCOME, EXPENSE
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  currencyId: uuid("currency_id").references(() => currencies.id).notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 20, scale: 10 }).notNull(),
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id),
  payrollRunId: uuid("payroll_run_id"),
  reference: text("reference"),
  metadata: jsonb("metadata"),
  date: timestamp("date").defaultNow(),
  userId: uuid("user_id").references(() => users.id),
});
```

### paymentAllocations

```typescript
export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  paymentId: uuid("payment_id").references(() => payments.id).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### paymentMethodAccounts (junction)

```typescript
export const paymentMethodAccounts = pgTable("payment_method_accounts", {
  methodId: uuid("method_id").references(() => paymentMethods.id).notNull(),
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.methodId, t.bankAccountId] }),
}));
```

### taxRetentions

```typescript
export const taxRetentions = pgTable("tax_retentions", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull().unique(),       // YYYYMM-0000X
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  period: text("period").notNull(),             // "202401"
  type: text("type").notNull(),                // IVA, ISLR
  totalBase: numeric("total_base", { precision: 20, scale: 2 }).notNull(),
  totalTax: numeric("total_tax", { precision: 20, scale: 2 }).default("0"),
  totalRetained: numeric("total_retained", { precision: 20, scale: 2 }).notNull(),
  xmlContent: text("xml_content"),
  date: timestamp("date").defaultNow(),
  userId: uuid("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### taxRetentionLines

```typescript
export const taxRetentionLines = pgTable("tax_retention_lines", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  retentionId: uuid("retention_id").references(() => taxRetentions.id).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  paymentId: uuid("payment_id").references(() => payments.id),
  baseAmount: numeric("base_amount", { precision: 20, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 20, scale: 2 }).default("0"),
  retainedAmount: numeric("retained_amount", { precision: 20, scale: 2 }).notNull(),
  conceptId: uuid("concept_id").references(() => taxConcepts.id),
});
```

### documentLinks (polimórfico)

```typescript
export const documentLinks = pgTable("document_links", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  sourceId: uuid("source_id").notNull(),
  sourceTable: text("source_table").notNull(), // 'orders', 'invoices'
  targetId: uuid("target_id").notNull(),
  targetTable: text("target_table").notNull(), // 'invoices', 'payments'
  type: text("type").notNull(),                // ORDER_TO_INVOICE, INVOICE_TO_PAYMENT
  createdAt: timestamp("created_at").defaultNow(),
  userId: uuid("user_id").references(() => users.id),
});
```

---

## 6. HR SCHEMA

### banks (Catálogo)

```typescript
export const banks = pgTable("banks", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),                 // "Banesco", "Mercantil"
  code: text("code").notNull().unique(),       // "0134", "0105"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### departments

```typescript
export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### jobPositions

```typescript
export const jobPositions = pgTable("job_positions", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull().unique(),       // "Gerente", "Vendedor"
  description: text("description"),
  currencyId: uuid("currency_id").references(() => currencies.id),
  baseSalaryMin: numeric("base_salary_min", { precision: 20, scale: 2 }).default("0"),
  baseSalaryMax: numeric("base_salary_max", { precision: 20, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### employees

```typescript
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  identityCard: text("identity_card").notNull().unique(), // CI
  email: text("email"),
  phone: text("phone"),
  positionId: uuid("position_id").references(() => jobPositions.id),
  departmentId: uuid("department_id").references(() => departments.id),
  branchId: uuid("branch_id").references(() => branches.id),
  hireDate: timestamp("hire_date").defaultNow(),
  terminationDate: timestamp("termination_date"),
  terminationReason: text("termination_reason"),
  salaryCurrencyId: uuid("salary_currency_id").references(() => currencies.id),
  baseSalary: numeric("base_salary", { precision: 20, scale: 2 }).notNull(),
  payFrequency: text("pay_frequency").default("BIWEEKLY"),
  paymentMethod: text("payment_method").default("BANK_TRANSFER"),
  bankId: uuid("bank_id").references(() => banks.id),
  // LEGACY: campos que deberían normalizarse
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountType: text("account_type").default("CHECKING"),
  status: text("status").default("ACTIVE"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### employeeContracts

```typescript
export const employeeContracts = pgTable("employee_contracts", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  type: text("type").notNull(),               // INDEFINIDO, DETERMINADO, OBRA
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  trialPeriodEnd: timestamp("trial_period_end"), // Art. 80 LOTTT
  weeklyHours: numeric("weekly_hours", { precision: 10, scale: 2 }).default("40"),
  notes: text("notes"),
  status: text("status").default("ACTIVE"),    // ACTIVE, EXPIRED, TERMINATED
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### employeeBenefits

```typescript
export const employeeBenefits = pgTable("employee_benefits", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  monthlySalary: numeric("monthly_salary", { precision: 20, scale: 2 }).notNull(),
  integralSalary: numeric("integral_salary", { precision: 20, scale: 2 }).notNull(),
  days: integer("days").default(15),
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  accumulatedAmount: numeric("accumulated_amount", { precision: 20, scale: 2 }).default("0"),
  type: text("type").default("REGULAR"),      // REGULAR, ANTICIPO, LIQUIDACION
  paid: boolean("paid").default(false),
  paymentDate: timestamp("payment_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### employeeVacations

```typescript
export const employeeVacations = pgTable("employee_vacations", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  year: integer("year").notNull(),
  totalDays: integer("total_days").notNull(), // 15 + 1 per year (max 30)
  daysTaken: integer("days_taken").default(0),
  daysPending: integer("days_pending").notNull(),
  status: text("status").default("PENDING"), // PENDING, TAKEN, PAID
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  returnDate: timestamp("return_date"),
  paymentDate: timestamp("payment_date"),
  amount: numeric("amount", { precision: 20, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### employeeProfitSharing

```typescript
export const employeeProfitSharing = pgTable("employee_profit_sharing", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  year: integer("year").notNull(),
  daysToPay: integer("days_to_pay").notNull(),
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date"),
  status: text("status").default("PENDING"), // PENDING, PAID
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### payrollRuns

```typescript
export const payrollRuns = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull().unique(),       // NOM-2024-01-15
  branchId: uuid("branch_id").references(() => branches.id).notNull(),
  frequency: text("frequency").notNull(),      // WEEKLY, BIWEEKLY, MONTHLY
  currencyId: uuid("currency_id").references(() => currencies.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalAmount: numeric("total_amount", { precision: 20, scale: 2 }).default("0"),
  status: text("status").default("DRAFT"),    // DRAFT, PAID
  createdAt: timestamp("created_at").defaultNow(),
});
```

### payrollItems

```typescript
export const payrollItems = pgTable("payroll_items", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  runId: uuid("run_id").references(() => payrollRuns.id).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  baseAmount: numeric("base_amount", { precision: 20, scale: 2 }).notNull(),
  bonuses: numeric("bonuses", { precision: 20, scale: 2 }).default("0"),
  deductions: numeric("deductions", { precision: 20, scale: 2 }).default("0"),
  netTotal: numeric("net_total", { precision: 20, scale: 2 }).notNull(),
});
```

### payrollItemLines

```typescript
export const payrollItemLines = pgTable("payroll_item_lines", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  itemId: uuid("item_id").references(() => payrollItems.id).notNull(),
  conceptCode: text("concept_code").notNull(), // "SSO_EMP", "CESTATICKET"
  conceptName: text("concept_name").notNull(), // "Seguro Social (Empleado)"
  category: text("category").notNull(),        // INCOME, DEDUCTION, EMPLOYER
  base: numeric("base", { precision: 20, scale: 2 }).default("0"),
  rate: numeric("rate", { precision: 10, scale: 4 }).default("0"),
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### payrollSettings

```typescript
export const payrollSettings = pgTable("payroll_settings", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  key: text("key").notNull().unique(),         // "CESTATICKET_USD", "SSO_EMP"
  label: text("label").notNull(),
  value: numeric("value", { precision: 20, scale: 4 }).notNull(),
  type: text("type").notNull(),                // FIXED_USD, PERCENTAGE, FIXED_VES
  branchId: uuid("branch_id").references(() => branches.id),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### payrollConceptTypes

```typescript
export const payrollConceptTypes = pgTable("payroll_concept_types", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull().unique(),      // "EXTRA_HOUR", "LATE"
  name: text("name").notNull(),
  category: text("category").notNull(),        // INCOME, DEDUCTION
  isSystem: boolean("is_system").default(false),
  branchId: uuid("branch_id").references(() => branches.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### payrollIncidents

```typescript
export const payrollIncidents = pgTable("payroll_incidents", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  conceptId: uuid("concept_id").references(() => payrollConceptTypes.id).notNull(),
  date: timestamp("date").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1"),
  amount: numeric("amount", { precision: 20, scale: 2 }),
  status: text("status").default("PENDING"),  // PENDING, PROCESSED
  processedInRunId: uuid("processed_in_run_id").references(() => payrollRuns.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### employeeSalaryHistory

```typescript
export const employeeSalaryHistory = pgTable("employee_salary_history", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  employeeId: uuid("employee_id").references(() => employees.id).notNull(),
  previousSalary: numeric("previous_salary", { precision: 20, scale: 2 }).notNull(),
  newSalary: numeric("new_salary", { precision: 20, scale: 2 }).notNull(),
  currencyId: uuid("currency_id").references(() => currencies.id),
  reason: text("reason"),
  effectiveDate: timestamp("effective_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 7. ACCOUNTING SCHEMA

### accountingAccounts

```typescript
export const accountingAccounts = pgTable("accounting_accounts", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull(),               // "5.1.01.01"
  name: text("name").notNull(),
  type: text("type").notNull(),               // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  branchId: uuid("branch_id").references(() => branches.id),
  parentId: uuid("parent_id"),
  isActive: boolean("is_active").default(true),
}, (table) => [
  uniqueIndex("accounting_accounts_code_branch_idx").on(table.code, table.branchId),
]);
```

### accountingEntries

```typescript
export const accountingEntries = pgTable("accounting_entries", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  reference: text("reference"),               // Source: "NOM-2024-01-15"
  branchId: uuid("branch_id").references(() => branches.id),
  status: text("status").default("POSTED"),   // DRAFT, POSTED
  createdAt: timestamp("created_at").defaultNow(),
  userId: uuid("user_id").references(() => users.id),
});
```

### accountingEntryLines

```typescript
export const accountingEntryLines = pgTable("accounting_entry_lines", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  entryId: uuid("entry_id").references(() => accountingEntries.id).notNull(),
  accountId: uuid("account_id").references(() => accountingAccounts.id).notNull(),
  debit: numeric("debit", { precision: 20, scale: 2 }).default("0"),
  credit: numeric("credit", { precision: 20, scale: 2 }).default("0"),
  description: text("description"),
});
```

### accountingMaps

```typescript
export const accountingMaps = pgTable("accounting_maps", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  branchId: uuid("branch_id").references(() => branches.id),
  module: text("module").notNull(),           // SALES, PROCUREMENT, INVENTORY, TREASURY
  transactionType: text("transaction_type"),
  categoryId: uuid("category_id").references(() => productCategories.id),
  productId: uuid("product_id").references(() => products.id),
  paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id),
  debitAccountId: uuid("debit_account_id").references(() => accountingAccounts.id),
  creditAccountId: uuid("credit_account_id").references(() => accountingAccounts.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 8. LOANS SCHEMA

### loans

```typescript
export const loans = pgTable("loans", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  code: text("code").notNull().unique(),     // PRE-001
  partnerId: uuid("partner_id").references(() => partners.id).notNull(),
  status: text("status").default("ACTIVE"),   // ACTIVE, RETURNED, OVERDUE
  startDate: timestamp("start_date").defaultNow(),
  dueDate: timestamp("due_date"),
  returnDate: timestamp("return_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### loanItems

```typescript
export const loanItems = pgTable("loan_items", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  loanId: uuid("loan_id").references(() => loans.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  quantity: numeric("quantity", { precision: 20, scale: 4 }).notNull(),
  serialNumber: text("serial_number"),
  condition: text("condition").default("GOOD"), // GOOD, DAMAGED
});
```
