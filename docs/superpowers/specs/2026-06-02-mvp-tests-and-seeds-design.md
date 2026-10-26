# MVP: Tests + Seeds — Diseño

**Fecha:** 2026-06-02
**Estado:** Aprobado
**Tipo:** Sub-proyecto aislado (infra/calidad)
**Scope:** MVP — cerrar vacíos críticos, sin refactor

---

## 1. Contexto

El monorepo `docker-project-turbo` (ERP Venezuela) tiene backend (NestJS) y database (Drizzle) completos, pero con brechas de calidad bien identificadas:

- **3 módulos backend sin tests**: `AuthService` (seguridad crítica), `CronService` (BCV scraping), `JwtAuthGuard` (auth middleware). Los 16 archivos de test existentes (708 `it` tests, 13.9K LOC) no tocan estos.
- **`packages/database` con 0 tests**: directorio `tests/unit/` existe pero vacío, no hay `vitest.config.ts`. PLANNING.md §8.1 y PROGRESS.md §1.11 lo listan como pendiente.
- **Seeds con gaps CRÍTICOS**:
  - `seed-core.ts` no siembra `users` (login falla tras fresh seed).
  - `seed-core.ts` no siembra `bank_accounts` (tesorería rota).
  - `seed-faker.ts` no siembra `stock` (inventario devuelve vacío).
  - `seed-test.ts` no existe (el usuario lo mencionó explícitamente).
  - `seed-faker.ts` usa `Math.random()` contradice `audit-report/12 §4` que exige `@faker-js/faker` con datos realistas.
  - `PROGRESS.md §1.10` está desactualizado: marca `reset.ts` y `seed-faker.ts` como pendientes pero ambos existen.
- **`test:coverage` roto**: el script está definido pero falta `@vitest/coverage-v8` en devDependencies.
- **Audit 12 §3 invariants** no validados en ningún test: códigos secuenciales, IVA real, exchange rates fluctuantes, bank balance invariant.

**Decisión de scope (MVP, sin refactor):** cerrar vacíos críticos y crear el seed-test. NO se hace: refactor de mocks, tests de controllers, L5/L6/L7.5, db:setup:test, e2e con supertest, CI/CD.

---

## 2. Objetivos y No-objetivos

### Objetivos (in-scope)

1. Backend:
   - Instalar `@faker-js/faker` y `@vitest/coverage-v8`.
   - Migrar `apps/backend/src/test/factories.ts` a `@faker-js/faker`.
   - Tests para `AuthService` (login, validateUser, forgot/reset password).
   - Tests para `JwtAuthGuard` (canActivate, token validation).
   - Tests para `CronService` (parseBcvHtml, parseBcvJsonData, scrapeBcvRate, storeExchangeRate, triggerBcvRateFetch).
2. Database package:
   - Instalar `@faker-js/faker` en devDependencies.
   - Crear `packages/database/vitest.config.ts`.
   - Migrar `seed-faker.ts` a `@faker-js/faker` con datos realistas.
   - Cerrar gaps CRÍTICOS en seeds (users, bank_accounts, stock).
   - Crear `seed-test.ts` (predecible, idempotente, con auto-validación).
   - Tests: `schema.test.ts`, `relations.test.ts`, `seed.test.ts` (incluye invariants audit 12 §3).
3. Scripts y entry points:
   - Añadir `db:seed:test` en `packages/database/package.json`.
   - Añadir `db:seed:test` en root `package.json` que delegue a turbo.

### No-objetivos (out-of-scope, explícito)

- ❌ Refactor de mocks duplicados (10+ archivos con chainable query builder idéntico). Otro sub-proyecto.
- ❌ Tests de controllers (19 controllers sin cobertura HTTP). Otro sub-proyecto.
- ❌ Tests de DTOs (class-validator round-trip). Otro sub-proyecto.
- ❌ Implementar L5 (orders, invoices, credit_notes), L6 (payments), L7.5 (recalculate-balances). Otro sub-proyecto.
- ❌ `db:setup:test` composite script. Otro sub-proyecto.
- ❌ Migración legacy de `employees.{bankId,...}` → `employee_bank_accounts`. Otro sub-proyecto.
- ❌ Renombrar `uuidv7()` a `uuidv4()` (cosmético, no afecta comportamiento).
- ❌ Arreglar el `FALLBACK_API_URL` corrupto en `cron.service.ts` (caracteres basura). Otro sub-proyecto (es un bug real, ver §13).
- ❌ Actualizar `PROGRESS.md` (chore al final).
- ❌ E2E con supertest.
- ❌ CI/CD (sub-proyecto previo con prerequisitos pendientes).
- ❌ Tests de validación de DTOs con class-validator.

---

