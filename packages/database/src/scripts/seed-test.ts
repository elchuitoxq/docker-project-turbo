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
  warehouses,
  stock,
  orders,
  orderItems,
  invoices,
  invoiceItems,
  payments,
  paymentAllocations,
  exchangeRates,
  departments,
  employees,
  accountingAccounts,
} from '../schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { seedRbac } from './seed-rbac';

const IDs = {
  usd: '00000000-0000-4000-8000-000000000001',
  ves: '00000000-0000-4000-8000-000000000002',
  exchangeRate: '00000000-0000-4000-8000-000000000003',
  branch1: '00000000-0000-4000-8000-000000000010',
  branch2: '00000000-0000-4000-8000-000000000011',
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
  emp: (i: number) => `00000000-0000-4000-8000-0000000005${i.toString().padStart(2, '0')}`,
  order: (i: number) => `00000000-0000-4000-8000-0000000006${i.toString().padStart(2, '0')}`,
  invoice: (i: number) => `00000000-0000-4000-8000-0000000007${i.toString().padStart(2, '0')}`,
  payment: (i: number) => `00000000-0000-4000-8000-0000000008${i.toString().padStart(2, '0')}`,
  dept1: '00000000-0000-4000-8000-000000000901',
  dept2: '00000000-0000-4000-8000-000000000902',
  acc1: '00000000-0000-4000-8000-000000000A01',
  acc2: '00000000-0000-4000-8000-000000000A02',
};

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
  await seedStock();
  await seedEmployees();
  await seedDepartments();
  await seedAccountingAccounts();
  await seedOrders();
  await seedInvoices();
  await seedPayments();
  await recalculateBankBalances();

  await validateTestData();

  console.log('Test data seeding completed successfully!');
}

async function seedCurrencies() {
  console.log('Seeding currencies...');

  await db
    .insert(currencies)
    .values([
      { id: IDs.usd, code: 'USD', name: 'US Dollar', symbol: '$', isBase: true },
      { id: IDs.ves, code: 'VES', name: 'Venezuelan Bolivar', symbol: 'Bs', isBase: false },
    ])
    .onConflictDoUpdate({
      target: currencies.code,
      set: { name: currencies.name, symbol: currencies.symbol },
    });

  await db
    .insert(exchangeRates)
    .values({
      id: IDs.exchangeRate,
      currencyId: IDs.ves,
      rate: '36.50',
      source: 'TEST',
    })
    .onConflictDoUpdate({
      target: exchangeRates.id,
      set: { rate: '36.50', source: 'TEST' },
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
        name: branches.name,
        companyId: branches.companyId,
        address: branches.address,
        phone: branches.phone,
        email: branches.email,
        isActive: branches.isActive,
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
    .onConflictDoUpdate({ target: warehouses.id, set: { name: warehouses.name } });

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
    .onConflictDoUpdate({ target: banks.code, set: { name: banks.name } });

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
        currencyId: IDs.usd,
        branchId: IDs.branch1,
      },
      {
        id: IDs.pm2,
        name: 'Efectivo VES',
        code: 'CASH_VES',
        isDigital: false,
        currencyId: IDs.ves,
        branchId: IDs.branch1,
      },
      {
        id: IDs.pm3,
        name: 'Punto de Venta',
        code: 'POS',
        isDigital: false,
        currencyId: IDs.usd,
        branchId: IDs.branch1,
      },
      {
        id: IDs.pm4,
        name: 'Transferencia',
        code: 'TRANSFER',
        isDigital: true,
        currencyId: IDs.usd,
        branchId: IDs.branch1,
      },
      {
        id: IDs.pm5,
        name: 'Zelle',
        code: 'ZELLE',
        isDigital: true,
        currencyId: IDs.usd,
        branchId: IDs.branch1,
      },
    ])
    .onConflictDoUpdate({
      target: [paymentMethods.code, paymentMethods.branchId],
      set: { name: paymentMethods.name },
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
        currencyId: IDs.usd,
        branchId: IDs.branch1,
        currentBalance: '0',
        isActive: true,
      },
      {
        id: IDs.accUsd2,
        name: 'Cuenta Corriente USD - Maracaibo',
        accountNumber: 'USD-002-123456',
        type: 'CHECKING',
        currencyId: IDs.usd,
        branchId: IDs.branch2,
        currentBalance: '0',
        isActive: true,
      },
      {
        id: IDs.accVes1,
        name: 'Cuenta Corriente VES - Caracas',
        accountNumber: 'VES-001-123456',
        type: 'CHECKING',
        currencyId: IDs.ves,
        branchId: IDs.branch1,
        currentBalance: '0',
        isActive: true,
      },
      {
        id: IDs.accVes2,
        name: 'Cuenta Corriente VES - Maracaibo',
        accountNumber: 'VES-002-123456',
        type: 'CHECKING',
        currencyId: IDs.ves,
        branchId: IDs.branch2,
        currentBalance: '0',
        isActive: true,
      },
    ])
    .onConflictDoUpdate({ target: bankAccounts.id, set: { name: bankAccounts.name } });

  console.log('Bank accounts seeded');
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
        hasBatches: false,
        currencyId: IDs.usd,
      })
      .onConflictDoUpdate({ target: products.sku, set: { name: product.name } });
  }

  console.log('Products seeded');
}

