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
  date,
  type AnyPgColumn,
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
    /** Nulo en eventos sin entidad propia: inicio de sesión, acceso denegado. */
    entityId: uuid('entity_id'),
    action: text('action').notNull(),
    changes: jsonb('changes'),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Copia del autor en el momento del hecho: sobrevive al borrado o renombrado del usuario. */
    actorName: text('actor_name'),
    actorEmail: text('actor_email'),
    actorRoles: text('actor_roles').array(),
    /** Agrupación funcional del visor (`billing`, `treasury`, `inventory`, `auth`, …). */
    module: text('module'),
    /** Nombre legible de la entidad afectada ("Factura", "Pago"). */
    entityLabel: text('entity_label'),
    /** Verbo conjugado del hecho ("Publicó la factura"). */
    actionLabel: text('action_label'),
    httpMethod: text('http_method'),
    route: text('route'),
    /** `SUCCESS` | `DENIED` | `ERROR`. */
    result: text('result').default('SUCCESS'),
    durationMs: integer('duration_ms'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    documentCode: text('document_code'),
    documentStatus: text('document_status'),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    branchCreatedIdx: index('audit_logs_branch_created_idx').on(t.branchId, t.createdAt),
    entityCreatedIdx: index('audit_logs_entity_created_idx').on(
      t.entityTable,
      t.entityId,
      t.createdAt
    ),
    userCreatedIdx: index('audit_logs_user_created_idx').on(t.userId, t.createdAt),
    createdIdx: index('audit_logs_created_idx').on(t.createdAt),
    moduleCreatedIdx: index('audit_logs_module_created_idx').on(t.module, t.createdAt),
    documentCreatedIdx: index('audit_logs_document_created_idx').on(t.documentCode, t.createdAt),
    actorCreatedIdx: index('audit_logs_actor_created_idx').on(t.actorName, t.createdAt),
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
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
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
    currencyId: uuid('currency_id')
      .references(() => currencies.id, { onDelete: 'cascade' })
      .notNull(),
    rate: numeric('rate', { precision: 20, scale: 10 }).notNull(),
    date: timestamp('date').defaultNow(),
    source: text('source').default('MANUAL'),
    /** Usuario que cargó la tasa a mano; nulo cuando viene del job de BCV. */
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
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
  /** `BS` (monto fijo) o `UT` (unidades tributarias: se convierten con la UT vigente). */
  sustraendoUnit: text('sustraendo_unit').default('BS'),
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
  /** `CUSTOMER`, `VENDOR` o `BOTH` (partner que compra y vende). */
  type: text('type').default('CUSTOMER'),
  taxpayerType: text('taxpayer_type').default('ORDINARY'),
  retentionRate: numeric('retention_rate', { precision: 3, scale: 0 }).default('0'),
  isSpecialTaxpayer: boolean('is_special_taxpayer').default(false),
  creditLimit: numeric('credit_limit', { precision: 20, scale: 2 }).default('0'),
  /** Días de crédito por defecto para calcular el vencimiento de una compra (T-03-02). */
  creditDays: integer('credit_days').default(0).notNull(),
  islrConceptId: uuid('islr_concept_id').references(() => taxConcepts.id, { onDelete: 'set null' }),
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
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
});

export const warehouses = pgTable('warehouses', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
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
  parentId: uuid('parent_id').references((): AnyPgColumn => productCategories.id, {
    onDelete: 'set null',
  }),
});

