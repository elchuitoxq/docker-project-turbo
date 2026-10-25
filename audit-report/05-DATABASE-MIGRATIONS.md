# DATABASE MIGRATIONS - DRIZZLE

## 1. Configuración Drizzle

```typescript
// packages/db/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Esquema de Configuración

```json
{
  "dialect": "postgresql",
  "schema": "./src/schema.ts",
  "out": "./drizzle",
  "breakpoints": true
}
```

---

## 2. Comandos de Migración

```bash
# Generar migración (crea SQL)
npm run db:generate -w @repo/db

# Push schema directly (sin migración, para dev)
npm run db:push -w @repo/db

# Apply migraciones (production)
npm run db:migrate -w @repo/db

# Studio visual (dev)
npm run db:studio -w @repo/db

# Reset completo (⚠️ BORRA TODO)
npm run db:reset -w @repo/db
```

---

## 3. Estructura de Migraciones

```
packages/db/
├── drizzle/
│   ├── _journal.json           # Control de versiones
│   ├── 0000_moaning_northstar.sql
│   ├── 0001_flash_thor.sql
│   └── meta/
│       ├── _journal.json
│       └── 0000_snapshot.json
└── drizzle.config.ts
```

---

## 4. Journal (_journal.json)

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "5",
      "dialect": "postgresql",
      "descriptions": [
        {
          "fromFeatures": {
            "emulatedDatabase": "postgres"
          },
          "collation": "default",
          "schema": "",
          "table": "audit_logs"
        }
      ],
      "checksum": "xxxx",
      "beforeStartState": "0000_sensible_quirrel.sql",
      "afterEndState": "0001_fantastic_x-man.sql"
    }
  ]
}
```

---

## 5. Ejemplo de Migración SQL

```sql
-- 0000_moaning_northstar.sql
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_table" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "action" text NOT NULL,
  "changes" jsonb,
  "user_id" uuid,
  "ip_address" text,
  "user_agent" text,
  "document_code" text,
  "document_status" text,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "description" text,
  "module" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_unique" ON "permissions" ("code");

-- ... más tablas
```

---

## 6. Meta Snapshots

```json
// drizzle/meta/0000_snapshot.json
{
  "version": "5",
  "dialect": "postgresql",
  "id": "00000000-0000-0000-0000-000000000000",
  "prevId": "00000000-0000-0000-0000-000000000000",
  "tables": {
    "audit_logs": {
      "name": "audit_logs",
      "columns": {
        "id": { "name": "id", "type": "uuid", "primaryKey": true },
        // ...
      }
    }
  },
  "enums": {},
  "schemas": {},
  "_meta": {
    "columns": {}
  }
}
```

---

## 7. Setup Completo (db:setup)

```bash
# Comando en package.json raíz
npm run db:setup:test

# Que ejecuta:
# 1. Reset DB
# 2. Push Schema (drizzle-kit push)
# 3. Run seed-test.ts
# 4. Run seed:transactions
```

### scripts/db.ts

```typescript
// packages/db/scripts/db.ts
import { db, client } from '../src';
import { resetDatabase } from './reset';
import { seedTest } from './seed-test';
import { seedTransactions } from './seed-transactions';

async function main() {
  console.log('Starting database setup...');
  
  await resetDatabase();
  console.log('✓ Database reset');
  
  await seedTest();
  console.log('✓ Test data seeded');
  
  await seedTransactions();
  console.log('✓ Transactions seeded');
  
  console.log('✓ Database setup complete');
  await client.end();
}

main().catch(console.error);
```

---

## 8. Reset Database

```typescript
// packages/db/scripts/reset.ts
export async function resetDatabase() {
  // Desconectar clientes existentes
  await client.end();
  
  // Drop all tables
  await sql`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `;
}
```

---

## 9. Seed Transactions

```typescript
// packages/db/scripts/seed-transactions.ts
// Scripts adicionales para crear transactions después del seed base
// Principalmente payments que dependen de lógica de treasury

export async function seedTransactions() {
  // 1. Obtener data del seed base
  const partners = await db.query.partners.findMany();
  const bankAccounts = await db.query.bankAccounts.findMany();
  
  // 2. Generar payments aleatorios
  for (const partner of partners) {
    // Crear payment si aplica
  }
  
  // 3. Actualizar saldos de bancos
  // ⚠️ IMPORTANTE: L7.5 step
  await recalculateBankBalances();
}
```

---

## 10. Drizzle Studio

```bash
npm run db:studio -w @repo/db
# Abre http://localhost:4983
```

### Características
- Visualizar tablas
- Editar datos
- Ver relaciones
- Ejecutar queries

---

## 11. Migración en Producción

```bash
# Build la imagen
docker build -t erp-api .

# Run migraciones antes de iniciar API
docker-compose run --rm scripts npm run db:migrate -w @repo/db

# Iniciar API
docker-compose up -d api
```

### docker-compose.yml (production)

```yaml
services:
  api:
    depends_on:
      postgres:
        condition: service_healthy
    command: sh -c "npm run db:migrate -w @repo/db && npm run start"
```

---

## 12. Troubleshooting

### Connection Refused

```bash
# Verificar postgres está corriendo
docker-compose logs postgres

# Verificar DATABASE_URL
echo $DATABASE_URL
```

### Migration Failed

```bash
# Ver logs
docker-compose logs scripts

# Puede requerir reset
docker-compose run --rm scripts npm run db:push -w @repo/db --force
```

### Studio Connection

```bash
# Verificar puerto
docker-compose port db_studio 4983

# Verificar credenciales
# Default: postgres://postgres:postgres@localhost:5432/postgres
```

---

## 13. Best Practices

### Development
- Usar `db:push` para rápido feedback
- Regenerar migración al hacer cambios

### Production
- Usar `db:migrate` para aplicar cambios
- Mantener backups antes de migrar
- Testear migración en staging primero

### En Docker
- Esperar a que postgres esté healthy
- Usar scripts dedicated para migraciones
- No ejecutar seed en producción
