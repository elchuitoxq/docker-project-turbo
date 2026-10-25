import { db } from '../index';
import {
  currencies,
  companies,
  banks,
  bankAccounts,
  paymentMethods,
  branches,
  users,
  usersRoles,
  usersBranches,
  roles,
  exchangeRates,
} from '../schema';
import { uuidv7 } from '../schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { seedRbac } from './seed-rbac';

export async function seedProdData() {
  console.log('Seeding production data...');

  await seedRbac();

  await seedCurrencies();
  await seedBanks();
  await seedPaymentMethods();
  await seedBranch();
  await seedSuperAdmin();

  console.log('Production data seeding completed successfully!');
}

async function seedCurrencies() {
  console.log('Seeding currencies...');

  await db.insert(currencies).values([
    {
      id: uuidv7(),
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      isBase: true,
    },
    {
      id: uuidv7(),
      code: 'VES',
      name: 'Venezuelan Bolivar',
      symbol: 'Bs',
      isBase: false,
    },
    {
      id: uuidv7(),
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      isBase: false,
    },
  ]).onConflictDoUpdate({
    target: currencies.code,
    set: { name: currencies.name, symbol: currencies.symbol },
  });

  const [usd] = await db.select().from(currencies).where(eq(currencies.code, 'USD')).limit(1);
  const [ves] = await db.select().from(currencies).where(eq(currencies.code, 'VES')).limit(1);

  if (usd && ves) {
    await db.insert(exchangeRates).values({
      currencyId: ves.id,
      rate: '36.50',
      source: 'MANUAL',
    }).onConflictDoNothing();
  }

  console.log('Currencies seeded: USD, VES, EUR');
}

async function seedBanks() {
  console.log('Seeding banks...');

  const bankData = [
    { name: 'Banco Provincial', code: '0108' },
    { name: 'Banesco', code: '0137' },
    { name: 'Banco Mercantil', code: '0105' },
    { name: 'Banco de Venezuela', code: '0102' },
    { name: 'Banco Exterior', code: '0115' },
    { name: 'Fondo Común', code: '0151' },
  ];

  for (const bank of bankData) {
    await db.insert(banks).values({
      id: uuidv7(),
      name: bank.name,
      code: bank.code,
      isActive: true,
    }).onConflictDoUpdate({
      target: banks.code,
      set: { name: bank.name, isActive: true },
    });
  }

  console.log(`Seeded ${bankData.length} banks`);
}

async function seedPaymentMethods() {
  console.log('Seeding payment methods...');

  const [usd] = await db.select().from(currencies).where(eq(currencies.code, 'USD')).limit(1);
  const [ves] = await db.select().from(currencies).where(eq(currencies.code, 'VES')).limit(1);

  const paymentMethodsData = [
    { name: 'Efectivo USD', code: 'CASH_USD', isDigital: false, currencyId: usd?.id },
    { name: 'Efectivo VES', code: 'CASH_VES', isDigital: false, currencyId: ves?.id },
    { name: 'Punto de Venta', code: 'POS', isDigital: false, currencyId: usd?.id },
    { name: 'Zelle', code: 'ZELLE', isDigital: true, currencyId: usd?.id },
    { name: 'Transferencia Bancaria', code: 'TRANSFER', isDigital: true, currencyId: null },
    { name: 'Pago Móvil', code: 'PAGO_MOVIL', isDigital: true, currencyId: ves?.id },
    { name: 'Divisa', code: 'FOREIGN_CURRENCY', isDigital: false, currencyId: usd?.id },
    { name: 'Cheque', code: 'CHECK', isDigital: false, currencyId: null },
  ];

  const [branch] = await db.select().from(branches).limit(1);

  for (const method of paymentMethodsData) {
    await db.insert(paymentMethods).values({
      id: uuidv7(),
      name: method.name,
      code: method.code,
      isDigital: method.isDigital,
      currencyId: method.currencyId,
      branchId: branch?.id,
    }).onConflictDoUpdate({
      target: [paymentMethods.code, paymentMethods.branchId],
      set: { name: method.name, isDigital: method.isDigital },
    });
  }

  console.log(`Seeded ${paymentMethodsData.length} payment methods`);
}

async function seedBranch() {
  console.log('Seeding default branch...');

  const [existingBranch] = await db.select().from(branches).limit(1);

  if (existingBranch) {
    console.log('Branch already exists, skipping...');
    return;
  }

  const [company] = await db
    .insert(companies)
    .values({
      id: uuidv7(),
      name: 'Empresa Principal',
      taxId: 'J-00000000-0',
      address: 'Caracas, Venezuela',
      phone: '+58 212 0000000',
      email: 'admin@empresa.local',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: companies.taxId,
      set: { name: 'Empresa Principal' },
    })
    .returning();

  await db.insert(branches).values({
    id: uuidv7(),
    companyId: company.id,
    name: 'Casa Matriz',
    address: 'Caracas, Venezuela',
    phone: '+58 212 0000000',
    email: 'admin@empresa.local',
    isActive: true,
  });

  console.log('Default branch seeded');
}

async function seedSuperAdmin() {
  console.log('Seeding super admin user...');

  const [adminRole] = await db.select().from(roles).where(eq(roles.name, 'ADMIN')).limit(1);
  const [superAdminRole] = await db.select().from(roles).where(eq(roles.name, 'SUPER_ADMIN')).limit(1);

  if (!adminRole) {
    console.error('ADMIN role not found, cannot create super admin');
    return;
  }

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, 'superadmin@empresa.local'))
    .limit(1);

  if (existingUser) {
    console.log('Super admin already exists, skipping...');
    return;
  }

  const passwordHash = bcrypt.hashSync('SuperAdmin123!', 10);

  const [superAdmin] = await db.insert(users).values({
    id: uuidv7(),
    name: 'Super Administrador',
    email: 'superadmin@empresa.local',
    password: passwordHash,
    refreshToken: null,
  }).returning();

  await db.insert(usersRoles).values({
    userId: superAdmin.id,
    roleId: superAdminRole?.id || adminRole.id,
  }).onConflictDoNothing();

  const [branch] = await db.select().from(branches).limit(1);
  if (branch) {
    await db.insert(usersBranches).values({
      userId: superAdmin.id,
      branchId: branch.id,
      isDefault: true,
    }).onConflictDoNothing();
  }

  console.log('Super admin user created: superadmin@empresa.local / SuperAdmin123!');
}

export async function resetProductionData() {
  console.log('Resetting production data...');

  await db.delete(exchangeRates);
  await db.delete(paymentMethods);
  await db.delete(bankAccounts);
  await db.delete(banks);
  await db.delete(usersBranches);
  await db.delete(usersRoles);
  await db.delete(users);
  await db.delete(branches);
  await db.delete(currencies);

  console.log('Production data reset completed!');
}