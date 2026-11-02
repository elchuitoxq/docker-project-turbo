import { db } from '../index';
import {
  currencies,
  companies,
  branches,
  banks,
  bankAccounts,
  paymentMethods,
  users,
  usersRoles,
  usersBranches,
  roles,
  partners,
  products,
  productCategories,
  productBatches,
  warehouses,
  stock,
  orders,
  orderItems,
  invoices,
  invoiceItems,
  creditNotes,
  creditNoteItems,
  loans,
  loanItems,
  inventoryMoves,
  inventoryMoveLines,
  payments,
  paymentAllocations,
  exchangeRates,
  departments,
  jobPositions,
  employees,
  accountingAccounts,
  accountingMaps,
  payrollConceptTypes,
  payrollSettings,
  incomeTaxBrackets,
  supplierRetentionSettings,
  taxRetentions,
  taxRetentionLines,
  fiscalSequences,
  taxConcepts,
  taxUnits,
} from '../schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { seedRbac } from './seed-rbac';
import { seedPayrollCatalog } from './seed-payroll-catalog';
import { seedChartOfAccounts } from './seed-chart-of-accounts';
import { assertIntegrity } from './seed-integrity';

const IDs = {
  usd: '00000000-0000-4000-8000-000000000001',
  ves: '00000000-0000-4000-8000-000000000002',
  exchangeRate: '00000000-0000-4000-8000-000000000003',
  branch1: '00000000-0000-4000-8000-000000000010',
  branch2: '00000000-0000-4000-8000-000000000011',
  company: '00000000-0000-4000-8000-000000000012',
  warehouse1: '00000000-0000-4000-8000-000000000020',
  warehouse2: '00000000-0000-4000-8000-000000000021',
  warehouse3: '00000000-0000-4000-8000-000000000022',
  warehouse4: '00000000-0000-4000-8000-000000000023',
  warehouse5: '00000000-0000-4000-8000-000000000024',
  bank1: '00000000-0000-4000-8000-000000000030',
  bank2: '00000000-0000-4000-8000-000000000031',
  bank3: '00000000-0000-4000-8000-000000000032',
  accUsd1: '00000000-0000-4000-8000-000000000040',
  accUsd2: '00000000-0000-4000-8000-000000000041',
  accVes1: '00000000-0000-4000-8000-000000000042',
  accVes2: '00000000-0000-4000-8000-000000000043',
  pm1: '00000000-0000-4000-8000-000000000050',
  pm2: '00000000-0000-4000-8000-000000000051',
  pm3: '00000000-0000-4000-8000-000000000052',
  pm4: '00000000-0000-4000-8000-000000000053',
  pm5: '00000000-0000-4000-8000-000000000054',
  userAdmin: '00000000-0000-4000-8000-000000000100',
  userSeller: '00000000-0000-4000-8000-000000000101',
  userManager: '00000000-0000-4000-8000-000000000102',
  userWarehouse: '00000000-0000-4000-8000-000000000103',
  userAccountant: '00000000-0000-4000-8000-000000000104',
  userSuperAdmin: '00000000-0000-4000-8000-000000000105',
  partner1: '00000000-0000-4000-8000-000000000200',
  partner2: '00000000-0000-4000-8000-000000000201',
  partner3: '00000000-0000-4000-8000-000000000202',
  partner4: '00000000-0000-4000-8000-000000000203',
  partner5: '00000000-0000-4000-8000-000000000204',
  cat1: '00000000-0000-4000-8000-000000000300',
  cat2: '00000000-0000-4000-8000-000000000301',
  cat3: '00000000-0000-4000-8000-000000000302',
  prod: (i: number) => `00000000-0000-4000-8000-0000000004${i.toString().padStart(2, '0')}`,
  batch: (i: number) => `00000000-0000-4000-8000-000000000b${i.toString().padStart(2, '0')}`,
  emp: (i: number) => `00000000-0000-4000-8000-0000000005${i.toString().padStart(2, '0')}`,
  order: (i: number) => `00000000-0000-4000-8000-0000000006${i.toString().padStart(2, '0')}`,
  invoice: (i: number) => `00000000-0000-4000-8000-0000000007${i.toString().padStart(2, '0')}`,
  payment: (i: number) => `00000000-0000-4000-8000-0000000008${i.toString().padStart(2, '0')}`,
  dept1: '00000000-0000-4000-8000-000000000901',
  dept2: '00000000-0000-4000-8000-000000000902',
  position1: '00000000-0000-4000-8000-000000000911',
  position2: '00000000-0000-4000-8000-000000000912',
  position3: '00000000-0000-4000-8000-000000000913',
  acc1: '00000000-0000-4000-8000-000000000A01',
  acc2: '00000000-0000-4000-8000-000000000A02',
};

/**
 * Ids reales de las monedas, resueltos por código después del upsert.
 *
 * Las monedas se insertan con `onConflictDoUpdate` sobre `code`: si el entorno ya las tenía (por
 * ejemplo tras `db:seed:core`, que las crea con `uuidv7`), el id fijo de `IDs` **no** se usa y todo
 * lo que apuntara a él quedaba huérfano — así aparecieron facturas y cuentas bancarias sin moneda
 * (`S-16`). Por eso el resto de la semilla usa estos ids resueltos.
 */
const currencyIds = { usd: '', ves: '' };

/** Ids reales de los bancos, resueltos por código (mismo motivo que `currencyIds`). */
const bankIds = { provincial: '', banesco: '', mercantil: '' };

/**
 * Tasa del fixture: los documentos sembrados congelan esta tasa (USD → VES).
 *
 * Se alinea con la tasa oficial del BCV para que los importes en bolívares de la semilla se parezcan a
 * los reales: con 36,50 el ERP mostraba un dólar de hace años y toda cuenta por cobrar en divisa
 * quedaba subvalorada frente a la tasa vigente.
 */
const FIXTURE_USD_RATE = 889.58;

export async function seedTestData() {
  console.log('Seeding test data (deterministic)...');

  await seedRbac({ reconcileRolePermissions: true });
  await seedCurrencies();
  await seedBranches();
  await seedWarehouses();
  await seedBanks();
  await seedPaymentMethods();
  await seedBankAccounts();
  await seedTestUsers();
  await seedPartners();
  await seedProductCategories();
  await seedProducts();
  await seedProductBatches();
  await seedStock();
  await seedDepartments();
  await seedPositions();
  await seedEmployees();
  await seedPayrollCatalogForTestCompany();
  await seedAccountingAccounts();
  await linkBankAccountsToLedger();
  await seedTransactionAccountingMaps();
  await seedPayrollAccountingMaps();
  await seedIncomeTaxBrackets();
  await seedTaxUnit();
  await seedTaxConcepts();
  await seedOrders();
  await seedInvoices();
  await seedPurchases();
  await seedPurchaseRetentions();
  await seedCreditNote();
  await seedLoan();
  await seedInventoryMoves();
  await seedPayments();
  await seedDocumentEvents();
  await recalculateInvoiceBalances();
  await recalculateBankBalances();

  await validateTestData();

  console.log('Test data seeding completed successfully!');
}

async function seedCurrencies() {
  console.log('Seeding currencies...');

  await db
    .insert(currencies)
    .values([
      // La moneda funcional es VES (D-01): el dólar es la moneda de referencia y por eso lleva tasa.
      { id: IDs.usd, code: 'USD', name: 'US Dollar', symbol: '$', isBase: false },
      { id: IDs.ves, code: 'VES', name: 'Venezuelan Bolivar', symbol: 'Bs', isBase: true },
    ])
    .onConflictDoUpdate({
      target: currencies.code,
      set: {
        name: sql`excluded.name`,
        symbol: sql`excluded.symbol`,
        isBase: sql`excluded.is_base`,
      },
    });

  // Se releen por código: el id fijo sólo vale si la fila no existía.
  const seeded = await db.select({ id: currencies.id, code: currencies.code }).from(currencies);
  currencyIds.usd = seeded.find(currency => currency.code === 'USD')?.id ?? currencyIds.usd;
  currencyIds.ves = seeded.find(currency => currency.code === 'VES')?.id ?? currencyIds.ves;

  // La fecha de la tasa se ancla al día **local** a medianoche UTC: la UI compara el prefijo UTC del
  // ISO contra el día local del usuario, así que un `setUTCHours(0)` puro caía en el día siguiente
  // para cualquiera al oeste de Greenwich (en Caracas, a partir de las 20:00) y la tasa aparecía
  // "vencida por venir del futuro", bloqueando la emisión.
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  await db
    .insert(exchangeRates)
    .values({
      id: IDs.exchangeRate,
      currencyId: currencyIds.usd,
      rate: '889.58',
      date: today,
      source: 'TEST',
    })
    .onConflictDoUpdate({
      target: exchangeRates.id,
      set: { currencyId: currencyIds.usd, rate: '889.58', date: today, source: 'TEST' },
    });

  console.log('Currencies seeded');
}

async function seedBranches() {
  console.log('Seeding branches...');

  const [company] = await db
    .insert(companies)
    .values({
      id: '00000000-0000-4000-8000-000000000012',
      name: 'Empresa de Pruebas',
      taxId: 'J-12345678-9',
      address: 'Venezuela',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: companies.taxId,
      set: {
        name: 'Empresa de Pruebas',
        taxId: 'J-12345678-9',
        address: 'Venezuela',
        isActive: true,
      },
    })
    .returning();

  await db
    .insert(branches)
    .values([
      {
        id: IDs.branch1,
        companyId: company.id,
        name: 'Sucursal Caracas',
        address: 'Av. Principal, Caracas',
        phone: '0212-1234567',
        email: 'caracas@test.local',
        isActive: true,
      },
      {
        id: IDs.branch2,
        companyId: company.id,
        name: 'Sucursal Maracaibo',
        address: 'Av. Bella Vista, Maracaibo',
        phone: '0261-1234567',
        email: 'maracaibo@test.local',
        isActive: true,
      },
    ])
    .onConflictDoUpdate({
      target: branches.id,
      set: {
        name: sql`excluded.name`,
        companyId: sql`excluded.company_id`,
        address: sql`excluded.address`,
        phone: sql`excluded.phone`,
        email: sql`excluded.email`,
        isActive: sql`excluded.is_active`,
      },
    });

  console.log('Branches seeded');
}

