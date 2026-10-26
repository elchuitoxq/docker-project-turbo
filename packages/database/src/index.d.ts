import postgres from 'postgres';
declare const db: import('drizzle-orm/postgres-js').PostgresJsDatabase<Record<string, never>> & {
  $client: postgres.Sql<{}>;
};
export { db };
export { uuidv7 } from './schema';
export * from './schema';
//# sourceMappingURL=index.d.ts.map
