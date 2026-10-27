import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  companies,
  branches,
  currencies,
  partners,
  products,
  warehouses,
  users,
  invoices,
  invoiceItems,
  orders,
  orderItems,
  inventoryMoves,
  inventoryMoveLines,
  stock,
  productBatches,
} from '../schema';

export async function createTestBranch(data?: Partial<typeof branches.$inferInsert>) {
  const companyId = data?.companyId;
  const taxId = `J-${faker.string.numeric(9)}`;
  const [company] = companyId
    ? await testDb.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    : await testDb.insert(companies).values({ name: faker.company.name(), taxId }).returning();
  if (!company) throw new Error(`Company with ID ${companyId} not found`);
  const branch = {
    companyId: company.id,
    name: faker.company.name(),
    address: faker.location.streetAddress({ useFullAddress: true }),
    phone: faker.phone.number(),
    email: faker.internet.email().toLowerCase(),
    isActive: true,
    ...data,
  };
  const [result] = await testDb.insert(branches).values(branch).returning();
  return result;
}

export async function createTestCurrency(data?: Partial<typeof currencies.$inferInsert>) {
  const code = faker.string.alphanumeric({ length: 6, casing: 'upper' });
  const currency = {
    code,
    name: `Currency ${code}`,
    symbol: code.substring(0, 2),
    isBase: false,
    ...data,
  };
  const [result] = await testDb.insert(currencies).values(currency).returning();
  return result;
}

/**
 * Moneda funcional para las pruebas.
 *
 * Los archivos de prueba corren en paralelo contra la misma base, así que ninguno puede dar por
 * hecho que la moneda base ya existe: la crea el primero que la necesita y los demás la reutilizan.
 * Antes esto dependía de que `integration.test.ts` no hubiera truncado la base todavía.
 */
export async function ensureTestBaseCurrency() {
  const [existing] = await testDb
    .select()
    .from(currencies)
    .where(eq(currencies.isBase, true))
    .limit(1);
  if (existing) return existing;

  const [created] = await testDb
    .insert(currencies)
    .values({ code: 'VES', name: 'Bolívar', symbol: 'Bs', isBase: true })
    .onConflictDoUpdate({ target: currencies.code, set: { isBase: true } })
    .returning();

  return created;
}

export async function createTestPartner(data?: Partial<typeof partners.$inferInsert>) {
  const partner = {
    name: `Partner ${faker.company.name()}`,
    email: faker.internet.email().toLowerCase(),
    taxId: `J-${faker.string.numeric(9)}`,
    address: faker.location.streetAddress({ useFullAddress: true }),
    phone: faker.phone.number(),
    type: 'CUSTOMER',
    taxpayerType: 'ORDINARY',
    retentionRate: '0',
    isSpecialTaxpayer: faker.datatype.boolean({ probability: 0.2 }),
    creditLimit: faker.number.int({ min: 0, max: 100000 }).toString(),
    ...data,
  };
  const [result] = await testDb.insert(partners).values(partner).returning();
  return result;
}

export async function createTestProduct(data?: Partial<typeof products.$inferInsert>) {
  const sku = `SKU-${faker.string.alphanumeric({ length: 8, casing: 'upper' })}`;
  const product = {
    sku,
    name: `Product ${faker.commerce.productName()}`,
    description: faker.commerce.productDescription(),
    categoryId: null,
    cost: '100.00',
    price: '150.00',
    isExempt: false,
    taxRate: '16.00',
    type: 'PHYSICAL',
    minStock: faker.number.int({ min: 0, max: 50 }).toString(),
    hasBatches: faker.datatype.boolean({ probability: 0.3 }),
    currencyId: null,
    ...data,
  };
  const [result] = await testDb.insert(products).values(product).returning();
  return result;
}

export async function createTestWarehouse(
  branchId: string,
  data?: Partial<typeof warehouses.$inferInsert>
) {
  const warehouse = {
    branchId,
    name: `Warehouse ${faker.company.name()}`,
    address: faker.location.streetAddress({ useFullAddress: true }),
    isActive: true,
    ...data,
  };
  const [result] = await testDb.insert(warehouses).values(warehouse).returning();
  return result;
}

