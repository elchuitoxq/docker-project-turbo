import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  numeric,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

function uuidv7() {
  return crypto.randomUUID();
}

export { uuidv7 };

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    entityTable: text('entity_table').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: text('action').notNull(),
    changes: jsonb('changes'),
    branchId: uuid('branch_id'),
    userId: uuid('user_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    documentCode: text('document_code'),
    documentStatus: text('document_status'),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    branchCreatedIdx: index('audit_logs_branch_created_idx').on(t.branchId, t.createdAt),
  })
);
export const permissions = pgTable('permissions', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  description: text('description'),
  module: text('module').notNull(),
});

export const roles = pgTable('roles', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text('name').notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
});

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  refreshToken: text('refresh_token'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Tokens de recuperación de contraseña.
 * Se guarda solo el hash SHA-256 del token: el valor en claro viaja únicamente
 * al usuario. `usedAt` lo vuelve de un solo uso y `expiresAt` acota la ventana.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    tokenHashUnique: uniqueIndex('password_reset_tokens_token_hash_unique').on(t.tokenHash),
  })
);

export const usersRoles = pgTable(
  'users_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
  },
  t => ({
    pk: primaryKey({ columns: [t.userId, t.roleId] }),
  })
);

export const usersBranches = pgTable(
  'users_branches',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    isDefault: boolean('is_default').notNull().default(false),
  },
  t => ({
    pk: primaryKey({ columns: [t.userId, t.branchId] }),
    oneDefaultPerUser: uniqueIndex('users_branches_one_default_per_user')
      .on(t.userId)
      .where(sql`${t.isDefault} = true`),
  })
);

export const userAppSettings = pgTable('user_app_settings', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  userId: uuid('user_id').notNull(),
  settings: jsonb('settings').default({}),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const rolesPermissions = pgTable(
  'roles_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'restrict' }),
  },
  t => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  })
);

export const companies = pgTable(
  'companies',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text('name').notNull(),
    taxId: text('tax_id'),
    address: text('address'),
    phone: text('phone'),
    email: text('email'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  t => ({ taxIdUnique: uniqueIndex('companies_tax_id_unq').on(t.taxId) })
);

export const branches = pgTable('branches', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const currencies = pgTable(
  'currencies',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    code: text('code').notNull(),
    name: text('name').notNull(),
    symbol: text('symbol').notNull(),
    isBase: boolean('is_base').default(false),
  },
  t => ({
    unq: uniqueIndex('currencies_code_unq').on(t.code),
    // Una sola moneda funcional: la base se elige una vez y no se cambia sin migración contable.
    oneBase: uniqueIndex('currencies_one_base_idx')
      .on(t.isBase)
      .where(sql`${t.isBase} = true`),
  })
);

export const exchangeRates = pgTable(
  'exchange_rates',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    currencyId: uuid('currency_id').notNull(),
    rate: numeric('rate', { precision: 20, scale: 10 }).notNull(),
    date: timestamp('date').defaultNow(),
    source: text('source').default('MANUAL'),
    /** Usuario que cargó la tasa a mano; nulo cuando viene del job de BCV. */
    createdBy: uuid('created_by'),
    /** Motivo obligatorio en los overrides manuales (M9 de `S-08`). */
    reason: text('reason'),
  },
  t => ({
    uniquePerDay: uniqueIndex('exchange_rates_currency_date_unq').on(t.currencyId, t.date),
  })
);

export const taxConcepts = pgTable('tax_concepts', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  retentionPercentage: numeric('retention_percentage', {
    precision: 5,
    scale: 2,
  }).notNull(),
  baseMin: numeric('base_min', { precision: 20, scale: 2 }).default('0'),
  sustraendo: numeric('sustraendo', { precision: 20, scale: 4 }).default('0'),
  isEnabled: boolean('is_enabled').default(true),
});

export const partners = pgTable('partners', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  email: text('email'),
  taxId: text('tax_id').notNull().unique(),
  address: text('address'),
  phone: text('phone'),
  type: text('type').default('CUSTOMER'),
  taxpayerType: text('taxpayer_type').default('ORDINARY'),
  retentionRate: numeric('retention_rate', { precision: 3, scale: 0 }).default('0'),
  isSpecialTaxpayer: boolean('is_special_taxpayer').default(false),
  creditLimit: numeric('credit_limit', { precision: 20, scale: 2 }).default('0'),
  islrConceptId: uuid('islr_concept_id'),
  /** Baja logica (T-01-17): un maestro con movimientos no se borra, se desactiva. */
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const organizationModules = pgTable('organization_modules', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  moduleKey: text('module_key').notNull(),
  isEnabled: boolean('is_enabled').default(false),
  branchId: uuid('branch_id'),
});

export const warehouses = pgTable('warehouses', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  branchId: uuid('branch_id'),
  name: text('name').notNull(),
  address: text('address'),
  isActive: boolean('is_active').default(true),
});

export const productCategories = pgTable('product_categories', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  description: text('description'),
  parentId: uuid('parent_id'),
});

