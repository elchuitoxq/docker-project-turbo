import * as bcrypt from 'bcryptjs';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const rows =
    await sql`SELECT email, password FROM users WHERE email IN ('admin@test.local', 'seller@test.local') ORDER BY email`;

  for (const row of rows) {
    const expected = row.email === 'admin@test.local' ? 'admin123' : 'seller123';
    const wrong = 'wrongpassword';
    const okMatch = await bcrypt.compare(expected, row.password);
    const okMismatch = await bcrypt.compare(wrong, row.password);
    console.log(
      `${row.email}: correct password matches=${okMatch}, wrong password matches=${okMismatch}, hash_prefix=${row.password.substring(0, 7)}`
    );
  }
  await sql.end();
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