export const products = pgTable('products', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  cost: numeric('cost', { precision: 20, scale: 2 }).default('0'),
  price: numeric('price', { precision: 20, scale: 2 }).default('0'),
  isExempt: boolean('is_exempt').default(false),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('16.00'),
  type: text('type').default('PHYSICAL'),
  minStock: numeric('min_stock', { precision: 20, scale: 2 }).default('0'),
  hasBatches: boolean('has_batches').default(false),
  currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const productBatches = pgTable(
  'product_batches',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    batchNumber: text('batch_number').notNull(),
    expirationDate: timestamp('expiration_date'),
    cost: numeric('cost', { precision: 20, scale: 2 }).default('0'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  // El lote se identifica por número dentro del producto: la recepción lo crea si no existe (`S-25`).
  t => [uniqueIndex('product_batches_product_number_unq').on(t.productId, t.batchNumber)]
);

export const stock = pgTable(
  'stock',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    warehouseId: uuid('warehouse_id')
      .references(() => warehouses.id, { onDelete: 'restrict' })
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    batchId: uuid('batch_id').references(() => productBatches.id, { onDelete: 'set null' }),
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
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
    source: text('source').notNull().default('SYSTEM'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at'),
    rejectionReason: text('rejection_reason'),
    fromWarehouseId: uuid('from_warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),
    toWarehouseId: uuid('to_warehouse_id').references(() => warehouses.id, {
      onDelete: 'set null',
    }),
    date: timestamp('date').defaultNow(),
    note: text('note'),
    /** Motivo del ajuste (`S-25`): obligatorio cuando el movimiento corrige un conteo. */
    reasonCode: text('reason_code'),
    /** La diferencia superó la tolerancia: no puede aprobarla quien la registró (`S-25`). */
    requiresSecondApproval: boolean('requires_second_approval').default(false),
    /** La salida despachó un lote posterior al sugerido por FEFO (`S-26`). */
    fefoOverride: boolean('fefo_override').default(false),
    /** Motivo del despacho fuera de FEFO (`S-26`). */
    fefoOverrideReason: text('fefo_override_reason'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  t => ({
    branchDateIdx: index('inventory_moves_branch_date_idx').on(t.branchId, t.date),
  })
);

export const inventoryMoveLines = pgTable('inventory_move_lines', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  moveId: uuid('move_id')
    .references(() => inventoryMoves.id, { onDelete: 'cascade' })
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'restrict' })
    .notNull(),
  batchId: uuid('batch_id').references(() => productBatches.id, { onDelete: 'set null' }),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  cost: numeric('cost', { precision: 20, scale: 2 }),
});

/**
 * Reserva de lote (`S-26`).
 *
 * Una salida en borrador promete mercancía física: mientras esté `ACTIVE`, esa cantidad deja de
 * estar disponible para otra salida. La reserva se libera al aprobar (el descuento ya es real) o al
 * rechazar el documento. Es lo que evita que dos salidas simultáneas prometan el mismo lote.
 */
export const inventoryBatchReservations = pgTable(
  'inventory_batch_reservations',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    moveId: uuid('move_id')
      .references(() => inventoryMoves.id, { onDelete: 'cascade' })
      .notNull(),
    moveLineId: uuid('move_line_id').references(() => inventoryMoveLines.id, {
      onDelete: 'cascade',
    }),
    warehouseId: uuid('warehouse_id')
      .references(() => warehouses.id, { onDelete: 'cascade' })
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    batchId: uuid('batch_id')
      .references(() => productBatches.id, { onDelete: 'restrict' })
      .notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    status: text('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow(),
    releasedAt: timestamp('released_at'),
  },
  t => ({
    activeIdx: index('inventory_batch_reservations_active_idx').on(
      t.warehouseId,
      t.productId,
      t.batchId,
      t.status
    ),
    moveIdx: index('inventory_batch_reservations_move_idx').on(t.moveId),
  })
);

export const orders = pgTable('orders', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  partnerId: uuid('partner_id')
    .references(() => partners.id, { onDelete: 'restrict' })
    .notNull(),
  branchId: uuid('branch_id')
    .references(() => branches.id, { onDelete: 'restrict' })
    .notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'restrict' }),
  type: text('type').default('SALE'),
  status: text('status').default('PENDING'),
  total: numeric('total', { precision: 20, scale: 2 }).default('0'),
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }).default('1'),
  currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'restrict' }),
  date: timestamp('date').defaultNow(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  orderId: uuid('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'restrict' })
    .notNull(),
  batchId: uuid('batch_id').references(() => productBatches.id, { onDelete: 'set null' }),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  price: numeric('price', { precision: 20, scale: 2 }).notNull(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  partnerId: uuid('partner_id')
    .references(() => partners.id, { onDelete: 'restrict' })
    .notNull(),
  branchId: uuid('branch_id')
    .references(() => branches.id, { onDelete: 'restrict' })
    .notNull(),
  currencyId: uuid('currency_id')
    .references(() => currencies.id, { onDelete: 'restrict' })
    .notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }).notNull(),
  type: text('type').default('SALE'),
  invoiceNumber: text('invoice_number'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'restrict' }),
  status: text('status').default('DRAFT'),
  fiscalStatus: text('fiscal_status').default('PENDING'),
  totalBase: numeric('total_base', { precision: 20, scale: 2 }).default('0'),
  totalTax: numeric('total_tax', { precision: 20, scale: 2 }).default('0'),
  totalIgtf: numeric('total_igtf', { precision: 20, scale: 2 }).default('0'),
  total: numeric('total', { precision: 20, scale: 2 }).default('0'),
  date: timestamp('date').defaultNow(),
  dueDate: timestamp('due_date'),
  /** Número de factura del proveedor y su fecha de emisión (T-03-01). */
  supplierInvoiceNumber: text('supplier_invoice_number'),
  supplierInvoiceDate: timestamp('supplier_invoice_date'),
  /** Cache del pagado en moneda funcional; la fuente de verdad son las asignaciones de pago. */
  paidAmount: numeric('paid_amount', { precision: 20, scale: 2 }).default('0').notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  invoiceId: uuid('invoice_id')
    .references(() => invoices.id, { onDelete: 'cascade' })
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'restrict' })
    .notNull(),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  price: numeric('price', { precision: 20, scale: 2 }).notNull(),
  cost: numeric('cost', { precision: 20, scale: 2 }),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0'),
  total: numeric('total', { precision: 20, scale: 2 }).notNull(),
});

/**
 * Histórico de procesos de un documento comercial (`S-12`).
 *
 * Tabla append-only: cada acción de negocio sobre un pedido o una factura deja una fila con su autor
 * y su fecha. `parent_document_id` guarda el pedido de origen de la factura para que la línea de
 * tiempo se pueda leer completa desde cualquiera de los dos documentos.
 */