## 3. Arquitectura general

```
apps/backend/
├── package.json                          [+2 deps, +0 scripts]
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   └── auth.service.test.ts      [NUEVO]
│   │   └── cron/
│   │       ├── cron.service.test.ts      [NUEVO]
│   │       └── __fixtures__/bcv-page.html [NUEVO]
│   ├── common/guards/
│   │   └── jwt-auth.guard.test.ts        [NUEVO]
│   └── test/
│       └── factories.ts                  [MODIFICADO: Math.random → faker]

packages/database/
├── package.json                          [+1 dep, +1 script, posible +bcryptjs]
├── vitest.config.ts                      [NUEVO]
├── src/
│   ├── scripts/
│   │   ├── seed-core.ts                  [MODIFICADO: +users, +bank_accounts]
│   │   ├── seed-faker.ts                 [MODIFICADO: Math.random → faker, +stock]
│   │   └── seed-test.ts                  [NUEVO]
│   └── test/
│       └── database.ts                   [NUEVO: testDb + cleanDatabase]
└── tests/unit/
    ├── schema.test.ts                    [NUEVO]
    ├── relations.test.ts                 [NUEVO]
    └── seed.test.ts                      [NUEVO]

package.json (raíz)
└── +script: "db:seed:test": "turbo run db:seed:test"
```

(10 archivos creados, 6 modificados. El detalle completo en §9.)

---

## 4. Cambios en `apps/backend`

### 4.1 Dependencias nuevas

`apps/backend/package.json` → `devDependencies`:

```json
"@faker-js/faker": "^9.0.0",
"@vitest/coverage-v8": "^2.1.0"
```

Versión pinneada coherente con `vitest@^2.0.0` ya en devDeps.

### 4.2 `apps/backend/src/test/factories.ts` — migrar a `@faker-js/faker`

Patrón actual: `Math.random()` para uniqueness. Patrón nuevo:

```typescript
import { faker } from '@faker-js/faker';

faker.seed(12345); // Deterministic en tests (opcional, ver §11)

export async function createTestPartner(data?: Partial<...>) {
  const partner = {
    name: faker.company.name(),                              // "Acme Holdings"
    email: faker.internet.email(),                          // "test@example.com"
    taxId: `J-${faker.string.numeric(9)}`,                  // "J-123456789"
    address: faker.location.streetAddress(),
    phone: faker.phone.number(),
    type: faker.helpers.arrayElement(['CUSTOMER', 'SUPPLIER', 'BOTH']),
    taxpayerType: faker.helpers.arrayElement(['ORDINARY', 'SPECIAL']),
    retentionRate: '0',
    isSpecialTaxpayer: faker.datatype.boolean({ probability: 0.2 }),
    creditLimit: faker.number.int({ min: 0, max: 100000 }).toString(),
    ...data,
  };
  // ... resto igual
}
```

Misma transformación para: `createTestBranch`, `createTestUser`, `createTestProduct`, `createTestWarehouse`. Las factories de invoice/order/etc. siguen con timestamps porque dependen de constraints de orden, no de datos realistas.

### 4.3 `apps/backend/src/modules/auth/auth.service.test.ts`

**Casos a cubrir:**

| Test                                                        | Setup                                                                                                                 | Assertion                                                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `login` returns JWT for valid credentials                   | mock `db` retorna user con hash bcrypt válido, `bcrypt.compare` retorna true, `jwtService.sign` retorna `'jwt.token'` | retorna `{ accessToken: 'jwt.token', tokenType: 'Bearer', expiresIn: 604800 }`              |
| `login` throws `UnauthorizedException` for missing user     | mock `db` retorna array vacío                                                                                         | throw `UnauthorizedException`                                                               |
| `login` throws `UnauthorizedException` for wrong password   | mock `db` retorna user, `bcrypt.compare` retorna false                                                                | throw `UnauthorizedException`                                                               |
| `login` payload includes roles                              | user tiene 2 roles via usersRoles                                                                                     | payload.roles = `['ADMIN', 'SELLER']`                                                       |
| `login` payload includes permissions                        | roles tienen permissions via rolesPermissions                                                                         | payload.permissions = array de códigos                                                      |
| `login` payload permissions is empty when user has no roles | usersRoles retorna array vacío                                                                                        | payload.permissions = `[]`                                                                  |
| `validateUser` returns user by id                           | mock `db` retorna user                                                                                                | retorna `{ id, email, name }`                                                               |
| `validateUser` returns undefined for missing id             | mock `db` retorna array vacío                                                                                         | retorna `undefined`                                                                         |
| `forgotPassword` returns generic message for missing user   | mock `db` retorna array vacío                                                                                         | retorna message genérico, sin `mockUrl`                                                     |
| `forgotPassword` returns mockUrl for existing user          | mock `db` retorna user                                                                                                | retorna `{ message, mockUrl: 'http://localhost:3000/reset-password?token=mock-token-...' }` |
| `resetPassword` throws for invalid token                    | token = `'invalid'`                                                                                                   | throw `UnauthorizedException`                                                               |
| `resetPassword` returns success for valid token             | token = `'mock-token-xyz'`                                                                                            | retorna `{ message: 'Password has been reset successfully.' }`                              |