async function seedWarehouses() {
  console.log('Seeding warehouses...');

  await db
    .insert(warehouses)
    .values([
      {
        id: IDs.warehouse1,
        branchId: IDs.branch1,
        name: 'Almacén Principal Caracas',
        address: 'Av. Industrial, Caracas',
        isActive: true,
      },
      {
        id: IDs.warehouse2,
        branchId: IDs.branch1,
        name: 'Punto de Venta Caracas',
        address: 'Av. Libertador, Caracas',
        isActive: true,
      },
      {
        id: IDs.warehouse3,
        branchId: IDs.branch2,
        name: 'Almacén Principal Maracaibo',
        address: 'Av. Industrial, Maracaibo',
        isActive: true,
      },
      {
        id: IDs.warehouse4,
        branchId: IDs.branch2,
        name: 'Depósito Norte',
        address: 'Av. 5 de Julio, Maracaibo',
        isActive: true,
      },
      {
        id: IDs.warehouse5,
        branchId: IDs.branch1,
        name: 'Depósito Sur',
        address: 'Caracas',
        isActive: true,
      },
    ])
    .onConflictDoUpdate({ target: warehouses.id, set: { name: sql`excluded.name` } });

  console.log('Warehouses seeded');
}

async function seedBanks() {
  console.log('Seeding banks...');

  await db
    .insert(banks)
    .values([
      { id: IDs.bank1, name: 'Banco Provincial', code: '0108', isActive: true },
      { id: IDs.bank2, name: 'Banesco', code: '0137', isActive: true },
      { id: IDs.bank3, name: 'Banco Mercantil', code: '0105', isActive: true },
    ])
    .onConflictDoUpdate({
      target: banks.code,
      set: { name: sql`excluded.name`, isActive: true },
    });

  // Igual que las monedas: el id fijo no aplica si el banco ya existía con otro id.
  const seeded = await db.select({ id: banks.id, code: banks.code }).from(banks);
  bankIds.provincial = seeded.find(bank => bank.code === '0108')?.id ?? IDs.bank1;
  bankIds.banesco = seeded.find(bank => bank.code === '0137')?.id ?? IDs.bank2;
  bankIds.mercantil = seeded.find(bank => bank.code === '0105')?.id ?? IDs.bank3;

  console.log('Banks seeded');
}

async function seedPaymentMethods() {
  console.log('Seeding payment methods...');

  await db
    .insert(paymentMethods)
    .values([
      {
        id: IDs.pm1,
        name: 'Efectivo USD',
        code: 'CASH_USD',
        isDigital: false,
        currencyId: currencyIds.usd,
        branchId: IDs.branch1,
      },
      {
        id: IDs.pm2,
        name: 'Efectivo VES',
        code: 'CASH_VES',
        isDigital: false,
        currencyId: currencyIds.ves,
        branchId: IDs.branch1,
      },
      {
        id: IDs.pm3,
        name: 'Punto de Venta',
        code: 'POS',
        isDigital: false,
        currencyId: currencyIds.usd,
        branchId: IDs.branch1,
      },
      {
        id: IDs.pm4,
        name: 'Transferencia',
        code: 'TRANSFER',
        isDigital: true,
        currencyId: currencyIds.usd,
        branchId: IDs.branch1,
      },
      {
        id: IDs.pm5,
        name: 'Zelle',
        code: 'ZELLE',
        isDigital: true,
        currencyId: currencyIds.usd,
        branchId: IDs.branch1,
      },
    ])
    .onConflictDoUpdate({
      target: [paymentMethods.code, paymentMethods.branchId],
      set: { name: sql`excluded.name` },
    });

  console.log('Payment methods seeded');
}

async function seedBankAccounts() {
  console.log('Seeding bank accounts...');

  await db
    .insert(bankAccounts)
    .values([
      {
        id: IDs.accUsd1,
        name: 'Cuenta Corriente USD - Caracas',
        accountNumber: 'USD-001-123456',
        type: 'CHECKING',
        bankId: bankIds.provincial,
        currencyId: currencyIds.usd,
        branchId: IDs.branch1,
        initialBalance: '5000.00',
        currentBalance: '5000.00',
        isActive: true,
      },
      {
        id: IDs.accUsd2,
        name: 'Cuenta Corriente USD - Maracaibo',
        accountNumber: 'USD-002-123456',
        type: 'CHECKING',
        bankId: bankIds.banesco,
        currencyId: currencyIds.usd,
        branchId: IDs.branch2,
        initialBalance: '2000.00',
        currentBalance: '2000.00',
        isActive: true,
      },
      {
        id: IDs.accVes1,
        name: 'Cuenta Corriente VES - Caracas',
        accountNumber: 'VES-001-123456',
        type: 'CHECKING',
        bankId: bankIds.mercantil,
        currencyId: currencyIds.ves,
        branchId: IDs.branch1,
        initialBalance: '12000.00',
        currentBalance: '12000.00',
        isActive: true,
      },
      {
        id: IDs.accVes2,
        name: 'Cuenta Corriente VES - Maracaibo',
        accountNumber: 'VES-002-123456',
        type: 'CHECKING',
        bankId: bankIds.provincial,
        currencyId: currencyIds.ves,
        branchId: IDs.branch2,
        initialBalance: '8000.00',
        currentBalance: '8000.00',
        isActive: true,
      },
    ])
    .onConflictDoUpdate({
      target: bankAccounts.id,
      set: {
        name: sql`excluded.name`,
        bankId: sql`excluded.bank_id`,
        currencyId: sql`excluded.currency_id`,
        initialBalance: sql`excluded.initial_balance`,
      },
    });

  console.log('Bank accounts seeded');
}

/**
 * Vínculo cuenta bancaria ↔ cuenta contable (`S-19`).
 *
 * El asiento de un cobro o pago abonaba siempre `1.1.1.002`, así que el mayor no distinguía bancos y
 * no había forma de conciliar contra el extracto. Cada cuenta bancaria apunta a su hoja del plan: las
 * de bolívares al banco en moneda funcional y las de divisa al banco en moneda extranjera.
 */
async function linkBankAccountsToLedger() {
  console.log('Linking bank accounts to ledger...');

  const rows = await db
    .select({ id: accountingAccounts.id, code: accountingAccounts.code })
    .from(accountingAccounts);
  const byCode = new Map<string, string>();
  for (const row of rows) {
    if (!byCode.has(row.code)) byCode.set(row.code, row.id);
  }

  const LINKS: Array<{ accountId: string; code: string }> = [
    { accountId: IDs.accUsd1, code: '1.1.1.003' },
    { accountId: IDs.accUsd2, code: '1.1.1.003' },
    { accountId: IDs.accVes1, code: '1.1.1.002' },
    { accountId: IDs.accVes2, code: '1.1.1.002' },
  ];

  let linked = 0;
  for (const link of LINKS) {
    const ledgerId = byCode.get(link.code);
    if (!ledgerId) continue;

    await db
      .update(bankAccounts)
      .set({ accountingAccountId: ledgerId })
      .where(eq(bankAccounts.id, link.accountId));
    linked += 1;
  }

  console.log(`Bank accounts linked to ledger: ${linked}`);
}

async function seedTestUsers() {
  console.log('Seeding test users...');

  const passwordHash = bcrypt.hashSync('Test1234!', 10);

  const testUsers = [
    { id: IDs.userAdmin, name: 'Test Admin', email: 'test-admin@test.local', role: 'ADMIN' },
    {
      id: IDs.userSuperAdmin,
      name: 'Test Super Admin',
      email: 'test-super-admin@test.local',
      role: 'SUPER_ADMIN',
    },
    { id: IDs.userSeller, name: 'Test Seller', email: 'test-seller@test.local', role: 'SELLER' },
    {
      id: IDs.userManager,
      name: 'Test Manager',
      email: 'test-manager@test.local',
      role: 'MANAGER',
    },
    {
      id: IDs.userWarehouse,
      name: 'Test Warehouse',
      email: 'test-warehouse@test.local',
      role: 'WAREHOUSE',
    },
    {
      id: IDs.userAccountant,
      name: 'Test Accountant',
      email: 'test-accountant@test.local',
      role: 'ACCOUNTANT',
    },
  ];

  const allRoles = await db.select({ id: roles.id, name: roles.name }).from(roles);
  const roleMap = new Map(allRoles.map(({ id, name }) => [name, id]));
  const usersWithRoles = testUsers.map(userData => {
    const roleId = roleMap.get(userData.role);
    if (!roleId) {
      throw new Error(`Required test role ${userData.role} was not seeded`);
    }
    return { ...userData, roleId };
  });

  const seededUsers = await db
    .insert(users)
    .values(
      usersWithRoles.map(userData => ({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        password: passwordHash,
        refreshToken: null,
      }))
    )
    .onConflictDoUpdate({
      target: users.email,
      set: { name: sql`excluded.name`, password: sql`excluded.password`, refreshToken: null },
    })
    .returning({ id: users.id, email: users.email });
  const userIdByEmail = new Map(seededUsers.map(({ id, email }) => [email, id]));
  const userIds = seededUsers.map(({ id }) => id);

  await db.delete(usersRoles).where(inArray(usersRoles.userId, userIds));
  await db.delete(usersBranches).where(inArray(usersBranches.userId, userIds));
  await db.insert(usersRoles).values(
    usersWithRoles.map(userData => {
      const userId = userIdByEmail.get(userData.email);
      if (!userId) {
        throw new Error(`Test user ${userData.email} was not returned after seeding`);
      }
      return { userId, roleId: userData.roleId };
    })
  );
  await db.insert(usersBranches).values(
    usersWithRoles.flatMap(userData => {
      const userId = userIdByEmail.get(userData.email);
      if (!userId) {
        throw new Error(`Test user ${userData.email} was not returned after seeding`);
      }
      return [
        { userId, branchId: IDs.branch1, isDefault: true },
        { userId, branchId: IDs.branch2, isDefault: false },
      ];
    })
  );

  console.log('Test users seeded');
}

async function seedPartners() {
  console.log('Seeding partners...');

  const partnersData = [
    {
      id: IDs.partner1,
      name: 'Cliente Ejemplo C.A.',
      email: 'cliente1@test.local',
      taxId: 'J-11111111-1',
      type: 'CUSTOMER',
    },
    {
      id: IDs.partner2,
      name: 'Distribuidora ABC C.A.',
      email: 'cliente2@test.local',
      taxId: 'J-22222222-2',
      type: 'CUSTOMER',
    },
    {
      id: IDs.partner3,
      name: 'Mayorista XYZ C.A.',
      email: 'cliente3@test.local',
      taxId: 'J-33333333-3',
      type: 'CUSTOMER',
    },
    {
      id: IDs.partner4,
      name: 'Proveedor Internacional',
      email: 'proveedor1@test.local',
      taxId: 'J-44444444-4',
      type: 'VENDOR',
    },
    {
      id: IDs.partner5,
      name: 'Servicios Integrados C.A.',
      email: 'proveedor2@test.local',
      taxId: 'J-55555555-5',
      type: 'VENDOR',
    },
  ];

  for (const partner of partnersData) {
    await db
      .insert(partners)
      .values({
        id: partner.id,
        name: partner.name,
        email: partner.email,
        taxId: partner.taxId,
        address: 'Dirección de prueba',
        phone: '0412-1234567',
        type: partner.type as 'CUSTOMER' | 'VENDOR',
        taxpayerType: 'ORDINARY',
        retentionRate: '0',
        isSpecialTaxpayer: false,
        creditLimit: '50000.00',
      })
      .onConflictDoUpdate({
        target: partners.taxId,
        set: { name: partner.name, type: partner.type },
      });
  }

  console.log('Partners seeded');
}

