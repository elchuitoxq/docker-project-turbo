import { db } from '../index';
import { seedRbac } from './seed-rbac';
import { seedCoreData } from './seed-core';
import { uuidv7 } from '../schema';
import { eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import {
  partners,
  products,
  warehouses,
  productCategories,
  employees,
  employeeBankAccounts,
  departments,
  jobPositions,
  payrollSettings,
  payrollConceptTypes,
  exchangeRates,
  currencies,
  branches,
  stock,
  banks,
} from '../schema';

interface SeedOptions {
  partnersCount?: number;
  productsCount?: number;
  employeesCount?: number;
}

export async function seedFaker(options: SeedOptions = {}) {
  const { partnersCount = 50, productsCount = 200, employeesCount = 25 } = options;

  console.log('Seeding with faker data...');
  console.log(
    `Targets: ${partnersCount} partners, ${productsCount} products, ${employeesCount} employees`
  );

  await seedRbac();
  await seedCoreData();

  const [usd] = await db.select().from(currencies).where(eq(currencies.code, 'USD')).limit(1);
  const [ves] = await db.select().from(currencies).where(eq(currencies.code, 'VES')).limit(1);
  const [branch] = await db.select().from(branches).limit(1);
  const [warehouse] = await db
    .insert(warehouses)
    .values({ branchId: branch.id, name: 'Almacén Principal' })
    .returning();

  await db.insert(exchangeRates).values({ currencyId: ves.id, rate: '50.00', source: 'MANUAL' });

  const partnerTypes = ['CUSTOMER', 'SUPPLIER', 'BOTH'] as const;
  const taxpayerTypes = ['ORDINARY', 'SPECIAL'] as const;

  console.log('Creating partners...');
  for (let i = 0; i < partnersCount; i++) {
    await db.insert(partners).values({
      id: uuidv7(),
      name: faker.company.name(),
      email: faker.internet.email().toLowerCase(),
      taxId: `J-${faker.string.numeric(9)}`,
      address: faker.location.streetAddress({ useFullAddress: true }),
      phone: faker.phone.number(),
      type: faker.helpers.arrayElement(partnerTypes),
      taxpayerType: faker.helpers.arrayElement(taxpayerTypes),
      retentionRate: faker.number.int({ min: 0, max: 2 }).toString(),
      isSpecialTaxpayer: faker.datatype.boolean({ probability: 0.2 }),
      creditLimit: faker.number.int({ min: 0, max: 100000 }).toFixed(2),
    });
  }
  console.log(`Created ${partnersCount} partners`);

  const [catGeneral] = await db.insert(productCategories).values({ name: 'General' }).returning();
  const [catElectronics] = await db
    .insert(productCategories)
    .values({ name: 'Electrónica', parentId: catGeneral.id })
    .returning();
  const [catFood] = await db
    .insert(productCategories)
    .values({ name: 'Alimentos', parentId: catGeneral.id })
    .returning();

  console.log('Creating products...');
  const productIds: string[] = [];
  for (let i = 0; i < productsCount; i++) {
    const cost = faker.number.int({ min: 10, max: 500 });
    const price = Math.round(cost * 1.5 * 100) / 100;
    const [product] = await db
      .insert(products)
      .values({
        id: uuidv7(),
        sku: `SKU-${faker.string.alphanumeric({ length: 8, casing: 'upper' })}`,
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        categoryId: faker.helpers.arrayElement([catGeneral.id, catElectronics.id, catFood.id]),
        cost: cost.toFixed(2),
        price: price.toFixed(2),
        isExempt: faker.datatype.boolean({ probability: 0.1 }),
        taxRate: '16.00',
        type: 'PHYSICAL',
        minStock: faker.number.int({ min: 0, max: 50 }).toString(),
        hasBatches: faker.datatype.boolean({ probability: 0.3 }),
        currencyId: usd.id,
      })
      .returning();
    productIds.push(product.id);
  }
  console.log(`Created ${productsCount} products`);

  console.log('Creating stock rows...');
  for (const productId of productIds) {
    await db
      .insert(stock)
      .values({
        warehouseId: warehouse.id,
        productId,
        batchId: null,
        quantity: faker.number.int({ min: 0, max: 500 }).toString(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [stock.warehouseId, stock.productId, stock.batchId],
        set: {
          quantity: faker.number.int({ min: 0, max: 500 }).toString(),
          updatedAt: new Date(),
        },
      });
  }
  console.log(`Created ${productIds.length} stock rows`);

  const [deptVentas] = await db
    .insert(departments)
    .values({ branchId: branch.id, name: 'Ventas' })
    .returning();
  const [deptAlmacen] = await db
    .insert(departments)
    .values({ branchId: branch.id, name: 'Almacén' })
    .returning();
  const [deptAdmin] = await db
    .insert(departments)
    .values({ branchId: branch.id, name: 'Administración' })
    .returning();

  const positions = [
    { name: 'Gerente General', salaryMin: 2000, salaryMax: 5000 },
    { name: 'Vendedor', salaryMin: 500, salaryMax: 1500 },
    { name: 'Almacenero', salaryMin: 400, salaryMax: 800 },
    { name: 'Contador', salaryMin: 800, salaryMax: 2000 },
    { name: 'Auxiliar', salaryMin: 350, salaryMax: 600 },
  ];

  const positionIds: string[] = [];
  for (const pos of positions) {
    const [p] = await db
      .insert(jobPositions)
      .values({
        name: pos.name,
        currencyId: usd.id,
        baseSalaryMin: String(pos.salaryMin),
        baseSalaryMax: String(pos.salaryMax),
      })
      .returning();
    positionIds.push(p.id);
  }

  const allBanks = await db.select().from(banks);
  console.log(`   Found ${allBanks.length} banks for employee accounts`);

  console.log('Creating employees...');
  for (let i = 0; i < employeesCount; i++) {
    const positionId = faker.helpers.arrayElement(positionIds);
    const deptId = faker.helpers.arrayElement([deptVentas.id, deptAlmacen.id, deptAdmin.id]);
    const baseSalary = faker.number.int({ min: 500, max: 2500 }).toFixed(2);
    const bank = allBanks.length > 0 ? faker.helpers.arrayElement(allBanks) : null;
    const accountNumber = `0${faker.string.numeric(3)}-${faker.string.numeric(4)}-${faker.string.numeric(4)}-${faker.string.numeric(2)}`;

    const [newEmployee] = await db
      .insert(employees)
      .values({
        id: uuidv7(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        identityCard: `V-${faker.string.numeric(8)}`,
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.number(),
        positionId,
        departmentId: deptId,
        branchId: branch.id,
        baseSalary,
        salaryCurrencyId: usd.id,
        payFrequency: 'BIWEEKLY',
        paymentMethod: 'BANK_TRANSFER',
        bankId: bank?.id,
        accountNumber: accountNumber,
        status: 'ACTIVE',
      })
      .returning();

    if (bank) {
      await db.insert(employeeBankAccounts).values({
        id: uuidv7(),
        employeeId: newEmployee.id,
        bankId: bank.id,
        accountNumber: accountNumber,
        accountType: 'CHECKING',
        currencyId: usd.id,
        isPrimary: true,
        isActive: true,
      });
    }
  }
  console.log(`Created ${employeesCount} employees with bank accounts`);

  const payrollSettingData = [
    { key: 'CESTATICKET_USD', label: 'Cestaticket USD', value: '40.00', type: 'FIXED_USD' },
    { key: 'SSO_EMP', label: 'SSO Empleado', value: '4', type: 'PERCENTAGE' },
    { key: 'SSO_PAT', label: 'SSO Patronal', value: '10', type: 'PERCENTAGE' },
    { key: 'FAOV_EMP', label: 'FAOV Empleado', value: '1', type: 'PERCENTAGE' },
    { key: 'FAOV_PAT', label: 'FAOV Patronal', value: '2', type: 'PERCENTAGE' },
    { key: 'PIE_EMP', label: 'PIE Empleado', value: '0.5', type: 'PERCENTAGE' },
    { key: 'PIE_PAT', label: 'PIE Patronal', value: '2', type: 'PERCENTAGE' },
  ];

  for (const setting of payrollSettingData) {
    await db
      .insert(payrollSettings)
      .values({
        id: uuidv7(),
        key: setting.key,
        label: setting.label,
        value: setting.value,
        type: setting.type,
        branchId: branch.id,
        isActive: true,
      })
      .onConflictDoUpdate({ target: payrollSettings.key, set: { value: setting.value } });
  }
  console.log('Created payroll settings');

  const conceptTypes = [
    { code: 'EXTRA_HOUR', name: 'Horas Extra', category: 'INCOME' },
    { code: 'LATE', name: 'Llegadas Tardes', category: 'DEDUCTION' },
    { code: 'ABSENCE', name: 'Ausencias', category: 'DEDUCTION' },
    { code: 'BONUS', name: 'Bono', category: 'INCOME' },
  ];

  for (const ct of conceptTypes) {
    await db
      .insert(payrollConceptTypes)
      .values({
        id: uuidv7(),
        code: ct.code,
        name: ct.name,
        category: ct.category,
        isSystem: false,
        branchId: branch.id,
      })
      .onConflictDoUpdate({ target: payrollConceptTypes.code, set: { name: ct.name } });
  }
  console.log('Created payroll concept types');

  console.log('Faker seeding completed!');
}
