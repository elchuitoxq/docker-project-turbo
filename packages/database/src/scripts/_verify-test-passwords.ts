import { db } from '../index';
import { users } from '../schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

async function main() {
  const [admin] = await db.select().from(users).where(eq(users.email, 'test-admin@test.local'));
  const [seller] = await db.select().from(users).where(eq(users.email, 'test-seller@test.local'));

  if (!admin || !seller) {
    console.error('Users not found');
    process.exit(1);
  }

  const adminOk = await bcrypt.compare('Test1234!', admin.password);
  const sellerOk = await bcrypt.compare('Test1234!', seller.password);

  console.log(`admin@test.local: ${adminOk ? 'OK' : 'FAIL'}`);
  console.log(`seller@test.local: ${sellerOk ? 'OK' : 'FAIL'}`);

  process.exit(adminOk && sellerOk ? 0 : 1);
}

main();