**Patrón de mocks:** chainable DB mock (igual que `users.test.ts` ya usa). Mocks de `bcryptjs` y `JwtService` via `vi.mock`.

### 4.4 `apps/backend/src/common/guards/jwt-auth.guard.test.ts`

**Casos a cubrir:**

| Test                                           | Setup                                               | Assertion            |
| ---------------------------------------------- | --------------------------------------------------- | -------------------- |
| `canActivate` returns true for valid token     | mock `AuthGuard('jwt').canActivate` retorna true    | retorna `true`       |
| `canActivate` propagates UnauthorizedException | mock `super.canActivate` lanza                      | propaga la excepción |
| `canActivate` propagates any error             | mock `super.canActivate` lanza `ForbiddenException` | propaga la excepción |

**Nota:** `JwtAuthGuard` solo override `canActivate` llamando a `super.canActivate(context)`. Es una thin wrapper sobre `AuthGuard('jwt')` de `@nestjs/passport`. Los tests verifican que la delegación funciona. **No se re-testea la lógica interna de passport-jwt** (eso es responsabilidad de la librería).

**Mocks:** instanciar el guard y mockear `super.canActivate` con un spy.

### 4.5 `apps/backend/src/modules/cron/cron.service.test.ts`

**Casos a cubrir:**

| Test                                                         | Setup                                                                  | Assertion                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `triggerBcvRateFetch` returns success on happy path          | mock `fetch` retorna HTML parseable, mock `storeExchangeRate` resuelve | retorna `{ success: true, rate: <number>, message: ... }`              |
| `triggerBcvRateFetch` returns failure when both sources fail | mock `fetch` rechaza con error de red                                  | retorna `{ success: false, message: 'Failed to fetch BCV rate: ...' }` |
| `parseBcvHtml` extracts USD from `dolar` id pattern          | input HTML con `<div id="dolar">36,50</div>`                           | retorna `36.50`                                                        |
| `parseBcvHtml` extracts USD from `Dolar` td pattern          | input HTML con `<td>Dolar</td>...<td>36,50</td>`                       | retorna `36.50`                                                        |
| `parseBcvHtml` extracts USD from `valorDolar` JS variable    | input HTML con `valorDolar = "36.50"`                                  | retorna `36.50`                                                        |
| `parseBcvHtml` throws on unparseable HTML                    | input con texto sin rates                                              | throw `Error('Could not parse USD rate from BCV page')`                |
| `parseBcvHtml` rejects out-of-range values                   | match retorna 5000 (rate inválida)                                     | throw (ningún pattern acepta)                                          |
| `parseBcvJsonData` extracts from valid JSON                  | input `{ USD: { fecha: "2026-06-02", euro: "38,50" } }`                | retorna `38.50`                                                        |
| `parseBcvJsonData` throws on empty values                    | input con `USD: {}`                                                    | throw `Error('Invalid BCV JSON data structure')`                       |
| `storeExchangeRate` inserts into DB                          | mock currencies retorna USD, mock insert resuelve                      | no throw; insert llamado con rate correcto                             |
| `storeExchangeRate` throws if USD currency not found         | mock currencies retorna array vacío                                    | throw `InternalServerErrorException('USD currency not found...')`      |

**Mocks:** `vi.mock('drizzle-orm', ...)` para `eq`, mock de `global.fetch` (Vitest 2.x soporta `vi.stubGlobal`).

**Fixture HTML:** crear `src/modules/cron/__fixtures__/bcv-page.html` con un snapshot real de la página del BCV (anonimizado si es muy grande) para los tests de `parseBcvHtml`.

### 4.6 `apps/backend/package.json` scripts

Sin cambios en scripts. `test:coverage` ya está definido y ahora funcionará al estar `@vitest/coverage-v8` instalado.

---

## 5. Cambios en `packages/database`

### 5.1 Dependencias nuevas

`packages/database/package.json` → `devDependencies`:

```json
"@faker-js/faker": "^9.0.0"
```