async function seedProductCategories() {
  console.log('Seeding product categories...');

  await db
    .insert(productCategories)
    .values([
      { id: IDs.cat1, name: 'Electrónica' },
      { id: IDs.cat2, name: 'Alimentos' },
      { id: IDs.cat3, name: 'Hogar' },
    ])
    .onConflictDoNothing();

  console.log('Product categories seeded');
}

async function seedProducts() {
  console.log('Seeding products...');

  const productsData = [
    {
      id: IDs.prod(0),
      sku: 'ELEC-001',
      name: 'Televisor LED 42"',
      cost: '250.00',
      price: '450.00',
      categoryId: IDs.cat1,
    },
    {
      id: IDs.prod(1),
      sku: 'ELEC-002',
      name: 'Laptop HP 15"',
      cost: '400.00',
      price: '750.00',
      categoryId: IDs.cat1,
    },
    {
      id: IDs.prod(2),
      sku: 'ELEC-003',
      name: 'Teléfono Samsung A54',
      cost: '150.00',
      price: '280.00',
      categoryId: IDs.cat1,
    },
    {
      id: IDs.prod(3),
      sku: 'ALIM-001',
      name: 'Arroz 1kg',
      cost: '1.50',
      price: '2.50',
      categoryId: IDs.cat2,
    },
    {
      id: IDs.prod(4),
      sku: 'ALIM-002',
      name: 'Aceite 1L',
      cost: '2.00',
      price: '3.50',
      categoryId: IDs.cat2,
    },
    {
      id: IDs.prod(5),
      sku: 'HOG-001',
      name: 'Juego de Ollas',
      cost: '45.00',
      price: '85.00',
      categoryId: IDs.cat3,
    },
    {
      id: IDs.prod(6),
      sku: 'HOG-002',
      name: 'Set de Cuchillos',
      cost: '20.00',
      price: '40.00',
      categoryId: IDs.cat3,
    },
    {
      id: IDs.prod(7),
      sku: 'ELEC-004',
      name: 'Audífonos Bluetooth',
      cost: '25.00',
      price: '55.00',
      categoryId: IDs.cat1,
    },
    {
      id: IDs.prod(8),
      sku: 'ALIM-003',
      name: 'Pasta Dental',
      cost: '1.00',
      price: '2.00',
      categoryId: IDs.cat2,
    },
    {
      id: IDs.prod(9),
      sku: 'HOG-003',
      name: 'Lámpara de Mesa',
      cost: '15.00',
      price: '30.00',
      categoryId: IDs.cat3,
    },
  ];

  for (const product of productsData) {
    await db
      .insert(products)
      .values({
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: `Producto ${product.name}`,
        categoryId: product.categoryId,
        cost: product.cost,
        price: product.price,
        isExempt: false,
        taxRate: '16',
        type: 'PHYSICAL',
        minStock: '10',
        // Un producto con lotes para poder ejercitar el selector FEFO de las salidas (`S-25`).
        hasBatches: product.id === IDs.prod(9),
        currencyId: currencyIds.usd,
      })
      .onConflictDoUpdate({
        target: products.sku,
        set: { name: product.name, hasBatches: product.id === IDs.prod(9) },
      });
  }

  console.log('Products seeded');
}

/**
 * Lotes del producto que maneja lotes (`S-25`) y sus dos casos especiales (`S-26`).
 *
 * La salida de un producto con lotes tiene que decir de qué lote sale; sin lotes cargados la pantalla
 * no tendría nada que ofrecer y el FEFO no se podría probar. Además se siembran un lote **vencido** y
 * uno **bloqueado** con existencia, que son los dos rechazos que el despacho tiene que aplicar.
 */
async function seedProductBatches() {
  console.log('Seeding product batches...');

  const batches = [
    { id: IDs.batch(0), batchNumber: 'L-2026-A', expirationDate: '2026-12-31', cost: '15.00' },
    { id: IDs.batch(1), batchNumber: 'L-2026-B', expirationDate: '2027-06-30', cost: '15.00' },
    {
      id: IDs.batch(2),
      batchNumber: 'L-2025-VENCIDO',
      expirationDate: '2025-12-31',
      cost: '15.00',
      isActive: true,
    },
    {
      id: IDs.batch(3),
      batchNumber: 'L-BLOQUEADO',
      expirationDate: '2027-12-31',
      cost: '15.00',
      isActive: false,
    },
  ];

  for (const batch of batches) {
    await db
      .insert(productBatches)
      .values({
        id: batch.id,
        productId: IDs.prod(9),
        batchNumber: batch.batchNumber,
        expirationDate: new Date(`${batch.expirationDate}T12:00:00.000Z`),
        cost: batch.cost,
        isActive: batch.isActive ?? true,
      })
      .onConflictDoNothing();
  }

  console.log('Product batches seeded');
}

async function seedStock() {
  console.log('Seeding stock...');

  const stockData: Array<{
    id?: string;
    warehouseId: string;
    productId: string;
    quantity: string;
    batchId?: string | null;
  }> = [
    { warehouseId: IDs.warehouse1, productId: IDs.prod(0), quantity: '50' },
    { warehouseId: IDs.warehouse1, productId: IDs.prod(1), quantity: '30' },
    { warehouseId: IDs.warehouse1, productId: IDs.prod(2), quantity: '100' },
    { warehouseId: IDs.warehouse2, productId: IDs.prod(3), quantity: '500' },
    { warehouseId: IDs.warehouse2, productId: IDs.prod(4), quantity: '300' },
    { warehouseId: IDs.warehouse3, productId: IDs.prod(5), quantity: '25' },
    { warehouseId: IDs.warehouse3, productId: IDs.prod(6), quantity: '40' },
    { warehouseId: IDs.warehouse4, productId: IDs.prod(7), quantity: '60' },
    { warehouseId: IDs.warehouse4, productId: IDs.prod(8), quantity: '200' },
    // El producto con lotes reparte su existencia entre sus lotes: si el stock quedara sin lote, la
    // salida por FEFO no encontraría de dónde descontar.
    {
      id: IDs.batch(0),
      warehouseId: IDs.warehouse5,
      productId: IDs.prod(9),
      quantity: '20',
      batchId: IDs.batch(0),
    },
    {
      id: IDs.batch(1),
      warehouseId: IDs.warehouse5,
      productId: IDs.prod(9),
      quantity: '15',
      batchId: IDs.batch(1),
    },
    // Lote vencido y lote bloqueado con existencia: el despacho los tiene que rechazar (`S-26`).
    {
      id: IDs.batch(2),
      warehouseId: IDs.warehouse5,
      productId: IDs.prod(9),
      quantity: '8',
      batchId: IDs.batch(2),
    },
    {
      id: IDs.batch(3),
      warehouseId: IDs.warehouse5,
      productId: IDs.prod(9),
      quantity: '4',
      batchId: IDs.batch(3),
    },
  ];

  for (let i = 0; i < stockData.length; i++) {
    const stockItem = stockData[i];
    await db
      .insert(stock)
      .values({
        id: stockItem.id ?? IDs.prod(i),
        warehouseId: stockItem.warehouseId,
        productId: stockItem.productId,
        batchId: stockItem.batchId ?? null,
        quantity: stockItem.quantity,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  // Un producto con lotes ya no puede tener existencia sin lote: la salida por FEFO no sabría de dónde
  // descontar. Se limpian las filas que dejó una siembra anterior para que el re-seed sea idempotente.
  await db.execute(
    sql`delete from stock s using products p
        where p.id = s.product_id and p.has_batches = true and s.batch_id is null`
  );

  console.log('Stock seeded');
}

async function seedEmployees() {
  console.log('Seeding employees...');

  const employeesData = [
    {
      id: IDs.emp(0),
      firstName: 'Juan',
      lastName: 'García',
      identityCard: 'V-12345678',
      positionId: IDs.position1,
      departmentId: IDs.dept2,
    },
    {
      id: IDs.emp(1),
      firstName: 'María',
      lastName: 'Rodríguez',
      identityCard: 'V-23456789',
      positionId: IDs.position2,
      departmentId: IDs.dept1,
    },
    {
      id: IDs.emp(2),
      firstName: 'Carlos',
      lastName: 'Martínez',
      identityCard: 'V-34567890',
      positionId: IDs.position2,
      departmentId: IDs.dept1,
    },
    {
      id: IDs.emp(3),
      firstName: 'Ana',
      lastName: 'López',
      identityCard: 'V-45678901',
      positionId: IDs.position3,
      departmentId: IDs.dept2,
    },
    {
      id: IDs.emp(4),
      firstName: 'Luis',
      lastName: 'Hernández',
      identityCard: 'V-56789012',
      positionId: IDs.position3,
      departmentId: IDs.dept2,
    },
  ];

  for (const emp of employeesData) {
    await db
      .insert(employees)
      .values({
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        identityCard: emp.identityCard,
        email: `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}@test.local`,
        phone: '0412-0000000',
        positionId: emp.positionId,
        departmentId: emp.departmentId,
        branchId: IDs.branch1,
        hireDate: new Date('2024-01-15'),
        terminationDate: null,
        terminationReason: null,
        salaryCurrencyId: currencyIds.usd,
        baseSalary: '500.00',
        payFrequency: 'BIWEEKLY',
        paymentMethod: 'BANK_TRANSFER',
        bankId: null,
        bankName: 'Banco Provincial',
        accountNumber: '0000-0000-0000-0000',
        accountType: 'CHECKING',
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: employees.identityCard,
        set: {
          firstName: sql`excluded.first_name`,
          positionId: sql`excluded.position_id`,
          departmentId: sql`excluded.department_id`,
          status: sql`excluded.status`,
        },
      });
  }

  console.log('Employees seeded');
}

/**
 * Catálogo de nómina de la empresa de pruebas.
 *
 * El seed creaba empresa y empleados pero no el catálogo de conceptos: sin él la nómina no se puede
 * generar («No hay conceptos de nómina configurados») y la guía de parámetros aparece sin estado.
 * Se siembra el mismo catálogo del sistema que usa la empresa principal.
 */
async function seedPayrollCatalogForTestCompany() {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.taxId, 'J-12345678-9'))
    .limit(1);

  if (!company) return;

  await seedPayrollCatalog(company.id);
}

async function seedDepartments() {
  console.log('Seeding departments...');

  await db
    .insert(departments)
    .values([
      { id: IDs.dept1, name: 'Ventas', branchId: IDs.branch1 },
      { id: IDs.dept2, name: 'Operaciones', branchId: IDs.branch1 },
    ])
    .onConflictDoUpdate({
      target: departments.id,
      set: { name: sql`excluded.name` },
    });

  console.log('Departments seeded');
}

/**
 * Cargos de la sucursal (`S-16`).
 *
 * La pantalla «Cargos» quedaba vacía y los empleados sin cargo ni departamento, así que el listado
 * de personal mostraba «0 empleados» por área.
 */
async function seedPositions() {
  console.log('Seeding job positions...');

  const positions = [
    {
      id: IDs.position1,
      name: 'Gerente de sucursal',
      description: 'Responsable de la operación y del equipo de la sucursal',
      min: '800.00',
      max: '1200.00',
    },
    {
      id: IDs.position2,
      name: 'Ejecutivo de ventas',
      description: 'Atención de clientes y cierre de ventas',
      min: '400.00',
      max: '650.00',
    },
    {
      id: IDs.position3,
      name: 'Analista administrativo',
      description: 'Soporte administrativo y control documental',
      min: '450.00',
      max: '700.00',
    },
  ];

  await db
    .insert(jobPositions)
    .values(
      positions.map(position => ({
        id: position.id,
        name: position.name,
        description: position.description,
        currencyId: currencyIds.usd,
        baseSalaryMin: position.min,
        baseSalaryMax: position.max,
      }))
    )
    .onConflictDoUpdate({
      target: jobPositions.id,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        currencyId: sql`excluded.currency_id`,
        baseSalaryMin: sql`excluded.base_salary_min`,
        baseSalaryMax: sql`excluded.base_salary_max`,
      },
    });

  console.log('Job positions seeded');
}