export const documentEvents = pgTable(
  'document_events',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    /** `ORDER` | `INVOICE`. */
    documentType: text('document_type').notNull(),
    documentId: uuid('document_id').notNull(),
    documentCode: text('document_code'),
    /** Pedido de origen cuando el evento pertenece a una factura nacida de un pedido. */
    parentDocumentId: uuid('parent_document_id'),
    /** `ORDER_CREATED`, `ORDER_CONFIRMED`, `INVOICE_POSTED`, … */
    action: text('action').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    description: text('description'),
    metadata: jsonb('metadata'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    documentIdx: index('document_events_document_idx').on(
      t.documentType,
      t.documentId,
      t.createdAt
    ),
    parentIdx: index('document_events_parent_idx').on(t.parentDocumentId, t.createdAt),
    branchCreatedIdx: index('document_events_branch_created_idx').on(t.branchId, t.createdAt),
  })
);

export const creditNotes = pgTable('credit_notes', {
  /** `SALE` devolución a cliente, `PURCHASE` devolución a proveedor (T-03-07). */
  type: text('type').default('SALE').notNull(),
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  code: text('code').notNull().unique(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  partnerId: uuid('partner_id')
    .references(() => partners.id, { onDelete: 'restrict' })
    .notNull(),
  branchId: uuid('branch_id')
    .references(() => branches.id, { onDelete: 'restrict' })
    .notNull(),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'restrict' }),
  currencyId: uuid('currency_id')
    .references(() => currencies.id, { onDelete: 'restrict' })
    .notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 6 }).notNull(),
  status: text('status').default('DRAFT'),
  totalBase: numeric('total_base', { precision: 20, scale: 2 }).default('0'),
  totalTax: numeric('total_tax', { precision: 20, scale: 2 }).default('0'),
  totalIgtf: numeric('total_igtf', { precision: 20, scale: 2 }).default('0'),
  total: numeric('total', { precision: 20, scale: 2 }).default('0'),
  date: timestamp('date').defaultNow(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  parentPaymentId: uuid('parent_payment_id').references(() => payments.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const creditNoteItems = pgTable('credit_note_items', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  creditNoteId: uuid('credit_note_id')
    .references(() => creditNotes.id, { onDelete: 'cascade' })
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'restrict' })
    .notNull(),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  price: numeric('price', { precision: 20, scale: 2 }).notNull(),
  total: numeric('total', { precision: 20, scale: 2 }).notNull(),
});

export const creditNoteUsages = pgTable(
  'credit_note_usages',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    creditNoteId: uuid('credit_note_id')
      .references(() => creditNotes.id, { onDelete: 'cascade' })
      .notNull(),
    /**
     * Pago con el que se consumió el crédito. Opcional desde `0035`: aplicar una nota de crédito no
     * es un cobro y no mueve banco ni tesorería.
     */
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'cascade' }),
    /** Factura contra la que se aplicó el crédito: es lo que explica qué saldo bajó. */
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    creditNoteIdx: index('credit_note_usages_credit_note_idx').on(t.creditNoteId),
    invoiceIdx: index('credit_note_usages_invoice_idx').on(t.invoiceId),
  })
);

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text('name').notNull(),
    code: text('code').notNull(),
    isDigital: boolean('is_digital').default(false),
    currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'set null' }),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
    /** El IGTF (3 %) se aplica en los pagos con divisa en efectivo. */
    appliesIgtf: boolean('applies_igtf').default(false).notNull(),
    /** Transferencias, Zelle y Pago Móvil no se pueden cobrar sin referencia bancaria. */
    requiresReference: boolean('requires_reference').default(false).notNull(),
    isCash: boolean('is_cash').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  t => ({
    unq: uniqueIndex('payment_methods_code_branch_unq').on(t.code, t.branchId),
  })
);

export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text('name').notNull(),
    accountNumber: text('account_number'),
    type: text('type').notNull(),
    currencyId: uuid('currency_id')
      .references(() => currencies.id, { onDelete: 'restrict' })
      .notNull(),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
    bankId: uuid('bank_id').references(() => banks.id, { onDelete: 'restrict' }),
    /** Cuenta del plan contable que recibe los movimientos de esta cuenta (`S-19`). */
    accountingAccountId: uuid('accounting_account_id').references(() => accountingAccounts.id, {
      onDelete: 'set null',
    }),
    initialBalance: numeric('initial_balance', { precision: 20, scale: 2 }).default('0').notNull(),
    currentBalance: numeric('current_balance', { precision: 20, scale: 2 }).default('0'),
    isActive: boolean('is_active').default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  t => ({
    branchIdx: index('bank_accounts_branch_idx').on(t.branchId, t.isActive),
  })
);

/**
 * Cierre diario por sucursal (`T-05-03`).
 *
 * `totals` es el snapshot del día al momento del cierre: no se recalcula al leer, para que reabrir
 * sea un acto explícito y auditado. Un día sin fila está simplemente abierto.
 */
export const dailyCloses = pgTable(
  'daily_closes',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    date: date('date').notNull(),
    status: text('status').default('OPEN').notNull(),
    totals: jsonb('totals'),
    notes: text('notes'),
    closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
    closedAt: timestamp('closed_at'),
    reopenedBy: uuid('reopened_by').references(() => users.id, { onDelete: 'set null' }),
    reopenedAt: timestamp('reopened_at'),
    reopenReason: text('reopen_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  t => ({
    branchDateUnq: uniqueIndex('daily_closes_branch_date_unq').on(t.branchId, t.date),
  })
);

