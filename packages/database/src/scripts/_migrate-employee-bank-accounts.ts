import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), override: true });

import { db } from '../index';
import { employees, employeeBankAccounts, banks, currencies } from '../schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { faker } from '@faker-js/faker';

async function migrateEmployeeBankAccounts() {
  console.log('='.repeat(60));
  console.log('MIGRATION: Adding bank accounts to existing employees');
  console.log('='.repeat(60));

  const allBanks = await db.select().from(banks);
  if (allBanks.length === 0) {
    console.log('❌ No banks found. Please run seed-core first.');
    process.exit(1);
  }

  const [usd] = await db.select().from(currencies).where(eq(currencies.code, 'USD')).limit(1);
  const currencyId = usd?.id;

  const allEmployees = await db.select().from(employees);
  console.log(`Found ${allEmployees.length} employees to migrate`);

  let migrated = 0;
  let alreadyHasAccount = 0;

  for (const emp of allEmployees) {
    const existingBankAccounts = await db
      .select()
      .from(employeeBankAccounts)
      .where(eq(employeeBankAccounts.employeeId, emp.id));

    if (existingBankAccounts.length > 0) {
      alreadyHasAccount++;
      console.log(`   Employee ${emp.firstName} ${emp.lastName} already has bank account, skipping`);
      continue;
    }

    const bank = faker.helpers.arrayElement(allBanks);
    const accountNumber = `0${faker.string.numeric(3)}-${faker.string.numeric(4)}-${faker.string.numeric(4)}-${faker.string.numeric(2)}`;

    await db.insert(employeeBankAccounts).values({
      id: uuidv4(),
      employeeId: emp.id,
      bankId: bank.id,
      accountNumber: accountNumber,
      accountType: 'CHECKING',
      currencyId: currencyId,
      isPrimary: true,
      isActive: true,
    });

    migrated++;
    console.log(`   ✅ ${emp.firstName} ${emp.lastName}: ${bank.name} - ${accountNumber}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Already had accounts: ${alreadyHasAccount}`);
  console.log(`   Total: ${allEmployees.length}`);

  process.exit(0);
}

migrateEmployeeBankAccounts();
