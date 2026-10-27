import { db } from '../index';
import {
  currencies,
  companies,
  branches,
  banks,
  paymentMethods,
  users,
  usersRoles,
  usersBranches,
  roles,
  bankAccounts,
} from '../schema';
import { uuidv7 } from '../schema';
import * as bcrypt from 'bcryptjs';
import { and, eq, ne, sql } from 'drizzle-orm';
import { seedPayrollCatalog } from './seed-payroll-catalog';

export async function seedCoreData() {
  console.log('Seeding core data...');

  // Moneda funcional = VES (decisión D-01). Se limpia cualquier otra base antes del
  // upsert para no violar el índice único parcial `currencies_one_base_idx`.
  await db
    .update(currencies)
    .set({ isBase: false })
    .where(and(eq(currencies.isBase, true), ne(currencies.code, 'VES')));

  const seededCurrencies = await db
    .insert(currencies)
    .values([
      {
        id: uuidv7(),
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        isBase: false,
      },
      {
        id: uuidv7(),
        code: 'VES',
        name: 'Venezuelan Bolivar',
        symbol: 'Bs',
        isBase: true,
      },
    ])
    .onConflictDoUpdate({
      target: currencies.code,
      set: { isBase: sql`excluded.is_base` },
    })
    .returning();
  const currencyMap = new Map(seededCurrencies.map(currency => [currency.code, currency]));
  const usd = currencyMap.get('USD');
  const ves = currencyMap.get('VES');
  if (!usd || !ves) {
    throw new Error('Unable to retrieve seeded currencies');
  }
  console.log(`Created currencies: ${[usd.code, ves.code].join(', ')}`);

  const [company] = await db
    .insert(companies)
    .values({
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Empresa Principal',
      taxId: 'J-000000000',
      address: 'Caracas, Venezuela',
      phone: '+58 212 0000000',
      email: 'info@empresa.com',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: companies.taxId,
      set: {
        name: 'Empresa Principal',
        taxId: 'J-000000000',
        address: 'Caracas, Venezuela',
        phone: '+58 212 0000000',
        email: 'info@empresa.com',
        isActive: true,
      },
    })
    .returning();

  const [branch] = await db
    .insert(branches)
    .values({
      id: '00000000-0000-4000-8000-000000000001',
      companyId: company.id,
      name: 'Casa Principal',
      address: 'Caracas, Venezuela',
      phone: '+58 212 0000000',
      email: 'info@empresa.com',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: branches.id,
      set: {
        name: 'Casa Principal',
        companyId: company.id,
        address: 'Caracas, Venezuela',
        phone: '+58 212 0000000',
        email: 'info@empresa.com',
        isActive: true,
      },
    })
    .returning();
  console.log(`Created branch: ${branch.name}`);

  const bankData = [
    { name: 'Banco Provincial', code: '0108' },
    { name: 'Banesco Banco Universal', code: '0134' },
    { name: 'Banco Mercantil', code: '0105' },
    { name: 'Banco de Venezuela', code: '0102' },
    { name: 'Banco Exterior', code: '0115' },
    { name: 'Banco Fondo Común', code: '0151' },
  ];

  await db
    .insert(banks)
    .values(
      bankData.map(bank => ({
        id: uuidv7(),
        name: bank.name,
        code: bank.code,
        isActive: true,
      }))
    )
    .onConflictDoUpdate({
      target: banks.code,
      set: { name: sql`excluded.name`, isActive: true },
    });
  console.log(`Created ${bankData.length} banks`);

  const paymentMethodData = [
    { name: 'Efectivo USD', code: 'CASH_USD', isDigital: false },
    { name: 'Efectivo VES', code: 'CASH_VES', isDigital: false },
    { name: 'Punto de Venta', code: 'POS', isDigital: false },
    { name: 'Zelle', code: 'ZELLE', isDigital: true },
    { name: 'Transferencia', code: 'TRANSFER', isDigital: true },
    { name: 'Retención IVA 75%', code: 'RET_IVA_75', isDigital: false },
    { name: 'Retención IVA 100%', code: 'RET_IVA_100', isDigital: false },
    { name: 'Retención ISLR', code: 'RET_ISLR', isDigital: false },
    { name: 'Cruce Saldo USD', code: 'BALANCE_USD', isDigital: false },
    { name: 'Cruce Saldo VES', code: 'BALANCE_VES', isDigital: false },
  ];

  await db
    .insert(paymentMethods)
    .values(
      paymentMethodData.map(pm => ({
        id: uuidv7(),
        name: pm.name,
        code: pm.code,
        isDigital: pm.isDigital,
        branchId: branch.id,
      }))
    )
    .onConflictDoUpdate({
      target: [paymentMethods.code, paymentMethods.branchId],
      set: { name: sql`excluded.name`, isDigital: sql`excluded.is_digital` },
    });
  console.log(`Created ${paymentMethodData.length} payment methods`);

  const bankAccountSeeds = [
    {
      name: 'Cuenta Principal USD',
      accountNumber: '0001-USD-MAIN',
      currencyId: usd.id,
    },
    {
      name: 'Cuenta Principal VES',
      accountNumber: '0001-VES-MAIN',
      currencyId: ves.id,
    },
  ];

  const existingAccounts = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.branchId, branch.id));
  const accountByNumber = new Map(
    existingAccounts.map(account => [account.accountNumber, account])
  );

  for (const acct of bankAccountSeeds) {
    const existing = accountByNumber.get(acct.accountNumber);
    if (existing) {
      await db
        .update(bankAccounts)
        .set({ name: acct.name, isActive: true })
        .where(eq(bankAccounts.id, existing.id));
      console.log(`Updated bank account: ${acct.name}`);
    } else {
      const [created] = await db
        .insert(bankAccounts)
        .values({
          id: uuidv7(),
          name: acct.name,
          accountNumber: acct.accountNumber,
          type: 'CHECKING',
          currencyId: acct.currencyId,
          branchId: branch.id,
          currentBalance: '0',
          isActive: true,
        })
        .returning();
      console.log(`Created bank account: ${created.name}`);
    }
  }

  const adminPassword = bcrypt.hashSync('admin123', 10);
  const sellerPassword = bcrypt.hashSync('seller123', 10);

  const seededUsers = await db
    .insert(users)
    .values([
      {
        id: uuidv7(),
        name: 'Admin User',
        email: 'admin@test.local',
        password: adminPassword,
        refreshToken: null,
      },
      {
        id: uuidv7(),
        name: 'Seller User',
        email: 'seller@test.local',
        password: sellerPassword,
        refreshToken: null,
      },
    ])
    .onConflictDoUpdate({
      target: users.email,
      set: { name: sql`excluded.name` },
    })
    .returning();
  const userMap = new Map(seededUsers.map(user => [user.email, user]));
  const seededAdmin = userMap.get('admin@test.local');
  const seededSeller = userMap.get('seller@test.local');
  if (!seededAdmin || !seededSeller) {
    throw new Error('Unable to retrieve seeded core users');
  }
  console.log(`Created users: ${seededAdmin.email}, ${seededSeller.email}`);

  const [adminRole] = await db.select().from(roles).where(eq(roles.name, 'ADMIN')).limit(1);
  const [sellerRole] = await db.select().from(roles).where(eq(roles.name, 'SELLER')).limit(1);

  if (adminRole && sellerRole) {
    await db
      .insert(usersRoles)
      .values([
        { userId: seededAdmin.id, roleId: adminRole.id },
        { userId: seededSeller.id, roleId: sellerRole.id },
      ])
      .onConflictDoNothing();
    await db
      .insert(usersBranches)
      .values([
        { userId: seededAdmin.id, branchId: branch.id },
        { userId: seededSeller.id, branchId: branch.id },
      ])
      .onConflictDoNothing();
    console.log('Assigned roles and branches to users');
  } else {
    console.warn('Roles ADMIN/SELLER not found; run seedRbac() first');
  }

  console.log('Core data seeding completed!');

  await seedPayrollCatalog(company.id);
}