/** Cabecera de importación de extracto; el hash evita importar dos veces el mismo archivo. */
export const bankStatementImports = pgTable(
  'bank_statement_imports',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    bankAccountId: uuid('bank_account_id')
      .references(() => bankAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    branchId: uuid('branch_id')
      .references(() => branches.id, { onDelete: 'restrict' })
      .notNull(),
    fileHash: text('file_hash').notNull(),
    fileName: text('file_name'),
    linesCount: integer('lines_count').default(0).notNull(),
    importedBy: uuid('imported_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    hashUnq: uniqueIndex('bank_statement_imports_hash_unq').on(t.bankAccountId, t.fileHash),
  })
);

/** Línea del extracto bancario, conciliable con un pago (`T-05-04`, `T-05-05`). */
export const bankStatementLines = pgTable(
  'bank_statement_lines',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    importId: uuid('import_id')
      .notNull()
      .references(() => bankStatementImports.id, { onDelete: 'cascade' }),
    bankAccountId: uuid('bank_account_id')
      .references(() => bankAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    branchId: uuid('branch_id')
      .references(() => branches.id, { onDelete: 'restrict' })
      .notNull(),
    date: date('date').notNull(),
    amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
    direction: text('direction').default('IN').notNull(),
    reference: text('reference'),
    description: text('description'),
    matchedPaymentId: uuid('matched_payment_id').references((): AnyPgColumn => payments.id, {
      onDelete: 'set null',
    }),
    matchedAt: timestamp('matched_at'),
    matchedBy: uuid('matched_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    accountDateIdx: index('bank_statement_lines_account_date_idx').on(t.bankAccountId, t.date),
    // Un pago no se concilia con dos líneas (H-92).
    paymentUnq: uniqueIndex('bank_statement_lines_payment_unq')
      .on(t.matchedPaymentId)
      .where(sql`${t.matchedPaymentId} is not null`),
  })
);

/** Fondo fijo de caja chica (`T-05-07`). */
export const pettyCashFunds = pgTable(
  'petty_cash_funds',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    currencyId: uuid('currency_id')
      .references(() => currencies.id, { onDelete: 'restrict' })
      .notNull(),
    amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
    balance: numeric('balance', { precision: 20, scale: 2 }).default('0').notNull(),
    responsibleUserId: uuid('responsible_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: text('status').default('OPEN').notNull(),
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  t => ({
    branchIdx: index('petty_cash_funds_branch_idx').on(t.branchId, t.status),
  })
);

export const pettyCashMovements = pgTable(
  'petty_cash_movements',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    fundId: uuid('fund_id')
      .notNull()
      .references(() => pettyCashFunds.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    /** `EXPENSE` gasta del fondo; `REPLENISHMENT` lo repone. */
    type: text('type').notNull(),
    amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
    description: text('description'),
    receiptNumber: text('receipt_number'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    fundDateIdx: index('petty_cash_movements_fund_date_idx').on(t.fundId, t.date),
  })
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    code: text('code').notNull().unique(),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    /** Nulo en pagos de nómina: el beneficiario es un empleado, no un partner. */
    partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id')
      .references(() => branches.id, { onDelete: 'restrict' })
      .notNull(),
    methodId: uuid('method_id')
      .references(() => paymentMethods.id, { onDelete: 'restrict' })
      .notNull(),
    status: text('status').default('POSTED'),
    type: text('type').default('INCOME'),
    amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
    currencyId: uuid('currency_id')
      .references(() => currencies.id, { onDelete: 'restrict' })
      .notNull(),
    exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }).notNull(),
    /** Monto en moneda funcional (VES): amount x exchangeRate (M2 de `S-08`). */
    amountBase: numeric('amount_base', { precision: 20, scale: 2 }).notNull().default('0'),
    bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id, {
      onDelete: 'set null',
    }),
    /** Línea del extracto con la que se concilió este pago (`T-05-05`). */
    bankStatementLineId: uuid('bank_statement_line_id').references(
      (): AnyPgColumn => bankStatementLines.id,
      { onDelete: 'set null' }
    ),
    payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'set null' }),
    /** `IN` cobro, `OUT` pago. `type` se mantiene por compatibilidad (T-03-06). */
    direction: text('direction').default('IN').notNull(),
    /** Retención que se descuenta del pago al proveedor. */
    retentionAmount: numeric('retention_amount', { precision: 20, scale: 2 })
      .default('0')
      .notNull(),
    reference: text('reference'),
    metadata: jsonb('metadata'),
    date: timestamp('date').defaultNow(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => ({
    // Un run de nómina se paga una sola vez: la base lo garantiza además del servicio (RN-24).
    payrollRunUnq: uniqueIndex('payments_payroll_run_unq')
      .on(t.payrollRunId)
      .where(sql`${t.payrollRunId} is not null`),
    // La referencia bancaria es la prueba de que el dinero entró: una misma transferencia no puede
    // justificar dos cobros, ni en la misma factura ni en otra. El servicio guarda la referencia
    // normalizada (mayúsculas, sin espacios sobrantes) y un pago anulado la libera porque el dinero
    // no llegó a la cuenta.
    referenceUnq: uniqueIndex('payments_reference_unq')
      .on(t.reference)
      .where(sql`${t.reference} is not null and ${t.status} <> 'VOID'`),
  })
);