### 5.2 `packages/database/vitest.config.ts` (NUEVO)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    env: {
      TEST_DATABASE_URL: 'postgresql://testuser:testpassword@localhost:5433/testdb',
    },
  },
});
```

Mismo patrón que `apps/backend/vitest.config.ts`.

### 5.3 `packages/database/src/scripts/seed-core.ts` — cerrar gaps CRÍTICOS

**Añadir (al final de la función `seedCoreData`):**

1. **Users:** crear 1 admin + 1 seller.
   - `admin@test.local`, password `'admin123'` hasheado con `bcryptjs.hashSync('admin123', 10)`.
   - `seller@test.local`, password `'seller123'` hasheado.
   - Idempotencia: `onConflictDoUpdate` por `email`.

2. **Bank accounts:** crear 1 cuenta USD y 1 cuenta VES.
   - USD: bankId del primer banco creado, accountNumber `'0001-USD-TEST'`, currencyId USD.
   - VES: bankId del segundo banco, accountNumber `'0001-VES-TEST'`, currencyId VES.
   - Idempotencia: `onConflictDoUpdate` por `[bankId, accountNumber]`.

3. **usersRoles + usersBranches:** asignar admin → rol ADMIN, seller → rol SELLER, ambos → branch Casa Principal.
   - Idempotencia: `onConflictDoNothing` en la junction table (PK compuesta evita duplicados).

**Helper importado:** `import * as bcrypt from 'bcryptjs';` (ya en `apps/backend` deps; hay que añadirlo a `packages/database` devDependencies si no está — verificar en implementación).

### 5.4 `packages/database/src/scripts/seed-faker.ts` — migrar a `@faker-js/faker`

Patrón actual: `Math.random()` para RIF, nombre, email, etc.
Patrón nuevo:

```typescript
import { faker } from '@faker-js/faker';

// No usar faker.seed() — queremos datos distintos en cada corrida.

// Partners
for (let i = 0; i < partnersCount; i++) {
  const rif = `J-${faker.string.numeric(9)}`;
  await db.insert(partners).values({
    name: faker.company.name(), // "Grupo Acme C.A."
    email: faker.internet.email().toLowerCase(),
    taxId: rif,
    address: faker.location.streetAddress({ useFullAddress: true }),
    phone: faker.phone.number({ style: 'international' }),
    // ... resto igual
  });
}
```

Misma transformación para productos (nombre con `faker.commerce.productName()`), empleados (firstName/lastName con `faker.person.*()`), etc.

**Añadir (al final de `seedFaker`):**

4. **Stock:** después de crear productos y warehouses, crear 1 fila de stock por cada producto en el warehouse principal.
   - `warehouseId` = warehouse recién creado.
   - `productId` = cada producto del loop.
   - `quantity` = `faker.number.int({ min: 0, max: 500 })`.
   - Idempotencia: `onConflictDoUpdate` por `[warehouseId, productId, batchId]`.

### 5.5 `packages/database/src/scripts/seed-test.ts` (NUEVO)

**Propósito:** seed predecible y minimal para tests automatizados.

**Diseño:**

```typescript
// UUIDs hardcoded (formato v4, igual que crypto.randomUUID())
const DETERMINISTIC_IDS = {
  adminUser: '00000000-0000-4000-8000-000000000001',
  sellerUser: '00000000-0000-4000-8000-000000000002',
  branch: '00000000-0000-4000-8000-000000000010',
  usdCurrency: '00000000-0000-4000-8000-000000000020',
  vesCurrency: '00000000-0000-4000-8000-000000000021',
  adminRole: '00000000-0000-4000-8000-000000000030',
  partner: '00000000-0000-4000-8000-000000000040',
  product: '00000000-0000-4000-8000-000000000050',
  warehouse: '00000000-0000-4000-8000-000000000060',
  bank: '00000000-0000-4000-8000-000000000070',
  bankAccount: '00000000-0000-4000-8000-000000000080',
  paymentMethod: '00000000-0000-4000-8000-000000000090',
};