async function seedAccountingAccounts() {
  console.log('Seeding accounting accounts...');

  // Plan de cuentas compartido: es el que esperan los mapeos de nómina y la contabilización de
  // documentos. Antes la semilla creaba sólo dos cuentas y los mapeos de nómina abortaban (`S-16`).
  const created = await seedChartOfAccounts(IDs.branch1);
  console.log(`Accounting accounts seeded (${created} nuevas)`);
}

/**
 * Mapeos contables de ventas, compras, cobros y pagos (`S-18`).
 *
 * Sin estos mapeos `createEntryFromInvoice`/`createEntryFromPayment` fallaban con "No accounting map
 * found": la única cadena que llegaba al mayor era la nómina. Son globales (`branchId` nulo), así que
 * cualquier sucursal sin mapeo propio los hereda.
 *
 * El asiento de cobro/pago lleva además la línea de **diferencia cambiaria** (`6.1.3.001`), que se
 * calcula por imputación cuando la tasa del pago no es la congelada en la factura.
 */
async function seedTransactionAccountingMaps() {
  console.log('Seeding invoice and payment accounting maps...');

  const accountRows = await db
    .select({ id: accountingAccounts.id, code: accountingAccounts.code })
    .from(accountingAccounts);
  const byCode = new Map<string, string>();
  for (const row of accountRows) {
    if (!byCode.has(row.code)) byCode.set(row.code, row.id);
  }

  const MAPS: Array<{ module: string; transactionType: string; debit: string; credit: string }> = [
    // Venta a crédito: el cliente queda debiendo el total y la venta se reconoce por su importe.
    { module: 'INVOICE', transactionType: 'SALE', debit: '1.1.2.001', credit: '4.1.1.001' },
    // Compra a crédito: entra la mercancía y queda la obligación con el proveedor.
    { module: 'INVOICE', transactionType: 'PURCHASE', debit: '1.1.3.001', credit: '2.1.1.001' },
    // Cobro: entra el dinero al banco y se cancela la cuenta por cobrar.
    { module: 'PAYMENT', transactionType: 'INCOME', debit: '1.1.1.002', credit: '1.1.2.001' },
    // Pago: se cancela la cuenta por pagar contra la salida de banco.
    { module: 'PAYMENT', transactionType: 'EXPENSE', debit: '2.1.1.001', credit: '1.1.1.002' },
  ];

  const missing = MAPS.filter(pair => !byCode.has(pair.debit) || !byCode.has(pair.credit)).map(
    pair => `${pair.debit}/${pair.credit}`
  );
  if (missing.length > 0) {
    console.log(
      `Plan de cuentas incompleto para mapeos de transacción, faltan: ${missing.join(', ')}`
    );
    return;
  }

  await db.delete(accountingMaps).where(inArray(accountingMaps.module, ['INVOICE', 'PAYMENT']));

  await db.insert(accountingMaps).values(
    MAPS.map(pair => ({
      module: pair.module,
      transactionType: pair.transactionType,
      debitAccountId: byCode.get(pair.debit) as string,
      creditAccountId: byCode.get(pair.credit) as string,
      isActive: true,
    }))
  );

  console.log(`Transaction accounting maps seeded: ${MAPS.length}`);
}

/**
 * Mapeo contable de la nómina (`H-59`, RN-25).
 *
 * No inventa un plan de cuentas: usa el que ya existe por compañía. Cada concepto con monto apunta
 * a su par débito/crédito según su naturaleza y la clave es `(module = PAYROLL, transactionType =
 * código de concepto)`.
 */
async function seedPayrollAccountingMaps() {
  console.log('Seeding payroll accounting maps...');

  const companyRows = await db.select({ id: companies.id }).from(companies);

  // Cuentas por código: las de sueldos/gastos y las de obligaciones por pagar del plan existente.
  const accountRows = await db
    .select({ id: accountingAccounts.id, code: accountingAccounts.code })
    .from(accountingAccounts);
  const byCode = new Map<string, string>();
  for (const row of accountRows) {
    if (!byCode.has(row.code)) byCode.set(row.code, row.id);
  }

  const required = ['6.1.1.001', '6.1.1.002', '2.1.1.003', '2.1.1.004', '2.1.1.005'];
  const missing = required.filter(code => !byCode.has(code));
  if (missing.length > 0) {
    console.log(`Plan de cuentas incompleto para nómina, faltan: ${missing.join(', ')}`);
    return;
  }

  await db.delete(accountingMaps).where(eq(accountingMaps.module, 'PAYROLL'));

  const values: Array<typeof accountingMaps.$inferInsert> = [];
  for (const company of companyRows) {
    const concepts = await db
      .select({ code: payrollConceptTypes.code, category: payrollConceptTypes.category })
      .from(payrollConceptTypes)
      .where(eq(payrollConceptTypes.companyId, company.id));

    for (const concept of concepts) {
      const pair =
        concept.category === 'ASSIGNMENT'
          ? { debit: '6.1.1.001', credit: '2.1.1.004' }
          : concept.category === 'DEDUCTION'
            ? { debit: '2.1.1.004', credit: concept.code === 'ISLR' ? '2.1.1.003' : '2.1.1.005' }
            : concept.category === 'EMPLOYER_CONTRIBUTION'
              ? { debit: '6.1.1.002', credit: '2.1.1.005' }
              : null;

      if (!pair) continue;

      values.push({
        module: 'PAYROLL',
        transactionType: concept.code,
        debitAccountId: byCode.get(pair.debit),
        creditAccountId: byCode.get(pair.credit),
        isActive: true,
      });
    }
  }

  if (values.length > 0) {
    await db.insert(accountingMaps).values(values);
  }

  console.log(`Payroll accounting maps seeded: ${values.length}`);
}

/**
 * Tarifa de ISLR y valor de la unidad tributaria (`RN-09`).
 *
 * Los tramos son los del Art. 50 de la Ley de ISLR (tarifa Nº 1) y los sustraendos hacen la tarifa
 * continua en cada borde. La unidad tributaria va como parámetro con vigencia: cuando salga un
 * reajuste se agrega un registro nuevo y no se reescribe el histórico.
 *
 * El descuento único queda en 0 a propósito: la fuente consultada no permite decidir entre
 * «Bs. 774» y «774 UT», y ese valor necesita validación profesional (P-28).
 */
/**
 * Catálogo de conceptos de retención de ISLR (`settings:tax-concepts`).
 *
 * Es el maestro que clasifica al proveedor (`partners.islr_concept_id`) y el que alimenta el
 * porcentaje de retención. Los porcentajes son los del Art. 79 de la Ley de ISLR para personas
 * jurídicas domiciliadas: honorarios 5 %, comisiones 3 %, servicios 1 %, arrendamiento 3 %.
 */
/**
 * Valor de la unidad tributaria (`S-22`).
 *
 * La ley expresa varios sustraendos del ISLR en UT; sin este valor no se pueden convertir a bolívares.
 * Sólo se siembra el valor documentado (43 Bs desde el 02/06/2025); cuando el Ejecutivo publique un
 * reajuste se agrega una fila nueva y el pasado no se reescribe.
 */
async function seedTaxUnit() {
  console.log('Seeding tax unit...');

  await db
    .insert(taxUnits)
    .values({
      value: '43.00',
      effectiveFrom: new Date('2025-06-02T00:00:00.000Z'),
      source: 'Providencia de la UT (43 Bs) desde 02/06/2025 · pendiente de validación profesional',
    })
    .onConflictDoNothing({ target: taxUnits.effectiveFrom });

  console.log('Tax unit seeded');
}

async function seedTaxConcepts() {
  console.log('Seeding tax concepts...');

  const concepts = [
    { code: 'ISLR-HON', name: 'Honorarios profesionales', retentionPercentage: '5.00' },
    { code: 'ISLR-COM', name: 'Comisiones mercantiles', retentionPercentage: '3.00' },
    { code: 'ISLR-SER', name: 'Servicios (excepto honorarios)', retentionPercentage: '1.00' },
    { code: 'ISLR-ARR', name: 'Arrendamiento de inmuebles', retentionPercentage: '3.00' },
    { code: 'ISLR-FLE', name: 'Fletes', retentionPercentage: '1.00' },
    {
      code: 'ISLR-INT',
      name: 'Intereses y enriquecimiento sin causa',
      retentionPercentage: '3.00',
    },
  ];

  await db
    .insert(taxConcepts)
    .values(
      concepts.map(concept => ({
        code: concept.code,
        name: concept.name,
        retentionPercentage: concept.retentionPercentage,
        baseMin: '0',
        sustraendo: '0',
        isEnabled: true,
      }))
    )
    .onConflictDoUpdate({
      target: taxConcepts.code,
      set: {
        name: sql`excluded.name`,
        retentionPercentage: sql`excluded.retention_percentage`,
        isEnabled: sql`excluded.is_enabled`,
      },
    });

  // El proveedor con retención queda clasificado con un concepto real: sin esto el maestro no lo usa
  // nadie y la ficha del partner muestra una retención sin concepto.
  const [concept] = await db
    .select({ id: taxConcepts.id })
    .from(taxConcepts)
    .where(eq(taxConcepts.code, 'ISLR-SER'))
    .limit(1);

  if (concept) {
    await db
      .update(partners)
      .set({ islrConceptId: concept.id })
      .where(eq(partners.id, IDs.partner4));
  }

  console.log(`Tax concepts seeded: ${concepts.length}`);
}