export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  paymentId: uuid('payment_id')
    .references(() => payments.id, { onDelete: 'cascade' })
    .notNull(),
  invoiceId: uuid('invoice_id')
    .references(() => invoices.id, { onDelete: 'restrict' })
    .notNull(),
  amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
  /** Importe aplicado en moneda funcional (M8 de `S-08`). */
  amountBase: numeric('amount_base', { precision: 20, scale: 2 }).default('0'),
  /**
   * Importe imputado **en la moneda de la factura**: es lo que baja el saldo (`S-18`).
   *
   * Cuando pago y factura comparten moneda es igual a `amount` (a la par). Cuando no, es el valor
   * del pago convertido a la moneda del documento con la tasa del día del pago.
   */
  invoiceAmount: numeric('invoice_amount', { precision: 20, scale: 2 }).notNull(),
  /** Tasa del pago usada en la imputación. */
  exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }),
  /** Resultado cambiario: `amount_base − invoice_amount × tasa_factura`. */
  exchangeDifferenceBase: numeric('exchange_difference_base', { precision: 20, scale: 2 })
    .default('0')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const paymentMethodAccounts = pgTable(
  'payment_method_accounts',
  {
    methodId: uuid('method_id')
      .references(() => paymentMethods.id, { onDelete: 'cascade' })
      .notNull(),
    bankAccountId: uuid('bank_account_id')
      .references(() => bankAccounts.id, { onDelete: 'cascade' })
      .notNull(),
  },
  t => ({
    pk: primaryKey({ columns: [t.methodId, t.bankAccountId] }),
  })
);

export const taxRetentions = pgTable(
  'tax_retentions',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    code: text('code').notNull(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'restrict' })
      .notNull(),
    branchId: uuid('branch_id')
      .references(() => branches.id, { onDelete: 'restrict' })
      .notNull(),
    period: text('period').notNull(),
    type: text('type').notNull(),
    totalBase: numeric('total_base', { precision: 20, scale: 2 }).notNull(),
    totalTax: numeric('total_tax', { precision: 20, scale: 2 }).default('0'),
    totalRetained: numeric('total_retained', { precision: 20, scale: 2 }).notNull(),
    /** Moneda y tasa del comprobante de retencion (M2 de `S-08`). */
    currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'restrict' }),
    exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }),
    totalRetainedBase: numeric('total_retained_base', { precision: 20, scale: 2 }),
    xmlContent: text('xml_content'),
    /** Factura de compra que origin? el comprobante (T-03-04). */
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'restrict' }),
    /** Número de comprobante correlativo por sucursal y año (T-06-01). */
    voucherNumber: text('voucher_number'),
    /** Porcentaje aplicado al comprobante, para que el voucher se explique solo (`S-21`). */
    appliedRate: numeric('applied_rate', { precision: 20, scale: 2 }),
    /** Origen de la regla aplicada: `CONCEPT`, `PARTNER` o `SETTINGS` (`S-21`). */
    ruleSource: text('rule_source'),
    date: timestamp('date').defaultNow(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  // H-80: el correlativo es por sucursal, asi que la unicidad de `code` no puede ser global.
  table => [
    uniqueIndex('tax_retentions_branch_type_voucher_unq')
      .on(table.branchId, table.type, table.voucherNumber)
      .where(sql`${table.voucherNumber} is not null`),
  ]
);

/**
 * Parámetros de retención al proveedor por empresa (`T-03-03`).
 *
 * El porcentaje de IVA a retener depende de la condición del proveedor (75 % ordinario, 100 % en los
 * supuestos especiales) y el ISLR de la tabla del decreto, que cambia por año: por eso es parámetro y
 * no constante.
 */
export const supplierRetentionSettings = pgTable(
  'supplier_retention_settings',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    ivaRetentionRate: numeric('iva_retention_rate', { precision: 5, scale: 2 })
      .default('75')
      .notNull(),
    ivaRetentionRateSpecial: numeric('iva_retention_rate_special', { precision: 5, scale: 2 })
      .default('100')
      .notNull(),
    islrRate: numeric('islr_rate', { precision: 5, scale: 2 }).default('0').notNull(),
    islrSustraendo: numeric('islr_sustraendo', { precision: 20, scale: 2 }).default('0').notNull(),
    /** Umbral en moneda funcional a partir del cual se aplica la retención de ISLR. */
    islrThreshold: numeric('islr_threshold', { precision: 20, scale: 2 }).default('0').notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [uniqueIndex('supplier_retention_settings_company_unq').on(table.companyId)]
);