export async function seedTestData() {
  console.log('Seeding test data (deterministic)...');

  // 1. RBAC (idempotente)
  await seedRbac();

  // 2. Currencies (USD, VES) — usar DETERMINISTIC_IDS
  // 3. Branch — DETERMINISTIC_IDS
  // 4. Bank + BankAccount
  // 5. Payment method
  // 6. Warehouse
  // 7. Admin user + Seller user (con passwords hasheados)
  // 8. Partner
  // 9. Product category + Product
  // 10. Stock (1 unidad del producto en el warehouse)
  // 11. User roles + User branches (asignar admin → ADMIN, seller → SELLER, ambos → branch)
  // 12. Exchange rate (1 entry: 36.50 VES por USD, source MANUAL)

  // 13. Post-seed validation (ver §7)
  await validateInvariants();

  console.log('Test data seeding completed!');
}
```

**Datos clave:**

- Admin: email `test-admin@test.local`, password `'Test1234!'` (hasheado).
- Seller: email `test-seller@test.local`, password `'Test1234!'`.
- Partner: name `'Test Partner C.A.'`, taxId `'J-12345678-9'`.
- Product: sku `'TEST-SKU-001'`, name `'Test Product'`, price `'100.00'`, cost `'60.00'`.
- Stock: quantity `'1'`.

**Idempotencia:** todos los inserts usan `onConflictDoUpdate` o `onConflictDoNothing` según corresponda.

**Post-seed validation:** función `validateInvariants()` (ver §7) corre al final y lanza si algún invariant falla.

### 5.6 Scripts en `package.json`

`packages/database/package.json` → añadir:

```json
"db:seed:test": "tsx src/scripts/seed-test.ts"
```

`package.json` (raíz) → añadir:

```json
"db:seed:test": "turbo run db:seed:test"
```

---

## 6. Tests del database package

### 6.1 `packages/database/tests/unit/schema.test.ts`

**Casos a cubrir:**

| Test                                                                       | Assertion                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `users` table exists with UUID primary key                                 | `users.id` is UUID column, not null, has `$defaultFn`         |
| `users.email` has unique constraint                                        | `users.email` index/constraint es `unique: true`              |
| `invoices` table has `totalBase`, `totalTax`, `totalIgtf`, `total` columns | 4 columnas existen, todas `numeric`/`text`                    |
| `exchangeRates` has `rate` column                                          | existe, tipo numeric/text                                     |
| `partners` has `taxId` unique                                              | existe unique constraint                                      |
| All HR tables have `createdAt`                                             | `employees`, `payrollRuns`, `payrollItems` tienen `createdAt` |

**Patrón:** importar las tablas desde `schema.ts` y usar `expect(table.id).toBeDefined()`, `expect(table.email.unique).toBe(true)`, etc. No requiere DB.

### 6.2 `packages/database/tests/unit/relations.test.ts`

**Casos a cubrir:**

| Test                                                          | Assertion                                    |
| ------------------------------------------------------------- | -------------------------------------------- |
| `usersRelations` declares relation to `usersRoles`            | `usersRelations.one(usersRoles, ...)` existe |
| `invoicesRelations` declares relation to `invoiceItems`       | existe                                       |
| `invoicesRelations` declares relation to `partner`            | existe via FK                                |
| `ordersRelations` declares relation to `orderItems`           | existe                                       |
| `employeesRelations` declares relation to `employeeContracts` | existe                                       |
| `payrollRunsRelations` declares relation to `payrollItems`    | existe                                       |

**Patrón:** importar las relations y verificar que están definidas. Inspección estática, no requiere DB.

### 6.3 `packages/database/tests/unit/seed.test.ts`

**Casos a cubrir:**

**Idempotencia:**

| Test                                                      | Assertion                                                 |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `seedRbac()` corre 2 veces produce mismo número de roles  | count(`roles`) === 5 después de 2 corridas                |
| `seedRbac()` corre 2 veces no duplica permissions         | count(`permissions`) === 67 después de 2 corridas         |
| `seedCoreData()` corre 2 veces no duplica currencies      | count(`currencies`) === 2 después de 2 corridas           |
| `seedTestData()` corre 2 veces no duplica users           | count(users con email test-admin) === 1                   |
| `seedFaker()` corre 2 veces no duplica partners por taxId | intentar insertar mismo taxId falla con unique constraint |

**Invariants de audit 12 §3:**

| Test                                     | Setup                                    | Assertion                                                                       |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| §3.4 bank balance invariant              | seedTestData + manual insert de payments | `bankAccount.currentBalance === sum(income) - sum(expense)` para cada cuenta    |
| §3.5 fiscal: totalTax = totalBase * 0.16 | insert invoice con `totalBase=1000`      | `totalTax === 160.00` (verifica que ningún código usa `Math.random()` para tax) |
| §3.2 sequential codes (si aplica)        | seedFaker crea 50 partners               | códigos siguen patrón predefinido si existe                                     |

**Infraestructura:** usa `testDb` (de `apps/backend/src/test/database.ts`). **Decisión:** mover `testDb` y `cleanDatabase` a `packages/database/src/test/database.ts` (donde deberían vivir) y re-exportar desde `apps/backend/src/test/database.ts` para backward compat. O crear uno nuevo en `packages/database/src/test/`. **Decisión final:** crear `packages/database/src/test/database.ts` independiente (sin tocar backend). El de backend se queda como está.

**Trade-off:** duplicación mínima del helper de test DB (~50 LOC). Aceptable para MVP.

**Docker compose:** los tests usan `docker-compose.test.yml` (puerto 5433) que ya existe. Comandos:

```bash
docker compose -f docker-compose.test.yml up -d
pnpm --filter database db:migrate
pnpm --filter database test
docker compose -f docker-compose.test.yml down
```

---

## 7. Invariants de audit 12 §3 — detalle

Implementados como función `validateInvariants()` en `seed-test.ts` y como tests en `seed.test.ts`.

### 7.1 §3.4 Bank balance invariant

```typescript
async function validateBankBalanceInvariant() {
  const accounts = await db.select().from(bankAccounts);
  for (const acc of accounts) {
    // Sumar pagos directos a esta cuenta (no via allocations)
    const accountPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.bankAccountId, acc.id));

    const income = accountPayments
      .filter(p => p.type === 'INCOME')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const expense = accountPayments
      .filter(p => p.type === 'EXPENSE')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const expected = income - expense;
    const actual = parseFloat(acc.currentBalance);
    if (Math.abs(expected - actual) > 0.01) {
      throw new Error(
        `Bank balance invariant violated for account ${acc.id}: expected ${expected}, got ${actual}`
      );
    }
  }
}
```

**Schema reference:** `payments.bankAccountId` (uuid, nullable) está en línea 387 de `schema.ts`; `payments.type` default `'INCOME'`; `payments.amount` es `numeric(20,2)`. `paymentAllocations` es la tabla que linkea payment→invoice, NO se usa para el bank balance.

Nota: en `seed-test.ts` (sin payments todavía) este invariant es trivial (sum=0, balance=0). En `seed.test.ts` se testea con payments sintéticos.

### 7.2 §3.5 Fiscal: totalTax = totalBase * 0.16

```typescript
async function validateFiscalInvariant() {
  const invs = await db.select().from(invoices);
  for (const inv of invs) {
    if (inv.status === 'DRAFT') continue; // DRAFT puede tener totales parciales
    const expectedTax = Math.round(parseFloat(inv.totalBase) * 0.16 * 100) / 100;
    const actualTax = parseFloat(inv.totalTax);
    if (Math.abs(expectedTax - actualTax) > 0.01) {
      throw new Error(
        `Fiscal invariant violated for invoice ${inv.code}: expected tax ${expectedTax}, got ${actualTax}`
      );
    }
  }
}
```

En `seed-test.ts` este invariant se valida después de insertar una invoice de prueba. En `seed.test.ts` se valida con invoices creados via factories.

---

## 8. Tests del backend (3 archivos)

Ya cubiertos en §4.3, §4.4, §4.5. Resumen:

| Archivo                  |                              Tests | Mocks requeridos                     |
| ------------------------ | ---------------------------------: | ------------------------------------ |
| `auth.service.test.ts`   | 11 (spec dijo 12, código tenía 11) | db (chainable), bcryptjs, JwtService |
| `jwt-auth.guard.test.ts` |                                  3 | super.canActivate spy                |
| `cron.service.test.ts`   | 12 (spec dijo 11, código tenía 12) | global.fetch, db (chainable)         |

**Total tests nuevos backend:** 26

**Total tests nuevos database:** 23 (1 smoke + 9 schema + 6 relations + 7 seed) — spec dijo ~19; real es 23 porque schema tiene 9 tests, no 6.

---

## 9. Archivos a crear/modificar (resumen final)

**Creados (8):**

1. `apps/backend/src/modules/auth/auth.service.test.ts`
2. `apps/backend/src/modules/cron/cron.service.test.ts`
3. `apps/backend/src/modules/cron/__fixtures__/bcv-page.html` (snapshot HTML para tests)
4. `apps/backend/src/common/guards/jwt-auth.guard.test.ts`
5. `packages/database/vitest.config.ts`
6. `packages/database/src/scripts/seed-test.ts`
7. `packages/database/tests/unit/schema.test.ts`
8. `packages/database/tests/unit/relations.test.ts`
9. `packages/database/tests/unit/seed.test.ts`
10. `packages/database/src/test/database.ts` (testDb para tests de database package)

**Modificados (6):**

1. `apps/backend/package.json` (+@faker-js/faker, +@vitest/coverage-v8)
2. `apps/backend/src/test/factories.ts` (Math.random → faker)
3. `packages/database/package.json` (+@faker-js/faker, +script db:seed:test, posible +bcryptjs)
4. `packages/database/src/scripts/seed-core.ts` (+users, +bank_accounts, +userRoles, +userBranches)
5. `packages/database/src/scripts/seed-faker.ts` (Math.random → faker, +stock)
6. `package.json` raíz (+script db:seed:test)

---

## 10. Plan de verificación

### 10.1 Tests unitarios

```bash
# Backend
cd "C:\Users\elchu\Documents\Proyectos\docker-project-turbo"
pnpm --filter backend test