async function seedIncomeTaxBrackets() {
  console.log('Seeding income tax brackets...');

  const effectiveFrom = new Date('2025-06-02T00:00:00.000Z');
  const source = 'Ley de ISLR, Art. 50 (tarifa Nº 1) · UT 43 Bs desde 02/06/2025';

  const brackets = [
    { fromUt: '0', toUt: '1000', rate: '0.06', discountUt: '0' },
    { fromUt: '1000', toUt: '1500', rate: '0.09', discountUt: '30' },
    { fromUt: '1500', toUt: '2000', rate: '0.12', discountUt: '75' },
    { fromUt: '2000', toUt: '2500', rate: '0.16', discountUt: '155' },
    { fromUt: '2500', toUt: '3000', rate: '0.20', discountUt: '255' },
    { fromUt: '3000', toUt: '4000', rate: '0.24', discountUt: '375' },
    { fromUt: '4000', toUt: '6000', rate: '0.29', discountUt: '575' },
    { fromUt: '6000', toUt: null, rate: '0.34', discountUt: '875' },
  ];

  await db.delete(incomeTaxBrackets);
  await db.insert(incomeTaxBrackets).values(
    brackets.map(bracket => ({
      effectiveFrom,
      fromUt: bracket.fromUt,
      toUt: bracket.toUt,
      rate: bracket.rate,
      discountUt: bracket.discountUt,
      source,
    }))
  );

  const companyRows = await db.select({ id: companies.id }).from(companies);

  const settings = [
    { key: 'UNIDAD_TRIBUTARIA', label: 'Unidad tributaria (Bs)', value: '43', type: 'MONEY' },
    {
      key: 'ISLR_DESCUENTO_UNICO',
      label: 'Descuento único anual de ISLR (Bs)',
      value: '0',
      type: 'MONEY',
    },
  ];

  for (const company of companyRows) {
    const concepts = await db
      .select({ id: payrollConceptTypes.id })
      .from(payrollConceptTypes)
      .where(eq(payrollConceptTypes.companyId, company.id))
      .limit(1);

    if (concepts.length === 0) continue;

    for (const setting of settings) {
      const [existing] = await db
        .select({ id: payrollSettings.id })
        .from(payrollSettings)
        .where(
          and(
            eq(payrollSettings.companyId, company.id),
            eq(payrollSettings.key, setting.key),
            eq(payrollSettings.effectiveFrom, effectiveFrom),
            isNull(payrollSettings.branchId)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(payrollSettings)
          .set({ value: setting.value, label: setting.label })
          .where(eq(payrollSettings.id, existing.id));
      } else {
        await db
          .insert(payrollSettings)
          .values({ ...setting, companyId: company.id, effectiveFrom });
      }
    }
  }

  // El concepto de ISLR toma la retención calculada por el motor. El catálogo ya lo declara así;
  // se mantiene el update para no depender del orden en que corran los seeds.
  await db
    .update(payrollConceptTypes)
    .set({ kind: 'FORMULA', expression: 'ISLR_WITHHOLDING' })
    .where(eq(payrollConceptTypes.code, 'ISLR'));

  console.log(`Income tax brackets seeded: ${brackets.length}`);
}

async function seedOrders() {
  console.log('Seeding orders...');

  const ordersData = [
    { id: IDs.order(0), code: 'ORD-000001', partnerId: IDs.partner1, status: 'COMPLETED' },
    { id: IDs.order(1), code: 'ORD-000002', partnerId: IDs.partner2, status: 'COMPLETED' },
    { id: IDs.order(2), code: 'ORD-000003', partnerId: IDs.partner1, status: 'PENDING' },
    { id: IDs.order(3), code: 'ORD-000004', partnerId: IDs.partner3, status: 'PROCESSING' },
    { id: IDs.order(4), code: 'ORD-000005', partnerId: IDs.partner2, status: 'CANCELLED' },
  ];

  for (let i = 0; i < ordersData.length; i++) {
    const order = ordersData[i];
    await db
      .insert(orders)
      .values({
        id: order.id,
        code: order.code,
        partnerId: order.partnerId,
        branchId: IDs.branch1,
        warehouseId: IDs.warehouse1,
        type: 'SALE',
        status: order.status as 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED',
        total: '1000.00',
        exchangeRate: FIXTURE_USD_RATE.toFixed(10),
        currencyId: currencyIds.usd,
        date: new Date(),
        userId: IDs.userSeller,
      })
      .onConflictDoUpdate({
        target: orders.code,
        set: {
          total: sql`excluded.total`,
          status: order.status as any,
          exchangeRate: FIXTURE_USD_RATE.toFixed(10),
        },
      });

    await db
      .insert(orderItems)
      .values({
        id: `00000000-0000-4000-8000-00000000${i.toString().padStart(4, '0')}`,
        orderId: order.id,
        productId: IDs.prod(0),
        batchId: null,
        quantity: '2',
        price: '500.00',
      })
      .onConflictDoNothing();
  }

  console.log('Orders seeded');
}

/**
 * Facturas de compra con su cuenta por pagar (`S-03`).
 *
 * Sin ellas «Compras» y «Cuentas por pagar» quedaban vacías en un entorno recién sembrado, y con
 * ellas tampoco había de dónde generar retenciones ni pagos de proveedor (`S-16`).
 */
async function seedPurchases() {
  console.log('Seeding purchase invoices...');

  const purchases = [
    {
      id: '00000000-0000-4000-8000-000000000a01',
      code: 'COMP-000001',
      partnerId: IDs.partner4,
      supplierInvoiceNumber: 'FAC-7788',
      totalBase: '1000.00',
      status: 'POSTED',
      paidAmount: '0',
    },
    {
      id: '00000000-0000-4000-8000-000000000a02',
      code: 'COMP-000002',
      partnerId: IDs.partner4,
      supplierInvoiceNumber: 'FAC-7789',
      totalBase: '500.00',
      status: 'PARTIAL',
      paidAmount: '250.00',
    },
    {
      id: '00000000-0000-4000-8000-000000000a03',
      code: 'COMP-000003',
      partnerId: IDs.partner5,
      supplierInvoiceNumber: 'FAC-9901',
      totalBase: '800.00',
      status: 'PAID',
      // Se pagó el neto: 928 de total menos 104 de retenciones (IVA 96 + ISLR 8). Pagar el total
      // dejaba la factura en "Pagada" con saldo -104 (`S-17` M-31).
      paidAmount: '824.00',
    },
  ];

  for (let index = 0; index < purchases.length; index += 1) {
    const purchase = purchases[index];
    const totalTax = (Number(purchase.totalBase) * 0.16).toFixed(2);
    const total = (Number(purchase.totalBase) + Number(totalTax)).toFixed(2);
    const exchangeRate = FIXTURE_USD_RATE.toFixed(10);

    await db
      .insert(invoices)
      .values({
        id: purchase.id,
        code: purchase.code,
        partnerId: purchase.partnerId,
        branchId: IDs.branch1,
        currencyId: currencyIds.usd,
        exchangeRate,
        type: 'PURCHASE',
        supplierInvoiceNumber: purchase.supplierInvoiceNumber,
        supplierInvoiceDate: new Date(),
        status: purchase.status,
        fiscalStatus: 'VALIDATED',
        totalBase: purchase.totalBase,
        totalTax,
        totalIgtf: '0',
        total,
        paidAmount: purchase.paidAmount,
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userId: IDs.userAccountant,
      })
      .onConflictDoUpdate({
        target: invoices.code,
        set: {
          total,
          status: purchase.status,
          paidAmount: purchase.paidAmount,
          exchangeRate,
        },
      });

    await db
      .insert(invoiceItems)
      .values({
        id: `00000000-0000-4000-8000-00000003${index.toString().padStart(4, '0')}`,
        invoiceId: purchase.id,
        productId: IDs.prod(index + 1),
        quantity: '1',
        price: purchase.totalBase,
        cost: '250.00',
        taxRate: '16',
        // `total` de la línea es la base (cantidad × precio), igual que en la venta: el impuesto se
        // suma en la cabecera. Poner aquí el total con IVA mostraba una línea de USD 580 con precio
        // de USD 500 y total del documento de USD 580 (`S-16` M-29).
        total: purchase.totalBase,
      })
      // El total de la línea se recalcula en cada siembra: antes `onConflictDoNothing` dejaba el
      // valor viejo (con IVA) y la ficha mostraba una línea cuyo total no cuadraba con su precio.
      .onConflictDoUpdate({
        target: invoiceItems.id,
        set: { total: sql`excluded.total` },
      });
  }

  console.log('Purchase invoices seeded');
}

/**
 * Parámetros de retención y comprobantes de las compras sembradas (`S-16` M-26).
 *
 * El servicio emite los comprobantes al postear la compra (`SupplierRetentionService`), pero las
 * compras del seed se insertan ya posteadas: sin este paso la pantalla de retenciones, el TXT del
 * SENIAT y el XML de ISLR quedaban vacíos en un entorno recién sembrado. Los porcentajes son los
 * legales venezolanos (IVA 75 % del impuesto, 100 % para sujeto especial; ISLR 1 % de servicios).
 *
 * Idempotente por `(invoiceId, type)`, igual que `SupplierRetentionService`: si la compra ya tiene su
 * comprobante no se vuelve a emitir ni se consume un correlativo.
 */
async function seedPurchaseRetentions() {
  console.log('Seeding supplier retentions...');

  const IVA_RATE = 75;
  const IVA_RATE_SPECIAL = 100;
  const ISLR_RATE = 1;
  const ISLR_SUSTRAENDO = 0;
  const ISLR_THRESHOLD = 0;

  await db
    .insert(supplierRetentionSettings)
    .values({
      companyId: IDs.company,
      ivaRetentionRate: IVA_RATE.toFixed(2),
      ivaRetentionRateSpecial: IVA_RATE_SPECIAL.toFixed(2),
      islrRate: ISLR_RATE.toFixed(2),
      islrSustraendo: ISLR_SUSTRAENDO.toFixed(2),
      islrThreshold: ISLR_THRESHOLD.toFixed(2),
    })
    .onConflictDoUpdate({
      target: supplierRetentionSettings.companyId,
      set: {
        ivaRetentionRate: sql`excluded.iva_retention_rate`,
        ivaRetentionRateSpecial: sql`excluded.iva_retention_rate_special`,
        islrRate: sql`excluded.islr_rate`,
        islrSustraendo: sql`excluded.islr_sustraendo`,
        islrThreshold: sql`excluded.islr_threshold`,
      },
    });

  const purchases = await db
    .select({
      id: invoices.id,
      code: invoices.code,
      partnerId: invoices.partnerId,
      branchId: invoices.branchId,
      currencyId: invoices.currencyId,
      exchangeRate: invoices.exchangeRate,
      totalBase: invoices.totalBase,
      totalTax: invoices.totalTax,
      date: invoices.date,
      userId: invoices.userId,
      isSpecialTaxpayer: partners.isSpecialTaxpayer,
      retentionRate: partners.retentionRate,
      islrConceptId: partners.islrConceptId,
    })
    .from(invoices)
    .leftJoin(partners, eq(partners.id, invoices.partnerId))
    .where(
      and(eq(invoices.type, 'PURCHASE'), inArray(invoices.status, ['POSTED', 'PARTIAL', 'PAID']))
    );

  const year = new Date().getUTCFullYear();
  const period = `${year}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  // Cada tipo llevaba su propio correlativo y el seed los renumeraba desde 1 en cada corrida, así
  // que la segunda siembra emitía comprobantes nuevos para facturas que ya tenían el suyo. Ahora se
  // parte del máximo real de la base y se omite lo que ya existe (misma idempotencia que el servicio).
  const sequenceFor = async (branchId: string, documentType: string): Promise<number> => {
    const [row] = await db
      .select({ lastNumber: fiscalSequences.lastNumber })
      .from(fiscalSequences)
      .where(
        and(
          eq(fiscalSequences.branchId, branchId),
          eq(fiscalSequences.documentType, documentType),
          eq(fiscalSequences.year, year)
        )
      )
      .limit(1);

    const existing = await db
      .select({ voucherNumber: taxRetentions.voucherNumber })
      .from(taxRetentions)
      .where(
        and(
          eq(taxRetentions.branchId, branchId),
          eq(taxRetentions.type, documentType === 'RETENTION_IVA' ? 'IVA' : 'ISLR')
        )
      );

    let max = row?.lastNumber ?? 0;
    for (const { voucherNumber } of existing) {
      const match = voucherNumber?.match(/-(\d+)$/);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }

    return max;
  };

  // Conceptos de ISLR por id: la semilla resuelve la retención con la misma precedencia que el
  // servicio (`S-21`): concepto del proveedor → tasa propia → parámetros de la empresa.
  const conceptRows = await db
    .select({
      id: taxConcepts.id,
      retentionPercentage: taxConcepts.retentionPercentage,
      baseMin: taxConcepts.baseMin,
      sustraendo: taxConcepts.sustraendo,
      isEnabled: taxConcepts.isEnabled,
    })
    .from(taxConcepts);
  const conceptById = new Map(conceptRows.map(row => [row.id, row]));

  for (const purchase of purchases) {
    const base = Number(purchase.totalBase ?? 0);
    const tax = Number(purchase.totalTax ?? 0);
    const rate = purchase.isSpecialTaxpayer ? IVA_RATE_SPECIAL : IVA_RATE;
    const ivaRetained = Math.round(((tax * rate) / 100 + Number.EPSILON) * 100) / 100;

    const concept = purchase.islrConceptId ? conceptById.get(purchase.islrConceptId) : undefined;
    const ownRate = Number(purchase.retentionRate ?? 0);
    const islrRule = concept?.isEnabled
      ? {
          rate: Number(concept.retentionPercentage),
          threshold: Number(concept.baseMin ?? 0),
          sustraendo: Number(concept.sustraendo ?? 0),
          conceptId: concept.id,
          source: 'CONCEPT',
        }
      : ownRate > 0
        ? {
            rate: ownRate,
            threshold: ISLR_THRESHOLD,
            sustraendo: ISLR_SUSTRAENDO,
            conceptId: null,
            source: 'PARTNER',
          }
        : {
            rate: ISLR_RATE,
            threshold: ISLR_THRESHOLD,
            sustraendo: ISLR_SUSTRAENDO,
            conceptId: null,
            source: 'SETTINGS',
          };

    const islrRetained =
      base >= islrRule.threshold && islrRule.rate > 0
        ? Math.max(
            0,
            Math.round(
              ((base * islrRule.rate) / 100 - islrRule.sustraendo + Number.EPSILON) * 100
            ) / 100
          )
        : 0;
    const exchangeRate = Number(purchase.exchangeRate ?? 1) || 1;
    const branchId = purchase.branchId ?? IDs.branch1;

    const retentions: {
      type: 'IVA' | 'ISLR';
      tax: number;
      retained: number;
      appliedRate: number;
      ruleSource: string;
      conceptId: string | null;
    }[] = [];
    // Un retenido de 0 no es una obligación fiscal y ensucia el correlativo (misma regla que el
    // servicio): sólo se emite el comprobante cuando hay algo retenido.
    if (ivaRetained > 0) {
      retentions.push({
        type: 'IVA',
        tax,
        retained: ivaRetained,
        appliedRate: rate,
        ruleSource: 'SETTINGS',
        conceptId: null,
      });
    }
    if (islrRetained > 0) {
      retentions.push({
        type: 'ISLR',
        tax: 0,
        retained: islrRetained,
        appliedRate: islrRule.rate,
        ruleSource: islrRule.source,
        conceptId: islrRule.conceptId,
      });
    }

    for (const retention of retentions) {
      const [alreadyIssued] = await db
        .select({ id: taxRetentions.id })
        .from(taxRetentions)
        .where(
          and(eq(taxRetentions.invoiceId, purchase.id), eq(taxRetentions.type, retention.type))
        )
        .limit(1);

      if (alreadyIssued) {
        // Comprobantes emitidos antes de `S-21`: se completan con la regla resuelta en vez de emitir
        // otro. Así la semilla sigue siendo idempotente y repara las filas heredadas.
        // Se refrescan también los importes y la tasa: si cambia la tasa del fixture, el comprobante
        // heredado no puede quedarse con la conversión vieja (el saldo del socio y los archivos del
        // SENIAT se calculan desde aquí).
        await db
          .update(taxRetentions)
          .set({
            totalBase: String(base),
            totalTax: String(retention.tax),
            totalRetained: String(retention.retained),
            totalRetainedBase: (retention.retained * exchangeRate).toFixed(2),
            exchangeRate: String(exchangeRate),
            appliedRate: retention.appliedRate.toFixed(2),
            ruleSource: retention.ruleSource,
          })
          .where(eq(taxRetentions.id, alreadyIssued.id));

        await db
          .update(taxRetentionLines)
          .set({
            baseAmount: String(base),
            taxAmount: String(retention.tax),
            retainedAmount: String(retention.retained),
            conceptId: retention.conceptId,
          })
          .where(eq(taxRetentionLines.retentionId, alreadyIssued.id));

        continue;
      }

      const isIva = retention.type === 'IVA';
      const documentType = isIva ? 'RETENTION_IVA' : 'RETENTION_ISLR';
      const nextNumber = (await sequenceFor(branchId, documentType)) + 1;
      const voucherNumber = `${isIva ? 'RET-IVA' : 'RET-ISLR'}-${year}-${String(nextNumber).padStart(6, '0')}`;

      const [created] = await db
        .insert(taxRetentions)
        .values({
          code: voucherNumber,
          voucherNumber,
          partnerId: purchase.partnerId,
          branchId,
          period,
          type: retention.type,
          totalBase: String(base),
          totalTax: String(retention.tax),
          totalRetained: String(retention.retained),
          totalRetainedBase: (retention.retained * exchangeRate).toFixed(2),
          currencyId: purchase.currencyId,
          exchangeRate: String(exchangeRate),
          invoiceId: purchase.id,
          appliedRate: retention.appliedRate.toFixed(2),
          ruleSource: retention.ruleSource,
          date: purchase.date ?? new Date(),
          userId: purchase.userId ?? null,
        })
        .returning({ id: taxRetentions.id });

      // La línea es la fuente de los archivos del SENIAT (TXT de IVA y XML de ISLR): sin ella el
      // comprobante aparece con base y retenido en 0 en la exportación (`S-16` M-27).
      await db.insert(taxRetentionLines).values({
        retentionId: created.id,
        invoiceId: purchase.id,
        baseAmount: String(base),
        taxAmount: String(retention.tax),
        retainedAmount: String(retention.retained),
        conceptId: retention.conceptId,
      });

      await db
        .insert(fiscalSequences)
        .values({ branchId, documentType, year, lastNumber: nextNumber })
        .onConflictDoUpdate({
          target: [fiscalSequences.branchId, fiscalSequences.documentType, fiscalSequences.year],
          set: { lastNumber: sql`excluded.last_number` },
        });
    }
  }

  console.log('Supplier retentions seeded');
}

/**
 * Un comprobante de nota de crédito emitido y aplicado a una factura de venta (`S-07`).
 */
async function seedCreditNote() {
  console.log('Seeding credit notes...');

  const creditNoteId = '00000000-0000-4000-8000-000000000b01';
  const totalBase = '100.00';
  const totalTax = '16.00';
  const total = '116.00';

  await db
    .insert(creditNotes)
    .values({
      id: creditNoteId,
      code: 'NC-000001',
      type: 'SALE',
      invoiceId: IDs.invoice(0),
      partnerId: IDs.partner1,
      branchId: IDs.branch1,
      warehouseId: IDs.warehouse1,
      currencyId: currencyIds.usd,
      exchangeRate: FIXTURE_USD_RATE.toFixed(6),
      status: 'POSTED',
      totalBase,
      totalTax,
      totalIgtf: '0',
      total,
      date: new Date(),
      userId: IDs.userSeller,
    })
    .onConflictDoUpdate({
      target: creditNotes.code,
      set: { total, status: 'POSTED' },
    });

  await db
    .insert(creditNoteItems)
    .values({
      id: '00000000-0000-4000-8000-000000000b02',
      creditNoteId,
      productId: IDs.prod(0),
      quantity: '1',
      price: totalBase,
      taxRate: '16',
      total,
    })
    .onConflictDoNothing();

  console.log('Credit notes seeded');
}

/**
 * Préstamo de equipo aprobado (`S-07`): el ciclo queda a un paso de la devolución.
 */
async function seedLoan() {
  console.log('Seeding loans...');

  const loanId = '00000000-0000-4000-8000-000000000c01';

  await db
    .insert(loans)
    .values({
      id: loanId,
      code: 'PRE-000001',
      partnerId: IDs.partner2,
      branchId: IDs.branch1,
      status: 'ACTIVE',
      startDate: new Date(),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      notes: 'Equipo de demostración para el cliente',
    })
    .onConflictDoUpdate({ target: loans.code, set: { status: 'ACTIVE' } });

  await db
    .insert(loanItems)
    .values({
      id: '00000000-0000-4000-8000-000000000c02',
      loanId,
      productId: IDs.prod(0),
      quantity: '1',
      serialNumber: 'SN-DEMO-0001',
      condition: 'GOOD',
      kind: 'DELIVERED',
    })
    .onConflictDoNothing();

  console.log('Loans seeded');
}

/**
 * Movimientos de inventario que justifican el stock sembrado (`S-16`).
 *
 * El kardex quedaba vacío aunque hubiera existencias: un movimiento `APPROVED` por almacén deja la
 * trazabilidad sin tocar las cantidades (el stock es la fuente de verdad del fixture).
 */
async function seedInventoryMoves() {
  console.log('Seeding inventory moves...');

  // Los cuatro tipos existen en el negocio y la pantalla los cuenta por separado (`S-23`): la semilla
  // tiene que traer al menos uno de cada uno para que las tarjetas y los filtros no salgan en cero.
  const moves: Array<{
    code: string;
    type: 'ENTRADA' | 'SALIDA' | 'TRANSFERENCIA' | 'AJUSTE';
    fromWarehouseId?: string;
    toWarehouseId?: string;
    status: 'APPROVED' | 'EN_TRAMITE';
    note: string;
    /** Motivo del ajuste (`S-25`): obligatorio cuando el movimiento corrige un conteo. */
    reasonCode?: string;
    /** La diferencia superó la tolerancia: no la puede aprobar quien la registró. */
    requiresSecondApproval?: boolean;
    /** La salida se saltó el FEFO con autorización (`S-26`). */
    fefoOverride?: boolean;
    fefoOverrideReason?: string;
    lines: Array<{
      productIndex: number;
      quantity: string;
      cost?: string;
      batchId?: string;
    }>;
  }> = [
    {
      code: 'MOV-000001',
      type: 'ENTRADA',
      toWarehouseId: IDs.warehouse1,
      status: 'APPROVED',
      note: 'Carga inicial de inventario (fixture)',
      lines: [
        { productIndex: 0, quantity: '10.0000', cost: '100.00' },
        { productIndex: 1, quantity: '10.0000', cost: '100.00' },
        { productIndex: 2, quantity: '10.0000', cost: '100.00' },
      ],
    },
    {
      code: 'MOV-000002',
      type: 'ENTRADA',
      toWarehouseId: IDs.warehouse2,
      status: 'APPROVED',
      note: 'Carga inicial de inventario (fixture)',
      lines: [
        { productIndex: 3, quantity: '10.0000', cost: '100.00' },
        { productIndex: 4, quantity: '10.0000', cost: '100.00' },
      ],
    },
    {
      code: 'MOV-000003',
      type: 'SALIDA',
      fromWarehouseId: IDs.warehouse1,
      status: 'APPROVED',
      note: 'Despacho a cliente (fixture)',
      lines: [{ productIndex: 2, quantity: '4.0000' }],
    },
    {
      code: 'MOV-000004',
      type: 'TRANSFERENCIA',
      fromWarehouseId: IDs.warehouse1,
      toWarehouseId: IDs.warehouse2,
      status: 'APPROVED',
      note: 'Reposición entre almacenes (fixture)',
      lines: [{ productIndex: 1, quantity: '6.0000', cost: '100.00' }],
    },
    {
      code: 'MOV-000005',
      type: 'AJUSTE',
      fromWarehouseId: IDs.warehouse1,
      status: 'APPROVED',
      note: 'Ajuste por conteo físico (fixture)',
      reasonCode: 'CONTEO',
      lines: [{ productIndex: 0, quantity: '48.0000', cost: '100.00' }],
    },
    {
      // Uno en borrador para poder ejercitar aprobar/rechazar desde la interfaz sin crear datos.
      code: 'MOV-000006',
      type: 'SALIDA',
      fromWarehouseId: IDs.warehouse3,
      status: 'EN_TRAMITE',
      note: 'Salida pendiente de aprobación (fixture)',
      lines: [{ productIndex: 5, quantity: '2.0000' }],
    },
    {
      // Ajuste fuera de tolerancia en borrador: muestra el aviso «requiere 2ª aprobación» y sirve
      // para comprobar que el creador no puede aprobarlo (`S-25`).
      code: 'MOV-000007',
      type: 'AJUSTE',
      fromWarehouseId: IDs.warehouse2,
      status: 'EN_TRAMITE',
      note: 'Faltante detectado en conteo (fixture)',
      reasonCode: 'HURTO',
      requiresSecondApproval: true,
      lines: [{ productIndex: 3, quantity: '100.0000', cost: '100.00' }],
    },
    {
      // Entrada de un producto con lotes: deja el lote creado y permite probar la salida por FEFO.
      code: 'MOV-000008',
      type: 'ENTRADA',
      toWarehouseId: IDs.warehouse5,
      status: 'APPROVED',
      note: 'Reposición del lote A (fixture)',
      lines: [{ productIndex: 9, quantity: '5.0000', cost: '15.00', batchId: IDs.batch(0) }],
    },
    {
      // Salida que se salta el FEFO con autorización: el listado muestra la excepción y su motivo
      // (`S-26`). Queda en borrador para no alterar las existencias del fixture.
      code: 'MOV-000009',
      type: 'SALIDA',
      fromWarehouseId: IDs.warehouse5,
      status: 'EN_TRAMITE',
      note: 'Despacho del lote posterior al sugerido (fixture)',
      fefoOverride: true,
      fefoOverrideReason: 'El cliente exige el lote L-2026-B en la orden de compra',
      lines: [{ productIndex: 9, quantity: '2.0000', batchId: IDs.batch(1) }],
    },
  ];

  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index];
    const moveId = `00000000-0000-4000-8000-000000000d${(index + 1).toString().padStart(2, '0')}`;
    const approved = move.status === 'APPROVED';

    await db
      .insert(inventoryMoves)
      .values({
        id: moveId,
        code: move.code,
        type: move.type,
        status: move.status,
        branchId: IDs.branch1,
        source: 'MANUAL',
        fromWarehouseId: move.fromWarehouseId,
        toWarehouseId: move.toWarehouseId,
        date: new Date(),
        note: move.note,
        reasonCode: move.reasonCode ?? null,
        requiresSecondApproval: move.requiresSecondApproval ?? false,
        fefoOverride: move.fefoOverride ?? false,
        fefoOverrideReason: move.fefoOverrideReason ?? null,
        userId: IDs.userWarehouse,
        approvedBy: approved ? IDs.userWarehouse : null,
        approvedAt: approved ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: inventoryMoves.code,
        set: {
          type: move.type,
          status: move.status,
          note: move.note,
          reasonCode: move.reasonCode ?? null,
          requiresSecondApproval: move.requiresSecondApproval ?? false,
          fefoOverride: move.fefoOverride ?? false,
          fefoOverrideReason: move.fefoOverrideReason ?? null,
        },
      });

    for (let lineIndex = 0; lineIndex < move.lines.length; lineIndex += 1) {
      const line = move.lines[lineIndex];
      await db
        .insert(inventoryMoveLines)
        .values({
          id: `00000000-0000-4000-8000-000000000e${index}${lineIndex}`.slice(0, 36),
          moveId,
          productId: IDs.prod(line.productIndex),
          batchId: line.batchId ?? null,
          quantity: line.quantity,
          cost: line.cost ?? null,
        })
        .onConflictDoNothing();
    }
  }

  console.log('Inventory moves seeded');
}

async function seedInvoices() {
  console.log('Seeding invoices...');

  const invoicesData = [
    {
      id: IDs.invoice(0),
      code: 'INV-000001',
      partnerId: IDs.partner1,
      status: 'POSTED',
      totalBase: '500.00',
    },
    {
      id: IDs.invoice(1),
      code: 'INV-000002',
      partnerId: IDs.partner2,
      status: 'POSTED',
      totalBase: '750.00',
    },
    {
      id: IDs.invoice(2),
      code: 'INV-000003',
      partnerId: IDs.partner1,
      status: 'DRAFT',
      totalBase: '300.00',
    },
    {
      id: IDs.invoice(3),
      code: 'INV-000004',
      partnerId: IDs.partner3,
      status: 'CANCELLED',
      totalBase: '1000.00',
    },
    {
      id: IDs.invoice(4),
      code: 'INV-000005',
      partnerId: IDs.partner2,
      status: 'POSTED',
      totalBase: '200.00',
    },
  ];

  for (let i = 0; i < invoicesData.length; i++) {
    const invoice = invoicesData[i];
    const totalTax = (parseFloat(invoice.totalBase) * 0.16).toFixed(2);
    const total = (parseFloat(invoice.totalBase) + parseFloat(totalTax)).toFixed(2);

    await db
      .insert(invoices)
      .values({
        id: invoice.id,
        code: invoice.code,
        partnerId: invoice.partnerId,
        branchId: IDs.branch1,
        currencyId: currencyIds.usd,
        exchangeRate: FIXTURE_USD_RATE.toFixed(10),
        type: 'SALE',
        invoiceNumber: `F${invoice.code.replace('-', '')}`,
        userId: IDs.userSeller,
        orderId: IDs.order(0),
        status: invoice.status as 'DRAFT' | 'POSTED' | 'CANCELLED',
        fiscalStatus: invoice.status === 'POSTED' ? 'VALIDATED' : 'PENDING',
        totalBase: invoice.totalBase,
        totalTax,
        totalIgtf: '0',
        total,
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        warehouseId: IDs.warehouse1,
      })
      .onConflictDoUpdate({
        target: invoices.code,
        set: {
          total,
          status: invoice.status as any,
          exchangeRate: FIXTURE_USD_RATE.toFixed(10),
        },
      });

    await db
      .insert(invoiceItems)
      .values({
        id: `00000000-0000-4000-8000-00000001${i.toString().padStart(4, '0')}`,
        invoiceId: invoice.id,
        productId: IDs.prod(0),
        quantity: '1',
        price: invoice.totalBase,
        cost: '250.00',
        taxRate: '16',
        total,
      })
      .onConflictDoNothing();
  }

  console.log('Invoices seeded');
}

async function seedPayments() {
  console.log('Seeding payments...');

  const paymentsData = [
    {
      id: IDs.payment(0),
      code: 'PAY-000001',
      invoiceId: IDs.invoice(0),
      partnerId: IDs.partner1,
      // Neto de la nota de crédito NC-000001 (116): 580 − 116. Cobrar el total dejaba la factura
      // con saldo a favor (`S-17` M-31).
      amount: '464.00',
      status: 'POSTED',
      type: 'INCOME',
    },
    {
      id: IDs.payment(1),
      code: 'PAY-000002',
      invoiceId: IDs.invoice(1),
      partnerId: IDs.partner2,
      amount: '870.00',
      status: 'POSTED',
      type: 'INCOME',
    },
    {
      id: IDs.payment(2),
      code: 'PAY-000003',
      invoiceId: IDs.invoice(4),
      partnerId: IDs.partner2,
      amount: '200.00',
      status: 'POSTED',
      type: 'INCOME',
    },
    // Pagos a proveedor: el abono parcial de COMP-000002 y el neto de COMP-000003 (928 − 104 de
    // retenciones). Sin ellos la compra quedaba "pagada" sin ningún movimiento de caja (`S-17` M-31).
    {
      id: IDs.payment(3),
      code: 'PAY-000004',
      invoiceId: '00000000-0000-4000-8000-000000000a02',
      partnerId: IDs.partner4,
      amount: '250.00',
      status: 'POSTED',
      type: 'EXPENSE',
    },
    {
      id: IDs.payment(4),
      code: 'PAY-000005',
      invoiceId: '00000000-0000-4000-8000-000000000a03',
      partnerId: IDs.partner5,
      amount: '824.00',
      status: 'POSTED',
      type: 'EXPENSE',
    },
  ];

  for (let i = 0; i < paymentsData.length; i++) {
    const payment = paymentsData[i];
    const exchangeRate = FIXTURE_USD_RATE;
    const partnerId = payment.partnerId;
    await db
      .insert(payments)
      .values({
        id: payment.id,
        code: payment.code,
        invoiceId: payment.invoiceId,
        partnerId,
        branchId: IDs.branch1,
        methodId: IDs.pm1,
        status: payment.status as 'POSTED' | 'PENDING' | 'CANCELLED',
        type: payment.type as 'INCOME' | 'EXPENSE',
        amount: payment.amount,
        currencyId: currencyIds.usd,
        exchangeRate: exchangeRate.toFixed(10),
        amountBase: (Number(payment.amount) * exchangeRate).toFixed(2),
        // Todo pago en divisa entra o sale de una cuenta en divisa de la MISMA sucursal (`S-18`):
        // mezclar monedas en una cuenta hace imposible conciliar su saldo.
        bankAccountId: IDs.accUsd1,
        reference: `REF-${payment.code}`,
        date: new Date(),
        userId: IDs.userSeller,
      })
      .onConflictDoUpdate({
        target: payments.code,
        set: {
          invoiceId: payment.invoiceId,
          partnerId,
          type: payment.type as 'INCOME' | 'EXPENSE',
          amount: payment.amount,
          status: payment.status as any,
          exchangeRate: exchangeRate.toFixed(10),
          amountBase: (Number(payment.amount) * exchangeRate).toFixed(2),
        },
      });

    if (payment.status === 'POSTED') {
      await db
        .insert(paymentAllocations)
        .values({
          id: `00000000-0000-4000-8000-00000002${i.toString().padStart(4, '0')}`,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          amount: payment.amount,
          amountBase: (Number(payment.amount) * exchangeRate).toFixed(2),
          // Pago y factura comparten moneda: la imputación baja el saldo a la par (`S-18`).
          invoiceAmount: payment.amount,
          exchangeRate: exchangeRate.toFixed(10),
          exchangeDifferenceBase: '0',
        })
        // La imputación también se corrige: con `do nothing`, volver a sembrar dejaba la
        // asignación vieja apuntando a otra factura (`S-17`).
        .onConflictDoUpdate({
          target: paymentAllocations.id,
          set: {
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            amount: payment.amount,
            amountBase: sql`excluded.amount_base`,
            invoiceAmount: sql`excluded.invoice_amount`,
            exchangeRate: sql`excluded.exchange_rate`,
            exchangeDifferenceBase: sql`excluded.exchange_difference_base`,
          },
        });
    }
  }

  console.log('Payments seeded');
}

/**
 * Recalcula `invoices.paid_amount` y el estado desde las imputaciones reales (`S-17` M-31).
 *
 * La semilla inserta pagos y notas de crédito directamente, sin pasar por los servicios que
 * mantienen la caché: la factura quedaba `POSTED` con saldo abierto aunque tuviera un cobro
 * imputado, o `PAID` con saldo negativo. Los borradores y las anuladas no se tocan.
 */
async function recalculateInvoiceBalances() {
  await db.execute(sql`
    update invoices i
       set paid_amount = s.paid,
           status = case
             when s.paid + s.retained + s.credited >= coalesce(i.total, 0) - 0.01 then 'PAID'
             when s.paid > 0.01 then 'PARTIAL'
             else 'POSTED'
           end,
           updated_at = now()
      from (
        select i2.id,
               (select coalesce(sum(pa.invoice_amount), 0)
                  from payment_allocations pa
                  join payments p on p.id = pa.payment_id
                 where pa.invoice_id = i2.id and p.status = 'POSTED') as paid,
               (select coalesce(sum(tr.total_retained), 0)
                  from tax_retentions tr
                 where tr.invoice_id = i2.id) as retained,
               (select coalesce(sum(cn.total), 0)
                  from credit_notes cn
                 where cn.invoice_id = i2.id and cn.type = 'SALE' and cn.status = 'POSTED') as credited
          from invoices i2
      ) s
     where i.id = s.id
       and i.status not in ('DRAFT', 'CANCELLED', 'VOID')
  `);
}

async function recalculateBankBalances() {
  const accounts = await db.select().from(bankAccounts);

  for (const account of accounts) {
    const [result] = await db
      .select({
        // Sólo cuentan los pagos en la moneda de la cuenta (`S-18`): el saldo de una cuenta en
        // divisa no puede incluir importes en bolívares ni al revés. El saldo inicial es la posición
        // con la que se abrió la cuenta, no un movimiento.
        movement: sql<string>`COALESCE(SUM(CASE
          WHEN ${payments.type} = 'INCOME' THEN ${payments.amount}
          WHEN ${payments.type} = 'EXPENSE' THEN -${payments.amount}
          ELSE 0
        END), 0)::numeric(20, 2)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.bankAccountId, account.id),
          eq(payments.status, 'POSTED'),
          eq(payments.currencyId, account.currencyId)
        )
      );

    const balance = Number(
      this_round(Number(account.initialBalance ?? 0) + Number(result.movement))
    );

    await db
      .update(bankAccounts)
      .set({ currentBalance: balance.toFixed(2) })
      .where(eq(bankAccounts.id, account.id));
  }
}