export const taxRetentionLines = pgTable('tax_retention_lines', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  retentionId: uuid('retention_id')
    .references(() => taxRetentions.id, { onDelete: 'cascade' })
    .notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  baseAmount: numeric('base_amount', { precision: 20, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 20, scale: 2 }).default('0'),
  retainedAmount: numeric('retained_amount', { precision: 20, scale: 2 }).notNull(),
  conceptId: uuid('concept_id').references(() => taxConcepts.id, { onDelete: 'set null' }),
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
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
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
  parentId: uuid('parent_id').references((): AnyPgColumn => departments.id, {
    onDelete: 'set null',
  }),
  branchId: uuid('branch_id')
    .references(() => branches.id, { onDelete: 'restrict' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const jobPositions = pgTable('job_positions', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text('name').notNull().unique(),
  description: text('description'),
  currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'set null' }),
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
  positionId: uuid('position_id').references(() => jobPositions.id, { onDelete: 'set null' }),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
  hireDate: timestamp('hire_date').defaultNow(),
  terminationDate: timestamp('termination_date'),
  terminationReason: text('termination_reason'),
  salaryCurrencyId: uuid('salary_currency_id').references(() => currencies.id, {
    onDelete: 'set null',
  }),
  baseSalary: numeric('base_salary', { precision: 20, scale: 2 }).notNull(),
  payFrequency: text('pay_frequency').default('BIWEEKLY'),
  paymentMethod: text('payment_method').default('BANK_TRANSFER'),
  bankId: uuid('bank_id').references(() => banks.id, { onDelete: 'set null' }),
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
  employeeId: uuid('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
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
  employeeId: uuid('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
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
  employeeId: uuid('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
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

export const employeeSettlements = pgTable(
  'employee_settlements',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    employeeId: uuid('employee_id')
      .references(() => employees.id, { onDelete: 'cascade' })
      .notNull(),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    terminationDate: timestamp('termination_date').notNull(),
    cause: text('cause').notNull(),
    years: integer('years').notNull(),
    integralSalary: numeric('integral_salary', { precision: 20, scale: 2 }).notNull(),
    normalSalary: numeric('normal_salary', { precision: 20, scale: 2 }).notNull(),
    guaranteeAccumulated: numeric('guarantee_accumulated', { precision: 20, scale: 2 })
      .default('0')
      .notNull(),
    retroactive: numeric('retroactive', { precision: 20, scale: 2 }).default('0').notNull(),
    benefitsAmount: numeric('benefits_amount', { precision: 20, scale: 2 }).notNull(),
    benefitsModality: text('benefits_modality').notNull(),
    vacationDays: integer('vacation_days').default(0).notNull(),
    vacationAmount: numeric('vacation_amount', { precision: 20, scale: 2 }).default('0').notNull(),
    bonusDays: integer('bonus_days').default(0).notNull(),
    bonusAmount: numeric('bonus_amount', { precision: 20, scale: 2 }).default('0').notNull(),
    profitDays: integer('profit_days').default(0).notNull(),
    profitAmount: numeric('profit_amount', { precision: 20, scale: 2 }).default('0').notNull(),
    indemnificationDays: integer('indemnification_days').default(0).notNull(),
    indemnificationAmount: numeric('indemnification_amount', { precision: 20, scale: 2 })
      .default('0')
      .notNull(),
    totalAmount: numeric('total_amount', { precision: 20, scale: 2 }).notNull(),
    status: text('status').default('CALCULATED'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
    paidAt: timestamp('paid_at'),
  },
  // Un egreso se liquida una sola vez: la base garantiza el 409 aunque la aplicación falle (RN-20).
  t => ({
    employeeUnq: uniqueIndex('employee_settlements_employee_unq').on(t.employeeId),
  })
);

export const employeeProfitSharing = pgTable('employee_profit_sharing', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
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
  branchId: uuid('branch_id')
    .references(() => branches.id, { onDelete: 'restrict' })
    .notNull(),
  frequency: text('frequency').notNull(),
  currencyId: uuid('currency_id')
    .references(() => currencies.id, { onDelete: 'restrict' })
    .notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  totalAmount: numeric('total_amount', { precision: 20, scale: 2 }).default('0'),
  status: text('status').default('DRAFT'),
  /** `P-29` (RN-21): la anulación no borra nada; deja quién, cuándo y por qué. */
  voidedAt: timestamp('voided_at'),
  voidedBy: uuid('voided_by').references(() => users.id, { onDelete: 'set null' }),
  voidReason: text('void_reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const payrollItems = pgTable('payroll_items', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  runId: uuid('run_id')
    .references(() => payrollRuns.id, { onDelete: 'cascade' })
    .notNull(),
  employeeId: uuid('employee_id')
    .references(() => employees.id, { onDelete: 'restrict' })
    .notNull(),
  baseAmount: numeric('base_amount', { precision: 20, scale: 2 }).notNull(),
  bonuses: numeric('bonuses', { precision: 20, scale: 2 }).default('0'),
  deductions: numeric('deductions', { precision: 20, scale: 2 }).default('0'),
  netTotal: numeric('net_total', { precision: 20, scale: 2 }).notNull(),
});

export const payrollItemLines = pgTable('payroll_item_lines', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  itemId: uuid('item_id')
    .references(() => payrollItems.id, { onDelete: 'cascade' })
    .notNull(),
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
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
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
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
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
    /**
     * `P-30`: el importe de este concepto reduce la base de ISLR antes de aplicar la tarifa. Se usa
     * para los aportes obligatorios del trabajador (IVSS, paro forzoso, FAOV).
     */
    reducesIncomeTaxBase: boolean('reduces_income_tax_base').notNull().default(false),
    isSystem: boolean('is_system').default(false),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
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
  employeeId: uuid('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  conceptId: uuid('concept_id')
    .references(() => payrollConceptTypes.id, { onDelete: 'restrict' })
    .notNull(),
  date: timestamp('date').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).default('1'),
  amount: numeric('amount', { precision: 20, scale: 2 }),
  status: text('status').default('PENDING'),
  processedInRunId: uuid('processed_in_run_id').references(() => payrollRuns.id, {
    onDelete: 'set null',
  }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const employeeSalaryHistory = pgTable('employee_salary_history', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  previousSalary: numeric('previous_salary', { precision: 20, scale: 2 }).notNull(),
  newSalary: numeric('new_salary', { precision: 20, scale: 2 }).notNull(),
  currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'set null' }),
  reason: text('reason'),
  effectiveDate: timestamp('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const employeeBankAccounts = pgTable('employee_bank_accounts', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  employeeId: uuid('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  bankId: uuid('bank_id')
    .references(() => banks.id, { onDelete: 'restrict' })
    .notNull(),
  accountNumber: text('account_number').notNull(),
  accountType: text('account_type').default('CHECKING'),
  currencyId: uuid('currency_id').references(() => currencies.id, { onDelete: 'set null' }),
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
    /** `ASSET` | `LIABILITY` | `EQUITY` | `REVENUE` | `EXPENSE` | `COST` | `ORDER` (H-73). */
    type: text('type').notNull(),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => accountingAccounts.id, {
      onDelete: 'set null',
    }),
    /** Una cuenta imputable acepta líneas de asiento; al tener hijas deja de serlo (T-04-01). */
    isPostable: boolean('is_postable').default(true).notNull(),
    isActive: boolean('is_active').default(true),
  },
  table => [uniqueIndex('accounting_accounts_code_branch_idx').on(table.code, table.branchId)]
);

export const accountingEntries = pgTable(
  'accounting_entries',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    date: timestamp('date').notNull(),
    description: text('description').notNull(),
    reference: text('reference'),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'restrict' }),
    status: text('status').default('POSTED'),
    /** Documento que originó el asiento (`INVOICE`, `PAYMENT`, `PAYROLL`…) e idempotencia (T-04-03). */
    sourceType: text('source_type'),
    sourceId: uuid('source_id'),
    /** Moneda funcional del libro (VES) y tasa del documento origen (M1/M2 de `S-08`). */
    baseCurrencyId: uuid('base_currency_id').references(() => currencies.id, {
      onDelete: 'set null',
    }),
    exchangeRate: numeric('exchange_rate', { precision: 20, scale: 10 }).default('1'),
    postedAt: timestamp('posted_at'),
    postedBy: uuid('posted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  table => [
    uniqueIndex('accounting_entries_source_unq')
      .on(table.sourceType, table.sourceId)
      .where(sql`${table.sourceType} is not null and ${table.sourceId} is not null`),
    index('accounting_entries_branch_date_idx').on(table.branchId, table.date),
  ]
);

export const accountingPeriods = pgTable(
  'accounting_periods',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    /** `OPEN` | `CLOSED`. Un asiento en un período cerrado se rechaza con `409` (T-04-04). */
    status: text('status').default('OPEN').notNull(),
    closedAt: timestamp('closed_at'),
    closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
    reopenedAt: timestamp('reopened_at'),
    reopenedBy: uuid('reopened_by').references(() => users.id, { onDelete: 'set null' }),
    reopenReason: text('reopen_reason'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [
    uniqueIndex('accounting_periods_company_year_month_unq').on(
      table.companyId,
      table.year,
      table.month
    ),
  ]
);

export const accountingEntryLines = pgTable('accounting_entry_lines', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  entryId: uuid('entry_id')
    .references(() => accountingEntries.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: uuid('account_id')
    .references(() => accountingAccounts.id, { onDelete: 'restrict' })
    .notNull(),
  /** Importes en moneda funcional. */
  debit: numeric('debit', { precision: 20, scale: 2 }).default('0'),
  credit: numeric('credit', { precision: 20, scale: 2 }).default('0'),
  /** Importe y moneda originales cuando el documento no estaba en moneda funcional. */
  originalAmount: numeric('original_amount', { precision: 20, scale: 2 }),
  originalCurrencyId: uuid('original_currency_id').references(() => currencies.id, {
    onDelete: 'set null',
  }),
  description: text('description'),
});

/**
 * Correlativos fiscales por sucursal, tipo de documento y año (`T-06-01`).
 *
 * La secuencia no admite huecos ni duplicados (regla 4 de `S-06`): se reserva dentro de una
 * transacción con advisory lock, igual que los códigos `A-` y `PAY-`.
 */
export const fiscalSequences = pgTable(
  'fiscal_sequences',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    branchId: uuid('branch_id')
      .references(() => branches.id, { onDelete: 'restrict' })
      .notNull(),
    /** `RETENTION_IVA`, `RETENTION_ISLR`, `INVOICE`, `CREDIT_NOTE`… */
    documentType: text('document_type').notNull(),
    year: integer('year').notNull(),
    lastNumber: integer('last_number').default(0).notNull(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  table => [
    uniqueIndex('fiscal_sequences_branch_doc_year_unq').on(
      table.branchId,
      table.documentType,
      table.year
    ),
  ]
);

/** Archivos fiscales generados, con su hash para trazabilidad (`T-06-05`). */
export const fiscalExports = pgTable(
  'fiscal_exports',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    branchId: uuid('branch_id')
      .references(() => branches.id, { onDelete: 'restrict' })
      .notNull(),
    /** `LIBRO_VENTAS`, `LIBRO_COMPRAS`, `RETENCIONES_IVA`, `RETENCIONES_ISLR` */
    reportType: text('report_type').notNull(),
    /** `CSV`, `TXT`, `XML` */
    format: text('format').notNull(),
    periodFrom: timestamp('period_from'),
    periodTo: timestamp('period_to'),
    sequenceNumber: integer('sequence_number'),
    hash: text('hash').notNull(),
    sizeBytes: integer('size_bytes'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  table => [index('fiscal_exports_branch_created_idx').on(table.branchId, table.createdAt)]
);

export const accountingMaps = pgTable('accounting_maps', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  module: text('module').notNull(),
  transactionType: text('transaction_type'),
  categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id, {
    onDelete: 'set null',
  }),
  debitAccountId: uuid('debit_account_id').references(() => accountingAccounts.id, {
    onDelete: 'set null',
  }),
  creditAccountId: uuid('credit_account_id').references(() => accountingAccounts.id, {
    onDelete: 'set null',
  }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Tabla progresiva de ISLR por ejercicio (`H-59`, RN-09).
 *
 * Igual que el customizing de SAP: tramos en unidades tributarias con tasa y sustraendo, y una
 * vigencia (`effectiveFrom`) para que un cambio de la ley no reescriba el pasado.
 */
export const incomeTaxBrackets = pgTable(
  'income_tax_brackets',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    effectiveFrom: timestamp('effective_from').notNull(),
    fromUt: numeric('from_ut', { precision: 14, scale: 2 }).notNull(),
    toUt: numeric('to_ut', { precision: 14, scale: 2 }),
    rate: numeric('rate', { precision: 6, scale: 4 }).notNull(),
    discountUt: numeric('discount_ut', { precision: 14, scale: 2 }).default('0').notNull(),
    source: text('source'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => [index('income_tax_brackets_effective_idx').on(t.effectiveFrom, t.fromUt)]
);

/**
 * Valor de la unidad tributaria (UT) por vigencia (`S-22`).
 *
 * La ley expresa los sustraendos del ISLR en UT, así que el monto en bolívares depende del valor
 * vigente a la fecha del documento. Se guarda por `effectiveFrom` para no reescribir el pasado cuando
 * salga un reajuste.
 */
export const taxUnits = pgTable(
  'tax_units',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    value: numeric('value', { precision: 20, scale: 2 }).notNull(),
    effectiveFrom: timestamp('effective_from').notNull(),
    source: text('source'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  t => [uniqueIndex('tax_units_effective_unq').on(t.effectiveFrom)]
);

export const loans = pgTable(
  'loans',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    code: text('code').notNull().unique(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'restrict' })
      .notNull(),
    branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
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

export const loanItems = pgTable(
  'loan_items',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    loanId: uuid('loan_id')
      .references(() => loans.id, { onDelete: 'cascade' })
      .notNull(),
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'restrict' })
      .notNull(),
    quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
    serialNumber: text('serial_number'),
    condition: text('condition').default('GOOD'),
    /** `DELIVERED` al crear el préstamo; `RETURNED` cuando vuelve el artículo (H-99). */
    kind: text('kind').default('DELIVERED').notNull(),
  },
  t => ({
    loanKindIdx: index('loan_items_loan_kind_idx').on(t.loanId, t.kind),
  })
);

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
  reservations: many(inventoryBatchReservations),
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
  reservations: many(inventoryBatchReservations),
}));

export const inventoryMoveLinesRelations = relations(inventoryMoveLines, ({ one, many }) => ({
  move: one(inventoryMoves, {
    fields: [inventoryMoveLines.moveId],
    references: [inventoryMoves.id],
  }),
  product: one(products, { fields: [inventoryMoveLines.productId], references: [products.id] }),
  batch: one(productBatches, {
    fields: [inventoryMoveLines.batchId],
    references: [productBatches.id],
  }),
  reservations: many(inventoryBatchReservations),
}));

export const inventoryBatchReservationsRelations = relations(
  inventoryBatchReservations,
  ({ one }) => ({
    move: one(inventoryMoves, {
      fields: [inventoryBatchReservations.moveId],
      references: [inventoryMoves.id],
    }),
    moveLine: one(inventoryMoveLines, {
      fields: [inventoryBatchReservations.moveLineId],
      references: [inventoryMoveLines.id],
    }),
    warehouse: one(warehouses, {
      fields: [inventoryBatchReservations.warehouseId],
      references: [warehouses.id],
    }),
    product: one(products, {
      fields: [inventoryBatchReservations.productId],
      references: [products.id],
    }),
    batch: one(productBatches, {
      fields: [inventoryBatchReservations.batchId],
      references: [productBatches.id],
    }),
  })
);

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