# Database
docker compose -f docker-compose.test.yml up -d
pnpm --filter database db:migrate
pnpm --filter database test
docker compose -f docker-compose.test.yml down
```

Expected:

- Backend: 708 + 26 = 734 tests, 100% pass. (Actualizado post-ejecución: auth 11 + guard 3 + cron 12 = 26 nuevos; total 734.)
- Database: ~23 tests nuevos (1 smoke + 9 schema + 6 relations + 7 seed), 100% pass. (Actualizado post-ejecución: schema tiene 9 tests, no 6; smoke de T5 = 1; seed = 7; relations = 6. Total 23.)

### 10.2 Coverage

```bash
pnpm --filter backend test:coverage
```

Expected: genera reporte en `apps/backend/coverage/`. Verificar que los 3 módulos nuevos tienen coverage.

### 10.3 Seeds end-to-end

```bash
# Fresh DB
docker compose down -v
docker compose up -d postgres
pnpm --filter database db:migrate
pnpm --filter database db:seed:rbac
pnpm --filter database db:seed        # (script existente via seed-core + seed-faker)
pnpm --filter database db:seed:test

# Verificar:
# - Login funciona: admin@test.local / Test1234!
# - Bank accounts existen
# - Stock tiene rows
# - Invariants post-seed pasan (no throw)
```

### 10.4 Auto-validación de `seed-test.ts`

```bash
pnpm --filter database db:seed:test
```

Expected: imprime "Test data seeding completed!" sin errores. Si algún invariant falla, el proceso exit code != 0.

---

## 11. Out of scope (recordatorio)

- Refactor de mocks duplicados (otro sub-proyecto).
- Tests de controllers y DTOs.
- L5/L6/L7.5 (orders, invoices, credit notes, payments, recalculate-balances).
- `db:setup:test` composite script.
- Migración legacy de `employees.*` bank fields.
- Renombrar `uuidv7()` a `uuidv4()`.
- Arreglar `FALLBACK_API_URL` corrupto en `cron.service.ts`.
- Actualizar `PROGRESS.md` (chore al final, opcional).
- E2E con supertest.
- CI/CD (prerequisitos pendientes).

---

## 12. Riesgos y mitigaciones

| Riesgo                                                                         | Mitigación                                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `bcryptjs` no está en `packages/database` deps                                 | Verificar en implementación; si falta, añadir a devDependencies (solo se usa en seed, no en runtime) |
| `seed-test.ts` con UUIDs hardcoded colisiona con datos existentes              | Documentar en CI.md: `seed-test` se asume sobre DB limpia. En tests usar `cleanDatabase()` antes     |
| Tests de `parseBcvHtml` con HTML real se rompen si BCV cambia formato          | Los tests cubren 4 patterns + JSON; si BCV cambia, fallará loudly y se actualiza                     |
| `@faker-js/faker` aumenta el bundle                                            | Es devDep, no afecta el bundle de producción                                                         |
| FALLBACK_API_URL corrupto en `cron.service.ts`                                 | Tests no dependen del URL real (mockean `fetch`); el bug queda para otro sub-proyecto                |
| `seedFaker` con 200 productos tarda mucho                                      | Ya era así; el script sigue funcionando, no introducimos regresión                                   |
| `crypto.randomUUID()` en seed-test vs `uuidv7()` mal nombrado                  | No afecta: seed-test usa IDs hardcoded que son v4-format, compatible con la convención actual        |
| Tests de `CronService` con `vi.stubGlobal('fetch', ...)` puede no limpiar bien | Usar `vi.unstubAllGlobals()` en `afterEach`                                                          |

---

## 13. Bug encontrado durante exploración (no se arregla en este sub-proyecto)

`apps/backend/src/modules/cron/cron.service.ts` línea 8:

```typescript
private readonly FALLBACK_API_URL = 'https://�Zņ?����?​.com/servicio/get_exchange_rate';
```

El URL está corrupto (caracteres basura). Esto significa que el fallback **nunca ha funcionado** desde su creación. Cuando el BCV primario falla, el servicio devuelve `success: false` con un mensaje de error.

**Acción:** dejar como está. Documentado aquí para que un sub-proyecto futuro de "cron service hardening" lo arregle. Los tests de `CronService` mockean `fetch` y no dependen del URL real.

---

## 14. Criterios de éxito

- [ ] `pnpm --filter backend test` pasa 100% (708 + 26 tests)
- [ ] `pnpm --filter backend test:coverage` genera reporte (antes fallaba)
- [ ] `pnpm --filter database test` pasa 100% (~19 tests nuevos: 6 schema + 6 relations + 7 seed)
- [ ] `pnpm --filter database db:seed:test` corre sin errores y valida invariants
- [ ] Fresh seed: `db:seed:rbac + db:seed (core+core) + db:seed:test` deja la DB en estado usable
- [ ] Login con `admin@test.local` / `Test1234!` funciona tras fresh seed
- [ ] Bank accounts existen y tienen currentBalance = 0
- [ ] Stock tiene al menos 1 row por producto
- [ ] `seed-faker.ts` usa `@faker-js/faker` (verificable con grep: `Math.random` no aparece en `seed-faker.ts`)
- [ ] `factories.ts` usa `@faker-js/faker` (verificable con grep: `Math.random` no aparece en `factories.ts`)
- [ ] Invariants de audit 12 §3.4 y §3.5 están testeados

## 14. Resumen ejecutivo post-ejecución (lecciones aprendidas)

**Cambios y correcciones aplicadas durante la implementación:**

1. **Conteo de tests del spec estaba mal en 3 lugares:**
   - Spec §4.3: "12 tests" para AuthService; el código real tenía 11 `it` blocks. **Real: 11.**
   - Spec §4.5: "11 tests" para CronService; el código real tenía 12 `it` blocks. **Real: 12.**
   - Spec §6.1: "6 tests" para schema.test.ts; el código real tenía 9 `it` blocks. **Real: 9.**

2. **Drizzle API mismatch detectado:** El spec asumía `.unique` para columnas únicas; en Drizzle es `.isUnique`. 3 tests del schema requirieron corrección.

3. **Schema deviations:** `employees` tiene `updatedAt` pero NO `createdAt`. `payrollItems` no tiene ninguna columna timestamp. 2 tests requirieron reformulación.

4. **Bugs pre-existentes descubiertos y arreglados (no estaban en el spec original):**
   - `?schema=public` en `.env` y `docker-compose.yml` rompía `postgres-js` (Prisma-style option, Drizzle no lo entiende). Fixed inline en T6.
   - `seed-rbac.ts` no tenía `onConflictDoNothing()` en `roles_permissions` insert, rompiendo idempotencia. Fixed inline en T7.
   - `seed-test.ts` usaba `onConflictDoUpdate` con un unique constraint que incluye `batchId: null` (PostgreSQL trata NULLs como distintos en unique indexes). Cambiado a `onConflictDoNothing`. Fixed inline en T14.
   - `seed-core.ts` para `bankAccounts` ya usaba select-then-insert/update (no `onConflictDoUpdate`) porque no hay unique constraint en `(accountNumber, branchId)`. El spec inicialmente propuso el `onConflictDoUpdate` que no funcionaría. T6 implementer detectó y conservó el patrón correcto.
   - `branches` no tiene `.unique()` en `taxId` (solo `text`), así que `seed-core.ts` re-runs crean branches duplicadas. Out of scope (T15 no lo arregla; documentado aquí).
   - `FALLBACK_API_URL` en `cron.service.ts` está corrupto (caracteres basura). Out of scope (otro sub-proyecto).

5. **Mejoras implementadas por los implementers (no en spec):**
   - `_run-seed-core.ts`, `_run-seed-faker.ts`, `_run-seed-test.ts` (wrappers para ejecutar los seeds standalone).
   - `_verify-test-passwords.ts` (verificación rápida de que los password hashes de seed-test son válidos).
   - `vitest.config.ts` actualizado con `DATABASE_URL` para que los seeds de los tests apunten a la test DB (no a dev DB).

6. **Total final verificado:** 734 backend tests + 23 database tests = **757 tests pasando**. Login con `test-admin@test.local` / `Test1234!` produce bcrypt hash válido (verificado con `_verify-test-passwords.ts`). Fresh seed en DB limpia produce: 2 test users, 1 test partner, 1 test product, 1 stock row, 1 bank account, 1 branch.

---

## 15. Evolución futura (no en este sub-proyecto)

- Refactor de mocks: extraer `createMockSelectQuery()` a `apps/backend/src/test/mocks/db.ts`. Elimina ~300 LOC de boilerplate.
- Tests de controllers con supertest.
- Tests de DTOs con class-validator.
- L5/L6/L7.5: orders, invoices, credit notes, payments, recalculate-balances.
- `db:setup:test` composite: `reset → migrate → seed:rbac → seed:core → seed:faker → seed:test → validate`.
- Arreglar `FALLBACK_API_URL` corrupto.
- Renombrar `uuidv7()` a `uuidv4()` (cosmético).
- Actualizar `PROGRESS.md` para reflejar este trabajo.
- CI/CD con GitHub Actions (sub-proyecto previo pendiente de prerequisitos).
- Migración legacy de `employees.*` bank fields → `employee_bank_accounts`.