export async function createTestUser(data?: Partial<typeof users.$inferInsert>) {
  const user = {
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    password: '$2a$10$testhashedpasswordfortesting',
    refreshToken: null,
    ...data,
  };
  const [result] = await testDb.insert(users).values(user).returning();
  return result;
}

export async function createTestInvoice(
  partnerId: string,
  branchId: string,
  currencyId: string,
  data?: Partial<typeof invoices.$inferInsert>
) {
  const invoice = {
    code: `INV-${Date.now()}-${faker.string.numeric(4)}`,
    partnerId,
    branchId,
    currencyId,
    exchangeRate: '1.0000',
    type: 'SALE',
    invoiceNumber: `00001-${Date.now()}`,
    userId: null,
    orderId: null,
    status: 'DRAFT',
    fiscalStatus: 'PENDING',
    totalBase: '0',
    totalTax: '0',
    totalIgtf: '0',
    total: '0',
    date: new Date(),
    dueDate: null,
    warehouseId: null,
    ...data,
  };
  const [result] = await testDb.insert(invoices).values(invoice).returning();
  return result;
}

export async function createTestInvoiceItem(
  invoiceId: string,
  productId: string,
  data?: Partial<typeof invoiceItems.$inferInsert>
) {
  const item = {
    invoiceId,
    productId,
    quantity: '1.0000',
    price: '150.00',
    taxRate: '16.00',
    total: '174.00',
    ...data,
  };
  const [result] = await testDb.insert(invoiceItems).values(item).returning();
  return result;
}

export async function createTestOrder(
  partnerId: string,
  branchId: string,
  data?: Partial<typeof orders.$inferInsert>
) {
  const order = {
    code: `ORD-${Date.now()}-${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`,
    partnerId,
    branchId,
    warehouseId: null,
    type: 'SALE',
    status: 'PENDING',
    total: '0',
    exchangeRate: '1.0000',
    currencyId: null,
    date: new Date(),
    userId: null,
    ...data,
  };
  const [result] = await testDb.insert(orders).values(order).returning();
  return result;
}

export async function createTestOrderItem(
  orderId: string,
  productId: string,
  data?: Partial<typeof orderItems.$inferInsert>
) {
  const item = {
    orderId,
    productId,
    batchId: null,
    quantity: '1.0000',
    price: '150.00',
    ...data,
  };
  const [result] = await testDb.insert(orderItems).values(item).returning();
  return result;
}

export async function createTestStock(
  warehouseId: string,
  productId: string,
  data?: Partial<typeof stock.$inferInsert>
) {
  const stockRecord = {
    warehouseId,
    productId,
    batchId: null,
    quantity: faker.number.int({ min: 0, max: 1000 }).toString(),
    updatedAt: new Date(),
    ...data,
  };
  const [result] = await testDb.insert(stock).values(stockRecord).returning();
  return result;
}

export async function createTestInventoryMove(
  warehouseId: string,
  userId: string | null,
  data?: Partial<typeof inventoryMoves.$inferInsert>
) {
  const move = {
    code: `MOV-${Date.now()}-${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`,
    type: 'TRANSFER',
    status: 'APPROVED',
    source: 'SYSTEM',
    approvedBy: userId,
    approvedAt: new Date(),
    rejectionReason: null,
    fromWarehouseId: null,
    toWarehouseId: warehouseId,
    date: new Date(),
    note: 'Test inventory move',
    userId,
    ...data,
  };
  const [result] = await testDb.insert(inventoryMoves).values(move).returning();
  return result;
}

export async function createTestInventoryMoveLine(
  moveId: string,
  productId: string,
  data?: Partial<typeof inventoryMoveLines.$inferInsert>
) {
  const line = {
    moveId,
    productId,
    batchId: null,
    quantity: '10.0000',
    cost: '100.00',
    ...data,
  };
  const [result] = await testDb.insert(inventoryMoveLines).values(line).returning();
  return result;
}

export async function createTestProductBatch(
  productId: string,
  data?: Partial<typeof productBatches.$inferInsert>
) {
  const batch = {
    productId,
    batchNumber: `BATCH-${Date.now()}-${faker.string.alphanumeric({ length: 4, casing: 'upper' })}`,
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    cost: '100.00',
    isActive: true,
    ...data,
  };
  const [result] = await testDb.insert(productBatches).values(batch).returning();
  return result;
}