export const products = pgTable('products', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  categoryId: uuid('category_id'),
  cost: numeric('cost', { precision: 20, scale: 2 }).default('0'),
  price: numeric('price', { precision: 20, scale: 2 }).default('0'),
  isExempt: boolean('is_exempt').default(false),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('16.00'),
  type: text('type').default('PHYSICAL'),
  minStock: numeric('min_stock', { precision: 20, scale: 2 }).default('0'),
  hasBatches: boolean('has_batches').default(false),
  currencyId: uuid('currency_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const productBatches = pgTable('product_batches', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  productId: uuid('product_id').notNull(),
  batchNumber: text('batch_number').notNull(),
  expirationDate: timestamp('expiration_date'),
  cost: numeric('cost', { precision: 20, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const stock = pgTable(
  'stock',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    warehouseId: uuid('warehouse_id').notNull(),
    productId: uuid('product_id').notNull(),
    batchId: uuid('batch_id'),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).default('0'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  t => ({
    unqWarehouseProductBatch: uniqueIndex('stock_warehouse_product_batch_unq').on(
      t.warehouseId,
      t.productId,
      t.batchId
    ),
  })
);

export const inventoryMoves = pgTable(
  'inventory_moves',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    code: text('code').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull().default('APPROVED'),
    branchId: uuid('branch_id'),
    source: text('source').notNull().default('SYSTEM'),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at'),
    rejectionReason: text('rejection_reason'),
    fromWarehouseId: uuid('from_warehouse_id'),
    toWarehouseId: uuid('to_warehouse_id'),
    date: timestamp('date').defaultNow(),
    note: text('note'),
    userId: uuid('user_id'),
  },
  t => ({
    branchDateIdx: index('inventory_moves_branch_date_idx').on(t.branchId, t.date),
  })
);

export const inventoryMoveLines = pgTable('inventory_move_lines', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  moveId: uuid('move_id').notNull(),
  productId: uuid('product_id').notNull(),
  batchId: uuid('batch_id'),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  cost: numeric('cost', { precision: 20, scale: 2 }),
});

export const orders = pgTable('orders', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  partnerId: uuid('partner_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  warehouseId: uuid('warehouse_id'),
  type: text('type').default('SALE'),
  status: text('status').default('PENDING'),
  total: numeric('total', { precision: 20, scale: 2 }).default('0'),
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }).default('1'),
  currencyId: uuid('currency_id'),
  date: timestamp('date').defaultNow(),
  userId: uuid('user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  orderId: uuid('order_id').notNull(),
  productId: uuid('product_id').notNull(),
  batchId: uuid('batch_id'),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  price: numeric('price', { precision: 20, scale: 2 }).notNull(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  partnerId: uuid('partner_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  currencyId: uuid('currency_id').notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }).notNull(),
  type: text('type').default('SALE'),
  invoiceNumber: text('invoice_number'),
  userId: uuid('user_id'),
  orderId: uuid('order_id'),
  status: text('status').default('DRAFT'),
  fiscalStatus: text('fiscal_status').default('PENDING'),
  totalBase: numeric('total_base', { precision: 20, scale: 2 }).default('0'),
  totalTax: numeric('total_tax', { precision: 20, scale: 2 }).default('0'),
  totalIgtf: numeric('total_igtf', { precision: 20, scale: 2 }).default('0'),
  total: numeric('total', { precision: 20, scale: 2 }).default('0'),
  date: timestamp('date').defaultNow(),
  dueDate: timestamp('due_date'),
  warehouseId: uuid('warehouse_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  invoiceId: uuid('invoice_id').notNull(),
  productId: uuid('product_id').notNull(),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  price: numeric('price', { precision: 20, scale: 2 }).notNull(),
  cost: numeric('cost', { precision: 20, scale: 2 }),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0'),
  total: numeric('total', { precision: 20, scale: 2 }).notNull(),
});

export const creditNotes = pgTable('credit_notes', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  invoiceId: uuid('invoice_id'),
  partnerId: uuid('partner_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  warehouseId: uuid('warehouse_id'),
  currencyId: uuid('currency_id').notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 6 }).notNull(),
  status: text('status').default('DRAFT'),
  totalBase: numeric('total_base', { precision: 20, scale: 2 }).default('0'),
  totalTax: numeric('total_tax', { precision: 20, scale: 2 }).default('0'),
  totalIgtf: numeric('total_igtf', { precision: 20, scale: 2 }).default('0'),
  total: numeric('total', { precision: 20, scale: 2 }).default('0'),
  date: timestamp('date').defaultNow(),
  userId: uuid('user_id'),
  parentPaymentId: uuid('parent_payment_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const creditNoteItems = pgTable('credit_note_items', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  creditNoteId: uuid('credit_note_id').notNull(),
  productId: uuid('product_id').notNull(),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  price: numeric('price', { precision: 20, scale: 2 }).notNull(),
  total: numeric('total', { precision: 20, scale: 2 }).notNull(),
});

export const creditNoteUsages = pgTable('credit_note_usages', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  creditNoteId: uuid('credit_note_id').notNull(),
  paymentId: uuid('payment_id').notNull(),
  amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text('name').notNull(),
    code: text('code').notNull(),
    isDigital: boolean('is_digital').default(false),
    currencyId: uuid('currency_id'),
    branchId: uuid('branch_id'),
  },
  t => ({
    unq: uniqueIndex('payment_methods_code_branch_unq').on(t.code, t.branchId),
  })
);

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  accountNumber: text('account_number'),
  type: text('type').notNull(),
  currencyId: uuid('currency_id').notNull(),
  branchId: uuid('branch_id'),
  currentBalance: numeric('current_balance', { precision: 20, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  invoiceId: uuid('invoice_id'),
  partnerId: uuid('partner_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  methodId: uuid('method_id').notNull(),
  status: text('status').default('POSTED'),
  type: text('type').default('INCOME'),
  amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
  currencyId: uuid('currency_id').notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }).notNull(),
  /** Monto en moneda funcional (VES): amount x exchangeRate (M2 de `S-08`). */
  amountBase: numeric('amount_base', { precision: 20, scale: 2 }).notNull().default('0'),
  bankAccountId: uuid('bank_account_id'),
  payrollRunId: uuid('payroll_run_id'),
  reference: text('reference'),
  metadata: jsonb('metadata'),
  date: timestamp('date').defaultNow(),
  userId: uuid('user_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  paymentId: uuid('payment_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
  /** Importe aplicado en moneda funcional (M8 de `S-08`). */
  amountBase: numeric('amount_base', { precision: 20, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paymentMethodAccounts = pgTable(
  'payment_method_accounts',
  {
    methodId: uuid('method_id').notNull(),
    bankAccountId: uuid('bank_account_id').notNull(),
  },
  t => ({
    pk: primaryKey({ columns: [t.methodId, t.bankAccountId] }),
  })
);

export const taxRetentions = pgTable('tax_retentions', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  partnerId: uuid('partner_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  period: text('period').notNull(),
  type: text('type').notNull(),
  totalBase: numeric('total_base', { precision: 20, scale: 2 }).notNull(),
  totalTax: numeric('total_tax', { precision: 20, scale: 2 }).default('0'),
  totalRetained: numeric('total_retained', { precision: 20, scale: 2 }).notNull(),
  /** Moneda y tasa del comprobante de retencion (M2 de `S-08`). */
  currencyId: uuid('currency_id'),
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }),
  totalRetainedBase: numeric('total_retained_base', { precision: 20, scale: 2 }),
  xmlContent: text('xml_content'),
  date: timestamp('date').defaultNow(),
  userId: uuid('user_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const taxRetentionLines = pgTable('tax_retention_lines', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  retentionId: uuid('retention_id').notNull(),
  invoiceId: uuid('invoice_id'),
  paymentId: uuid('payment_id'),
  baseAmount: numeric('base_amount', { precision: 20, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 20, scale: 2 }).default('0'),
  retainedAmount: numeric('retained_amount', { precision: 20, scale: 2 }).notNull(),
  conceptId: uuid('concept_id'),
});

export const documentLinks = pgTable('document_links', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  sourceId: uuid('source_id').notNull(),
  sourceTable: text('source_table').notNull(),
  targetId: uuid('target_id').notNull(),
  targetTable: text('target_table').notNull(),
  type: text('type').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  userId: uuid('user_id'),
});

export const banks = pgTable('banks', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const departments = pgTable('departments', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  parentId: uuid('parent_id'),
  branchId: uuid('branch_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const jobPositions = pgTable('job_positions', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text('name').notNull().unique(),
  description: text('description'),
  currencyId: uuid('currency_id'),
  baseSalaryMin: numeric('base_salary_min', { precision: 20, scale: 2 }).default('0'),
  baseSalaryMax: numeric('base_salary_max', { precision: 20, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const employees = pgTable('employees', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  identityCard: text('identity_card').notNull().unique(),
  email: text('email'),
  phone: text('phone'),
  positionId: uuid('position_id'),
  departmentId: uuid('department_id'),
  branchId: uuid('branch_id'),
  hireDate: timestamp('hire_date').defaultNow(),
  terminationDate: timestamp('termination_date'),
  terminationReason: text('termination_reason'),
  salaryCurrencyId: uuid('salary_currency_id'),
  baseSalary: numeric('base_salary', { precision: 20, scale: 2 }).notNull(),
  payFrequency: text('pay_frequency').default('BIWEEKLY'),
  paymentMethod: text('payment_method').default('BANK_TRANSFER'),
  bankId: uuid('bank_id'),
  bankName: text('bank_name'),
  accountNumber: text('account_number'),
  accountType: text('account_type').default('CHECKING'),
  status: text('status').default('ACTIVE'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const employeeContracts = pgTable('employee_contracts', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id').notNull(),
  type: text('type').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  trialPeriodEnd: timestamp('trial_period_end'),
  weeklyHours: numeric('weekly_hours', { precision: 10, scale: 2 }).default('40'),
  notes: text('notes'),
  status: text('status').default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const employeeBenefits = pgTable('employee_benefits', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  monthlySalary: numeric('monthly_salary', { precision: 20, scale: 2 }).notNull(),
  integralSalary: numeric('integral_salary', { precision: 20, scale: 2 }).notNull(),
  days: integer('days').default(15),
  amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
  accumulatedAmount: numeric('accumulated_amount', { precision: 20, scale: 2 }).default('0'),
  type: text('type').default('REGULAR'),
  paid: boolean('paid').default(false),
  paymentDate: timestamp('payment_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const employeeVacations = pgTable('employee_vacations', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id').notNull(),
  year: integer('year').notNull(),
  totalDays: integer('total_days').notNull(),
  daysTaken: integer('days_taken').default(0),
  daysPending: integer('days_pending').notNull(),
  status: text('status').default('PENDING'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  returnDate: timestamp('return_date'),
  paymentDate: timestamp('payment_date'),
  amount: numeric('amount', { precision: 20, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const employeeProfitSharing = pgTable('employee_profit_sharing', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id').notNull(),
  year: integer('year').notNull(),
  daysToPay: integer('days_to_pay').notNull(),
  amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
  paymentDate: timestamp('payment_date'),
  status: text('status').default('PENDING'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  branchId: uuid('branch_id').notNull(),
  frequency: text('frequency').notNull(),
  currencyId: uuid('currency_id').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  totalAmount: numeric('total_amount', { precision: 20, scale: 2 }).default('0'),
  status: text('status').default('DRAFT'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const payrollItems = pgTable('payroll_items', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  runId: uuid('run_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  baseAmount: numeric('base_amount', { precision: 20, scale: 2 }).notNull(),
  bonuses: numeric('bonuses', { precision: 20, scale: 2 }).default('0'),
  deductions: numeric('deductions', { precision: 20, scale: 2 }).default('0'),
  netTotal: numeric('net_total', { precision: 20, scale: 2 }).notNull(),
});

export const payrollItemLines = pgTable('payroll_item_lines', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  itemId: uuid('item_id').notNull(),
  conceptCode: text('concept_code').notNull(),
  conceptName: text('concept_name').notNull(),
  category: text('category').notNull(),
  base: numeric('base', { precision: 20, scale: 2 }).default('0'),
  rate: numeric('rate', { precision: 10, scale: 4 }).default('0'),
  amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const payrollSettings = pgTable(
  'payroll_settings',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id'),
    key: text('key').notNull(),
    label: text('label').notNull(),
    value: numeric('value', { precision: 20, scale: 4 }).notNull(),
    type: text('type').notNull(),
    effectiveFrom: timestamp('effective_from').notNull().defaultNow(),
    isActive: boolean('is_active').default(true),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  t => ({
    // Vigencia por empresa (sin sucursal) y por sucursal: dos índices parciales porque en Postgres
    // los NULL no colisionan entre si y un único índice no protegeria ambos casos.
    companyUnq: uniqueIndex('payroll_settings_company_unq')
      .on(t.companyId, t.key, t.effectiveFrom)
      .where(sql`${t.branchId} is null`),
    branchUnq: uniqueIndex('payroll_settings_branch_unq')
      .on(t.companyId, t.branchId, t.key, t.effectiveFrom)
      .where(sql`${t.branchId} is not null`),
    lookupIdx: index('payroll_settings_lookup_idx').on(t.companyId, t.key, t.effectiveFrom),
  })
);

export const payrollPeriodSettings = pgTable(
  'payroll_period_settings',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    runId: uuid('run_id')
      .notNull()
      .references(() => payrollRuns.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    value: numeric('value', { precision: 20, scale: 4 }).notNull(),
    type: text('type').notNull(),
    branchId: uuid('branch_id'),
    effectiveFrom: timestamp('effective_from').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    runKeyUnq: uniqueIndex('payroll_period_settings_run_key_unq').on(t.runId, t.key),
  })
);

export const payrollConceptTypes = pgTable(
  'payroll_concept_types',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    kind: text('kind').notNull().default('FIXED'),
    expression: text('expression'),
    affectsIntegralSalary: boolean('affects_integral_salary').notNull().default(false),
    isSalarial: boolean('is_salarial').notNull().default(true),
    isSystem: boolean('is_system').default(false),
    branchId: uuid('branch_id'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    companyCodeUnq: uniqueIndex('payroll_concept_types_company_code_unq').on(t.companyId, t.code),
  })
);

export const payrollIncidents = pgTable('payroll_incidents', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id').notNull(),
  conceptId: uuid('concept_id').notNull(),
  date: timestamp('date').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).default('1'),
  amount: numeric('amount', { precision: 20, scale: 2 }),
  status: text('status').default('PENDING'),
  processedInRunId: uuid('processed_in_run_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const employeeSalaryHistory = pgTable('employee_salary_history', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id').notNull(),
  previousSalary: numeric('previous_salary', { precision: 20, scale: 2 }).notNull(),
  newSalary: numeric('new_salary', { precision: 20, scale: 2 }).notNull(),
  currencyId: uuid('currency_id'),
  reason: text('reason'),
  effectiveDate: timestamp('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const employeeBankAccounts = pgTable('employee_bank_accounts', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id').notNull(),
  bankId: uuid('bank_id').notNull(),
  accountNumber: text('account_number').notNull(),
  accountType: text('account_type').default('CHECKING'),
  currencyId: uuid('currency_id'),
  isPrimary: boolean('is_primary').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const accountingAccounts = pgTable(
  'accounting_accounts',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    branchId: uuid('branch_id'),
    parentId: uuid('parent_id'),
    isActive: boolean('is_active').default(true),
  },
  table => [uniqueIndex('accounting_accounts_code_branch_idx').on(table.code, table.branchId)]
);

export const accountingEntries = pgTable('accounting_entries', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  date: timestamp('date').notNull(),
  description: text('description').notNull(),
  reference: text('reference'),
  branchId: uuid('branch_id'),
  status: text('status').default('POSTED'),
  /** Moneda funcional del libro (VES) y tasa del documento origen (M1/M2 de `S-08`). */
  baseCurrencyId: uuid('base_currency_id'),
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }).default('1'),
  createdAt: timestamp('created_at').defaultNow(),
  userId: uuid('user_id'),
});

export const accountingEntryLines = pgTable('accounting_entry_lines', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  entryId: uuid('entry_id').notNull(),
  accountId: uuid('account_id').notNull(),
  /** Importes en moneda funcional. */
  debit: numeric('debit', { precision: 20, scale: 2 }).default('0'),
  credit: numeric('credit', { precision: 20, scale: 2 }).default('0'),
  /** Importe y moneda originales cuando el documento no estaba en moneda funcional. */
  originalAmount: numeric('original_amount', { precision: 20, scale: 2 }),
  originalCurrencyId: uuid('original_currency_id'),
  description: text('description'),
});

export const accountingMaps = pgTable('accounting_maps', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  branchId: uuid('branch_id'),
  module: text('module').notNull(),
  transactionType: text('transaction_type'),
  categoryId: uuid('category_id'),
  productId: uuid('product_id'),
  paymentMethodId: uuid('payment_method_id'),
  debitAccountId: uuid('debit_account_id'),
  creditAccountId: uuid('credit_account_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const loans = pgTable(
  'loans',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    code: text('code').notNull().unique(),
    partnerId: uuid('partner_id').notNull(),
    branchId: uuid('branch_id'),
    status: text('status').default('ACTIVE'),
    startDate: timestamp('start_date').defaultNow(),
    dueDate: timestamp('due_date'),
    returnDate: timestamp('return_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    branchIdx: index('loans_branch_idx').on(t.branchId),
  })
);

export const loanItems = pgTable('loan_items', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  loanId: uuid('loan_id').notNull(),
  productId: uuid('product_id').notNull(),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  serialNumber: text('serial_number'),
  condition: text('condition').default('GOOD'),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolesPermissions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(usersRoles),
  permissions: many(rolesPermissions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  auditLogs: many(auditLogs),
  roles: many(usersRoles),
  branches: many(usersBranches),
  appSettings: many(userAppSettings),
}));

export const usersRolesRelations = relations(usersRoles, ({ one }) => ({
  user: one(users, { fields: [usersRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [usersRoles.roleId], references: [roles.id] }),
}));

export const usersBranchesRelations = relations(usersBranches, ({ one }) => ({
  user: one(users, { fields: [usersBranches.userId], references: [users.id] }),
  branch: one(branches, { fields: [usersBranches.branchId], references: [branches.id] }),
}));

export const userAppSettingsRelations = relations(userAppSettings, ({ one }) => ({
  user: one(users, { fields: [userAppSettings.userId], references: [users.id] }),
}));

export const rolesPermissionsRelations = relations(rolesPermissions, ({ one }) => ({
  role: one(roles, { fields: [rolesPermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolesPermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const branchesRelations = relations(branches, ({ many, one }) => ({
  company: one(companies, { fields: [branches.companyId], references: [companies.id] }),
  users: many(usersBranches),
  departments: many(departments),
  warehouses: many(warehouses),
  organizationModules: many(organizationModules),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  branches: many(branches),
}));

export const currenciesRelations = relations(currencies, ({ many }) => ({
  exchangeRates: many(exchangeRates),
  products: many(products),
  bankAccounts: many(bankAccounts),
  employees: many(employees),
  jobPositions: many(jobPositions),
  payrollRuns: many(payrollRuns),
  employeeSalaryHistory: many(employeeSalaryHistory),
  employeeBankAccounts: many(employeeBankAccounts),
}));

export const exchangeRatesRelations = relations(exchangeRates, ({ one }) => ({
  currency: one(currencies, { fields: [exchangeRates.currencyId], references: [currencies.id] }),
}));

export const taxConceptsRelations = relations(taxConcepts, ({ many }) => ({
  partners: many(partners),
  taxRetentionLines: many(taxRetentionLines),
}));

export const partnersRelations = relations(partners, ({ many }) => ({
  orders: many(orders),
  invoices: many(invoices),
  creditNotes: many(creditNotes),
  payments: many(payments),
  loans: many(loans),
  taxRetentions: many(taxRetentions),
}));

export const organizationModulesRelations = relations(organizationModules, ({ one }) => ({
  branch: one(branches, { fields: [organizationModules.branchId], references: [branches.id] }),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  branch: one(branches, { fields: [warehouses.branchId], references: [branches.id] }),
  stock: many(stock),
  inventoryMovesFrom: many(inventoryMoves, { relationName: 'fromWarehouse' }),
  inventoryMovesTo: many(inventoryMoves, { relationName: 'toWarehouse' }),
}));

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  parent: one(productCategories, {
    fields: [productCategories.parentId],
    references: [productCategories.id],
    relationName: 'parentChild',
  }),
  children: many(productCategories, { relationName: 'parentChild' }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  currency: one(currencies, { fields: [products.currencyId], references: [currencies.id] }),
  batches: many(productBatches),
  stock: many(stock),
  orderItems: many(orderItems),
  invoiceItems: many(invoiceItems),
  creditNoteItems: many(creditNoteItems),
  inventoryMoveLines: many(inventoryMoveLines),
  loanItems: many(loanItems),
}));

export const productBatchesRelations = relations(productBatches, ({ one, many }) => ({
  product: one(products, { fields: [productBatches.productId], references: [products.id] }),
  stock: many(stock),
  inventoryMoveLines: many(inventoryMoveLines),
}));

export const stockRelations = relations(stock, ({ one }) => ({
  warehouse: one(warehouses, { fields: [stock.warehouseId], references: [warehouses.id] }),
  product: one(products, { fields: [stock.productId], references: [products.id] }),
  batch: one(productBatches, { fields: [stock.batchId], references: [productBatches.id] }),
}));

export const inventoryMovesRelations = relations(inventoryMoves, ({ one, many }) => ({
  fromWarehouse: one(warehouses, {
    fields: [inventoryMoves.fromWarehouseId],
    references: [warehouses.id],
    relationName: 'fromWarehouse',
  }),
  toWarehouse: one(warehouses, {
    fields: [inventoryMoves.toWarehouseId],
    references: [warehouses.id],
    relationName: 'toWarehouse',
  }),
  approvedByUser: one(users, { fields: [inventoryMoves.approvedBy], references: [users.id] }),
  user: one(users, { fields: [inventoryMoves.userId], references: [users.id] }),
  lines: many(inventoryMoveLines),
}));

export const inventoryMoveLinesRelations = relations(inventoryMoveLines, ({ one }) => ({
  move: one(inventoryMoves, {
    fields: [inventoryMoveLines.moveId],
    references: [inventoryMoves.id],
  }),
  product: one(products, { fields: [inventoryMoveLines.productId], references: [products.id] }),
  batch: one(productBatches, {
    fields: [inventoryMoveLines.batchId],
    references: [productBatches.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  partner: one(partners, { fields: [orders.partnerId], references: [partners.id] }),
  branch: one(branches, { fields: [orders.branchId], references: [branches.id] }),
  warehouse: one(warehouses, { fields: [orders.warehouseId], references: [warehouses.id] }),
  currency: one(currencies, { fields: [orders.currencyId], references: [currencies.id] }),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  invoices: many(invoices),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  batch: one(productBatches, { fields: [orderItems.batchId], references: [productBatches.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  partner: one(partners, { fields: [invoices.partnerId], references: [partners.id] }),
  branch: one(branches, { fields: [invoices.branchId], references: [branches.id] }),
  currency: one(currencies, { fields: [invoices.currencyId], references: [currencies.id] }),
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  order: one(orders, { fields: [invoices.orderId], references: [orders.id] }),
  warehouse: one(warehouses, { fields: [invoices.warehouseId], references: [warehouses.id] }),
  items: many(invoiceItems),
  payments: many(payments),
  creditNotes: many(creditNotes),
  taxRetentions: many(taxRetentions),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  product: one(products, { fields: [invoiceItems.productId], references: [products.id] }),
}));

export const creditNotesRelations = relations(creditNotes, ({ one, many }) => ({
  invoice: one(invoices, { fields: [creditNotes.invoiceId], references: [invoices.id] }),
  partner: one(partners, { fields: [creditNotes.partnerId], references: [partners.id] }),
  branch: one(branches, { fields: [creditNotes.branchId], references: [branches.id] }),
  warehouse: one(warehouses, { fields: [creditNotes.warehouseId], references: [warehouses.id] }),
  currency: one(currencies, { fields: [creditNotes.currencyId], references: [currencies.id] }),
  user: one(users, { fields: [creditNotes.userId], references: [users.id] }),
  parentPayment: one(payments, {
    fields: [creditNotes.parentPaymentId],
    references: [payments.id],
  }),
  items: many(creditNoteItems),
  usages: many(creditNoteUsages),
}));

export const creditNoteItemsRelations = relations(creditNoteItems, ({ one }) => ({
  creditNote: one(creditNotes, {
    fields: [creditNoteItems.creditNoteId],
    references: [creditNotes.id],
  }),
  product: one(products, { fields: [creditNoteItems.productId], references: [products.id] }),
}));

export const creditNoteUsagesRelations = relations(creditNoteUsages, ({ one }) => ({
  creditNote: one(creditNotes, {
    fields: [creditNoteUsages.creditNoteId],
    references: [creditNotes.id],
  }),
  payment: one(payments, { fields: [creditNoteUsages.paymentId], references: [payments.id] }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one, many }) => ({
  currency: one(currencies, { fields: [paymentMethods.currencyId], references: [currencies.id] }),
  branch: one(branches, { fields: [paymentMethods.branchId], references: [branches.id] }),
  payments: many(payments),
  bankAccounts: many(paymentMethodAccounts),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  currency: one(currencies, { fields: [bankAccounts.currencyId], references: [currencies.id] }),
  branch: one(branches, { fields: [bankAccounts.branchId], references: [branches.id] }),
  payments: many(payments),
  paymentMethods: many(paymentMethodAccounts),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  partner: one(partners, { fields: [payments.partnerId], references: [partners.id] }),
  branch: one(branches, { fields: [payments.branchId], references: [branches.id] }),
  method: one(paymentMethods, { fields: [payments.methodId], references: [paymentMethods.id] }),
  currency: one(currencies, { fields: [payments.currencyId], references: [currencies.id] }),
  bankAccount: one(bankAccounts, {
    fields: [payments.bankAccountId],
    references: [bankAccounts.id],
  }),
  payrollRun: one(payrollRuns, { fields: [payments.payrollRunId], references: [payrollRuns.id] }),
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  allocations: many(paymentAllocations),
  creditNoteUsages: many(creditNoteUsages),
  taxRetentionLines: many(taxRetentionLines),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, { fields: [paymentAllocations.paymentId], references: [payments.id] }),
  invoice: one(invoices, { fields: [paymentAllocations.invoiceId], references: [invoices.id] }),
}));

export const paymentMethodAccountsRelations = relations(paymentMethodAccounts, ({ one }) => ({
  method: one(paymentMethods, {
    fields: [paymentMethodAccounts.methodId],
    references: [paymentMethods.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [paymentMethodAccounts.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

export const taxRetentionsRelations = relations(taxRetentions, ({ one, many }) => ({
  partner: one(partners, { fields: [taxRetentions.partnerId], references: [partners.id] }),
  branch: one(branches, { fields: [taxRetentions.branchId], references: [branches.id] }),
  user: one(users, { fields: [taxRetentions.userId], references: [users.id] }),
  lines: many(taxRetentionLines),
}));

export const taxRetentionLinesRelations = relations(taxRetentionLines, ({ one }) => ({
  retention: one(taxRetentions, {
    fields: [taxRetentionLines.retentionId],
    references: [taxRetentions.id],
  }),
  invoice: one(invoices, { fields: [taxRetentionLines.invoiceId], references: [invoices.id] }),
  payment: one(payments, { fields: [taxRetentionLines.paymentId], references: [payments.id] }),
  concept: one(taxConcepts, {
    fields: [taxRetentionLines.conceptId],
    references: [taxConcepts.id],
  }),
}));

export const documentLinksRelations = relations(documentLinks, ({ one }) => ({
  user: one(users, { fields: [documentLinks.userId], references: [users.id] }),
}));

export const banksRelations = relations(banks, ({ many }) => ({
  employees: many(employees),
  employeeBankAccounts: many(employeeBankAccounts),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  parent: one(departments, {
    fields: [departments.parentId],
    references: [departments.id],
    relationName: 'parentChild',
  }),
  children: many(departments, { relationName: 'parentChild' }),
  branch: one(branches, { fields: [departments.branchId], references: [branches.id] }),
  employees: many(employees),
}));

export const jobPositionsRelations = relations(jobPositions, ({ one, many }) => ({
  currency: one(currencies, { fields: [jobPositions.currencyId], references: [currencies.id] }),
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  position: one(jobPositions, { fields: [employees.positionId], references: [jobPositions.id] }),
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  branch: one(branches, { fields: [employees.branchId], references: [branches.id] }),
  bank: one(banks, { fields: [employees.bankId], references: [banks.id] }),
  salaryCurrency: one(currencies, {
    fields: [employees.salaryCurrencyId],
    references: [currencies.id],
  }),
  contracts: many(employeeContracts),
  vacations: many(employeeVacations),
  benefits: many(employeeBenefits),
  salaryHistory: many(employeeSalaryHistory),
  bankAccounts: many(employeeBankAccounts),
  payrollItems: many(payrollItems),
  payrollIncidents: many(payrollIncidents),
}));

export const employeeContractsRelations = relations(employeeContracts, ({ one }) => ({
  employee: one(employees, { fields: [employeeContracts.employeeId], references: [employees.id] }),
}));

export const employeeBenefitsRelations = relations(employeeBenefits, ({ one }) => ({
  employee: one(employees, { fields: [employeeBenefits.employeeId], references: [employees.id] }),
}));

export const employeeVacationsRelations = relations(employeeVacations, ({ one }) => ({
  employee: one(employees, { fields: [employeeVacations.employeeId], references: [employees.id] }),
}));

export const employeeProfitSharingRelations = relations(employeeProfitSharing, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeProfitSharing.employeeId],
    references: [employees.id],
  }),
}));

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
  branch: one(branches, { fields: [payrollRuns.branchId], references: [branches.id] }),
  currency: one(currencies, { fields: [payrollRuns.currencyId], references: [currencies.id] }),
  items: many(payrollItems),
  periodSettings: many(payrollPeriodSettings),
}));

export const payrollItemsRelations = relations(payrollItems, ({ one, many }) => ({
  run: one(payrollRuns, { fields: [payrollItems.runId], references: [payrollRuns.id] }),
  employee: one(employees, { fields: [payrollItems.employeeId], references: [employees.id] }),
  lines: many(payrollItemLines),
}));

export const payrollItemLinesRelations = relations(payrollItemLines, ({ one }) => ({
  item: one(payrollItems, { fields: [payrollItemLines.itemId], references: [payrollItems.id] }),
}));

export const payrollSettingsRelations = relations(payrollSettings, ({ one }) => ({
  branch: one(branches, { fields: [payrollSettings.branchId], references: [branches.id] }),
}));

export const payrollPeriodSettingsRelations = relations(payrollPeriodSettings, ({ one }) => ({
  run: one(payrollRuns, { fields: [payrollPeriodSettings.runId], references: [payrollRuns.id] }),
}));

export const payrollConceptTypesRelations = relations(payrollConceptTypes, ({ one, many }) => ({
  branch: one(branches, { fields: [payrollConceptTypes.branchId], references: [branches.id] }),
  incidents: many(payrollIncidents),
}));

export const payrollIncidentsRelations = relations(payrollIncidents, ({ one }) => ({
  employee: one(employees, { fields: [payrollIncidents.employeeId], references: [employees.id] }),
  concept: one(payrollConceptTypes, {
    fields: [payrollIncidents.conceptId],
    references: [payrollConceptTypes.id],
  }),
  processedInRun: one(payrollRuns, {
    fields: [payrollIncidents.processedInRunId],
    references: [payrollRuns.id],
  }),
}));

export const employeeSalaryHistoryRelations = relations(employeeSalaryHistory, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeSalaryHistory.employeeId],
    references: [employees.id],
  }),
  currency: one(currencies, {
    fields: [employeeSalaryHistory.currencyId],
    references: [currencies.id],
  }),
}));

export const employeeBankAccountsRelations = relations(employeeBankAccounts, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeBankAccounts.employeeId],
    references: [employees.id],
  }),
  bank: one(banks, { fields: [employeeBankAccounts.bankId], references: [banks.id] }),
  currency: one(currencies, {
    fields: [employeeBankAccounts.currencyId],
    references: [currencies.id],
  }),
}));

export const accountingAccountsRelations = relations(accountingAccounts, ({ one, many }) => ({
  branch: one(branches, { fields: [accountingAccounts.branchId], references: [branches.id] }),
  parent: one(accountingAccounts, {
    fields: [accountingAccounts.parentId],
    references: [accountingAccounts.id],
    relationName: 'parentChild',
  }),
  children: many(accountingAccounts, { relationName: 'parentChild' }),
  debitEntries: many(accountingEntryLines, { relationName: 'debitAccount' }),
  creditEntries: many(accountingEntryLines, { relationName: 'creditAccount' }),
  debitMaps: many(accountingMaps, { relationName: 'debitAccountMap' }),
  creditMaps: many(accountingMaps, { relationName: 'creditAccountMap' }),
}));

export const accountingEntriesRelations = relations(accountingEntries, ({ one, many }) => ({
  branch: one(branches, { fields: [accountingEntries.branchId], references: [branches.id] }),
  user: one(users, { fields: [accountingEntries.userId], references: [users.id] }),
  lines: many(accountingEntryLines),
}));

export const accountingEntryLinesRelations = relations(accountingEntryLines, ({ one }) => ({
  entry: one(accountingEntries, {
    fields: [accountingEntryLines.entryId],
    references: [accountingEntries.id],
  }),
  account: one(accountingAccounts, {
    fields: [accountingEntryLines.accountId],
    references: [accountingAccounts.id],
    relationName: 'account',
  }),
}));

export const accountingMapsRelations = relations(accountingMaps, ({ one }) => ({
  branch: one(branches, { fields: [accountingMaps.branchId], references: [branches.id] }),
  category: one(productCategories, {
    fields: [accountingMaps.categoryId],
    references: [productCategories.id],
  }),
  product: one(products, { fields: [accountingMaps.productId], references: [products.id] }),
  paymentMethod: one(paymentMethods, {
    fields: [accountingMaps.paymentMethodId],
    references: [paymentMethods.id],
  }),
  debitAccount: one(accountingAccounts, {
    fields: [accountingMaps.debitAccountId],
    references: [accountingAccounts.id],
    relationName: 'debitAccountMap',
  }),
  creditAccount: one(accountingAccounts, {
    fields: [accountingMaps.creditAccountId],
    references: [accountingAccounts.id],
    relationName: 'creditAccountMap',
  }),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  partner: one(partners, { fields: [loans.partnerId], references: [partners.id] }),
  items: many(loanItems),
}));

export const loanItemsRelations = relations(loanItems, ({ one }) => ({
  loan: one(loans, { fields: [loanItems.loanId], references: [loans.id] }),
  product: one(products, { fields: [loanItems.productId], references: [products.id] }),
}));