function this_round(value: number): string {
  return String(Math.round((value + Number.EPSILON) * 100) / 100);
}

/**
 * Primer paso del histórico de los documentos sembrados (`S-12`).
 *
 * Sin esto, una base recién sembrada muestra fichas con la línea de tiempo vacía: la migración
 * `0023` sólo rellenó las filas que existían cuando se aplicó.
 */
async function seedDocumentEvents() {
  console.log('Seeding document events...');

  await db.execute(sql`
    insert into document_events
      (id, document_type, document_id, document_code, parent_document_id, action, from_status, to_status, description, user_id, branch_id, created_at)
    select
      gen_random_uuid(), 'ORDER', o.id, o.code, null, 'ORDER_CREATED', null, o.status,
      'Registro previo al histórico', coalesce(o.user_id, ${IDs.userSeller}::uuid), o.branch_id, coalesce(o.date, now())
    from orders o
    where not exists (
      select 1 from document_events e where e.document_type = 'ORDER' and e.document_id = o.id
    )
  `);

  await db.execute(sql`
    insert into document_events
      (id, document_type, document_id, document_code, parent_document_id, action, from_status, to_status, description, user_id, branch_id, created_at)
    select
      gen_random_uuid(), 'INVOICE', i.id, i.code, i.order_id, 'INVOICE_CREATED', null, i.status,
      'Registro previo al histórico', coalesce(i.user_id, ${IDs.userSeller}::uuid), i.branch_id, coalesce(i.date, now())
    from invoices i
    where not exists (
      select 1 from document_events e where e.document_type = 'INVOICE' and e.document_id = i.id
    )
  `);

  // Las filas sembradas antes de este arreglo quedaron con el autor fijo (vendedor) aunque el
  // documento lo hubiera registrado otro usuario: se realinean con el autor del documento.
  await db.execute(sql`
    update document_events e
       set user_id = coalesce(o.user_id, e.user_id)
      from orders o
     where e.document_type = 'ORDER'
       and e.document_id = o.id
       and e.description = 'Registro previo al histórico'
       and e.user_id is distinct from coalesce(o.user_id, e.user_id)
  `);

  await db.execute(sql`
    update document_events e
       set user_id = coalesce(i.user_id, e.user_id)
      from invoices i
     where e.document_type = 'INVOICE'
       and e.document_id = i.id
       and e.description = 'Registro previo al histórico'
       and e.user_id is distinct from coalesce(i.user_id, e.user_id)
  `);

  console.log('Document events seeded');
}

async function validateTestData() {
  console.log('Validating test data integrity...');
  const userCount = await db.select().from(users);
  const partnerCount = await db.select().from(partners);
  const productCount = await db.select().from(products);
  const invoiceCount = await db.select().from(invoices);
  const paymentCount = await db.select().from(payments);

  console.log(`Validation summary:`);
  console.log(`  - Users: ${userCount.length}`);
  console.log(`  - Partners: ${partnerCount.length}`);
  console.log(`  - Products: ${productCount.length}`);
  console.log(`  - Invoices: ${invoiceCount.length}`);
  console.log(`  - Payments: ${paymentCount.length}`);

  if (userCount.length === 0) throw new Error('No users found after seeding');
  if (partnerCount.length === 0) throw new Error('No partners found after seeding');
  if (productCount.length === 0) throw new Error('No products found after seeding');

  // Gate real: si la semilla deja huérfanos o cuadres rotos, falla acá y no en la UI.
  await assertIntegrity();

  console.log('Test data validation passed!');
}