async function seedStock() {
  console.log('Seeding stock...');

  const stockData = [
    { warehouseId: IDs.warehouse1, productId: IDs.prod(0), quantity: '50' },
    { warehouseId: IDs.warehouse1, productId: IDs.prod(1), quantity: '30' },
    { warehouseId: IDs.warehouse1, productId: IDs.prod(2), quantity: '100' },
    { warehouseId: IDs.warehouse2, productId: IDs.prod(3), quantity: '500' },
    { warehouseId: IDs.warehouse2, productId: IDs.prod(4), quantity: '300' },
    { warehouseId: IDs.warehouse3, productId: IDs.prod(5), quantity: '25' },
    { warehouseId: IDs.warehouse3, productId: IDs.prod(6), quantity: '40' },
    { warehouseId: IDs.warehouse4, productId: IDs.prod(7), quantity: '60' },
    { warehouseId: IDs.warehouse4, productId: IDs.prod(8), quantity: '200' },
    { warehouseId: IDs.warehouse5, productId: IDs.prod(9), quantity: '35' },
  ];

  for (let i = 0; i < stockData.length; i++) {
    const stockItem = stockData[i];
    await db
      .insert(stock)
      .values({
        id: IDs.prod(i),
        warehouseId: stockItem.warehouseId,
        productId: stockItem.productId,
        batchId: null,
        quantity: stockItem.quantity,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  console.log('Stock seeded');
}

async function seedEmployees() {
  console.log('Seeding employees...');

  const employeesData = [
    { id: IDs.emp(0), firstName: 'Juan', lastName: 'García', identityCard: 'V-12345678' },
    { id: IDs.emp(1), firstName: 'María', lastName: 'Rodríguez', identityCard: 'V-23456789' },
    { id: IDs.emp(2), firstName: 'Carlos', lastName: 'Martínez', identityCard: 'V-34567890' },
    { id: IDs.emp(3), firstName: 'Ana', lastName: 'López', identityCard: 'V-45678901' },
    { id: IDs.emp(4), firstName: 'Luis', lastName: 'Hernández', identityCard: 'V-56789012' },
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
        positionId: null,
        departmentId: null,
        branchId: IDs.branch1,
        hireDate: new Date('2024-01-15'),
        terminationDate: null,
        terminationReason: null,
        salaryCurrencyId: IDs.usd,
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
      .onConflictDoUpdate({ target: employees.identityCard, set: { firstName: emp.firstName } });
  }

  console.log('Employees seeded');
}

async function seedDepartments() {
  console.log('Seeding departments...');

  await db
    .insert(departments)
    .values([
      { id: IDs.dept1, name: 'Ventas', branchId: IDs.branch1 },
      { id: IDs.dept2, name: 'Operaciones', branchId: IDs.branch1 },
    ])
    .onConflictDoNothing();

  console.log('Departments seeded');
}

async function seedAccountingAccounts() {
  console.log('Seeding accounting accounts...');

  await db
    .insert(accountingAccounts)
    .values([
      {
        id: IDs.acc1,
        code: '4-001',
        name: 'Gastos de Personal',
        type: 'EXPENSE',
        branchId: IDs.branch1,
        isActive: true,
      },
      {
        id: IDs.acc2,
        code: '4-002',
        name: 'Sueldos y Salarios',
        type: 'EXPENSE',
        branchId: IDs.branch1,
        isActive: true,
      },
    ])
    .onConflictDoUpdate({
      target: [accountingAccounts.code, accountingAccounts.branchId],
      set: { name: accountingAccounts.name },
    });

  console.log('Accounting accounts seeded');
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
        exchangeRate: '1',
        currencyId: IDs.usd,
        date: new Date(),
        userId: IDs.userSeller,
      })
      .onConflictDoUpdate({
        target: orders.code,
        set: { total: orders.total, status: order.status as any },
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
        currencyId: IDs.usd,
        exchangeRate: '1',
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
      .onConflictDoUpdate({ target: invoices.code, set: { total, status: invoice.status as any } });

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
      amount: '580.00',
      status: 'POSTED',
      type: 'INCOME',
    },
    {
      id: IDs.payment(1),
      code: 'PAY-000002',
      invoiceId: IDs.invoice(1),
      amount: '870.00',
      status: 'POSTED',
      type: 'INCOME',
    },
    {
      id: IDs.payment(2),
      code: 'PAY-000003',
      invoiceId: IDs.invoice(0),
      amount: '200.00',
      status: 'POSTED',
      type: 'INCOME',
    },
  ];

  for (let i = 0; i < paymentsData.length; i++) {
    const payment = paymentsData[i];
    await db
      .insert(payments)
      .values({
        id: payment.id,
        code: payment.code,
        invoiceId: payment.invoiceId,
        partnerId: IDs.partner1,
        branchId: IDs.branch1,
        methodId: IDs.pm1,
        status: payment.status as 'POSTED' | 'PENDING' | 'CANCELLED',
        type: payment.type as 'INCOME' | 'EXPENSE',
        amount: payment.amount,
        currencyId: IDs.usd,
        exchangeRate: '1',
        bankAccountId: IDs.accUsd1,
        reference: `REF-${payment.code}`,
        date: new Date(),
        userId: IDs.userSeller,
      })
      .onConflictDoUpdate({
        target: payments.code,
        set: { amount: payment.amount, status: payment.status as any },
      });

    if (payment.status === 'POSTED') {
      await db
        .insert(paymentAllocations)
        .values({
          id: `00000000-0000-4000-8000-00000002${i.toString().padStart(4, '0')}`,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          amount: payment.amount,
        })
        .onConflictDoNothing();
    }
  }

  console.log('Payments seeded');
}

async function recalculateBankBalances() {
  const accounts = await db.select().from(bankAccounts);

  for (const account of accounts) {
    const [result] = await db
      .select({
        balance: sql<string>`COALESCE(SUM(CASE
          WHEN ${payments.type} = 'INCOME' THEN ${payments.amount}
          WHEN ${payments.type} = 'EXPENSE' THEN -${payments.amount}
          ELSE 0
        END), 0)::numeric(20, 2)`,
      })
      .from(payments)
      .where(and(eq(payments.bankAccountId, account.id), eq(payments.status, 'POSTED')));

    await db
      .update(bankAccounts)
      .set({ currentBalance: result.balance })
      .where(eq(bankAccounts.id, account.id));
  }
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

  console.log('Test data validation passed!');
}
