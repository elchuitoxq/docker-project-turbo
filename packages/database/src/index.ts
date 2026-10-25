import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(queryClient);

export async function closeDatabase() {
  await queryClient.end();
}

export { db };
export { uuidv7 } from './schema';
export * from './schema';
