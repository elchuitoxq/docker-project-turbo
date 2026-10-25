# MEJORAS DE ARQUITECTURA - RECOMENDACIONES

## 1. Sistema de Bancos (DUPLICACIÓN)

### Problema Actual
- `banks` (catálogo maestro)
- `bankAccounts` (cuentas empresa)
- `employees` tiene campos sueltos: `bankId`, `bankName`, `accountNumber`, `accountType`

### Solución Sugerida
Nueva tabla `employeeBankAccounts` para normalizar.

```typescript
// NUEVA TABLA
export const employeeBankAccounts = pgTable("employee_bank_accounts", {
  id: uuid().primaryKey().$defaultFn(() => uuidv7()),
  employeeId: uuid().references(() => employees.id).notNull(),
  bankId: uuid().references(() => banks.id).notNull(),
  accountNumber: text().notNull(),
  accountType: text().default("CHECKING"),
  currencyId: uuid().references(() => currencies.id),
  isPrimary: boolean().default(false),
  isActive: boolean().default(true),
});
```

**Ver**: `06-BANKS-ANALISIS-Y-MEJORAS.md`

---

## 2. Transacciones ACID Faltantes

### Problema Actual
Operaciones críticas como `createInvoice()` no envuelven todo en `db.transaction()`.

### Snippet Actual (Problemático)

```typescript
// billing.service.ts - PROBLEMÁTICO
async createInvoice(data) {
  const [invoice] = await db.insert(invoices).values(data).returning();
  
  // Si esto falla, la factura existe sin items
  await db.insert(invoiceItems).values(items);
  
  // Y el inventario se actualiza parcial
  await updateStock(...);
}
```

### Solución Sugerida

```typescript
// billing.service.ts - CORREGIDO
async createInvoice(data) {
  return await db.transaction(async (tx) => {
    const [invoice] = await tx.insert(invoices).values(data).returning();
    
    await tx.insert(invoiceItems).values(items.map(item => ({
      ...item,
      invoiceId: invoice.id,
    })));
    
    await tx.update(products)
      .set({ cost: newCost })
      .where(eq(products.id, productId));
    
    return invoice;
  });
  // Si algo falla, TODO se revierte
}
```

---

## 3. BCV Scraper Frágil

### Problema Actual
```typescript
// bcv-scraper.service.ts - FRÁGIL
async scrapeRates() {
  const response = await axios.get('https://www.bcv.org.ve');
  const $ = cheerio.load(response.data);
  // Si BCV cambia HTML, esto rompe
  const usdRate = $('.euro').text();
}
```

### Mejoras Sugeridas

```typescript
// 1. Separar parsing de fetching
class BCVRateFetcher {
  async fetch(): Promise<string> {
    const response = await axios.get('https://www.bcv.org.ve');
    return response.data;
  }
}

class BCVRateParser {
  parse(html: string): { USD: number; EUR: number } {
    // Lógica de parsing aislada
  }
}

// 2. Agregar cache Redis
// 3. Agregar fallback a última tasa conocida
// 4. Agregar alertas si tasa varía >X%
```

---

## 4. Validación DTOs Inconsistente

### Problema Actual
Cada módulo tiene sus propios DTOs con validaciones diferentes.

### Mejoras Sugeridas

```typescript
// packages/shared/src/dto/ base
import { z } from 'zod';

export const UUIDSchema = z.string().uuid();
export const OptionalUUIDSchema = z.string().uuid().optional();

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Usar en todos los módulos
export const CreateInvoiceDto = z.object({
  partnerId: UUIDSchema,
  currencyId: UUIDSchema,
  items: z.array(InvoiceItemSchema),
  // ...
});
```

---

## 5. Nomenclatura Mixta

### Problema Actual
- Backend retorna: `invoiceItems` (camelCase)
- Frontend recibe: `invoice_items` (snake_case del JSON)
- Drizzle usa: `invoiceItems` (camelCase en código)

### Solución Sugerida
Estandarizar en snake_case para API (convención JSON):

```typescript
// Configurar Drizzle para snake_case en outputs
export const db = drizzle(client, { 
  schema,
  casing: 'snake_case', // Para API responses
});
```

---

## 6. Ausencia de Tests

### Problema Actual
No hay tests unitarios ni e2e.

### Mejoras Sugeridas

```bash
# Estructura de tests
apps/
├── api/
│   └── src/
│       └── modules/
│           └── billing/
│               ├── billing.service.test.ts
│               └── billing.controller.spec.ts
apps/
├── web/
│   └── modules/
│       └── billing/
│           └── components/
│               └── invoices-table.test.tsx
```

### Stack Sugerido

| Tipo | Herramienta |
|------|-------------|
| Unit Backend | Vitest + ts-jest |
| E2E Backend | Supertest |
| Unit Frontend | Vitest + React Testing Library |
| E2E Frontend | Playwright o Cypress |

---

## 7. Ausencia de Logging Estructurado

### Problema Actual
```typescript
// Uso inconsistente
console.log('Payment created');
console.error('Failed');
```

### Mejoras Sugeridas

```typescript
// Usar Pino (o Winston)
import pino from 'pino';

const logger = pino({ level: 'info' });

// En servicios
logger.info({ paymentId: payment.id, amount: payment.amount }, 'Payment processed');
logger.error({ err, paymentId }, 'Payment failed');

// Agregar request ID para tracing
```

---

## 8. API Sin Versionado

### Problema Actual
`/api/users`, `/api/invoices` sin versión.

### Mejoras Sugeridas

```typescript
// Prefijo de versión
@Controller({ path: 'v1/users' })
export class UsersController {}

// URLs:
// /api/v1/users
// /api/v1/invoices
// /api/v2/users (futura versión)
```

---

## 9. Sin Middleware de Rate Limiting

### Problema Actual
No hay protección contra abuso de API.

### Mejoras Sugeridas

```typescript
// @nestjs/throttler
@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
  ],
})
export class AppModule {}

// Uso por ruta
@UseGuards(ThrottlerGuard)
@Controller('api')
```

---

## 10. Sin Cache Redis

### Problema Actual
Tasas BCV se recalculan en cada request.

### Mejoras Sugeridas

```typescript
// En BCV Scraper
import Redis from 'ioredis';

const redis = new Redis();

async scrapeRates() {
  // 1. Fetch y parsear
  const rates = await fetchBCVRates();
  
  // 2. Guardar en Redis con TTL
  await redis.setex('bcv:usd', 3600, rates.USD); // 1 hora
  
  // 3. En servicios, leer de Redis primero
  const cachedRate = await redis.get('bcv:usd');
  if (cachedRate) return parseFloat(cachedRate);
}
```

---

## 11. Monitoreo y Observabilidad

### Problema Actual
Sin métricas ni tracing.

### Mejoras Sugeridas

```typescript
// OpenTelemetry
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter(),
});

sdk.start();

// Decorator para tracing
@Span('billing.createInvoice')
async createInvoice(data) {
  // ...
}
```

---

## 12. Resumen de Mejoras Prioritarias

| Prioridad | Mejora | Impacto |
|-----------|--------|---------|
| 🔴 ALTA | employeeBankAccounts | Data integrity |
| 🔴 ALTA | Transacciones ACID | Data integrity |
| 🟡 MEDIA | Redis Cache BCV | Performance |
| 🟡 MEDIA | DTOs centralizados (Zod) | Developer experience |
| 🟡 MEDIA | Tests | Code quality |
| 🟢 BAJA | Rate Limiting | Security |
| 🟢 BAJA | API Versioning | Future-proof |

---

## 13. Pasos de Implementación

### Fase 1: Data Integrity
1. Crear tabla `employeeBankAccounts`
2. Migrar datos legacy
3. Actualizar servicios para usar nueva tabla
4. Agregar transacciones ACID a billing, treasury

### Fase 2: Performance
1. Implementar Redis para BCV rates
2. Agregar índices a tablas de alta consulta
3. Implementar query caching

### Fase 3: Quality
1. Setup Vitest + Testing Library
2. Tests para servicios críticos (billing, treasury, payroll)
3. Tests e2e para flows principales

### Fase 4: Observability
1. Setup Pino logger
2. Agregar OpenTelemetry
3. Dashboard de métricas

---

## 14. Anti-Patrones a Evitar

```typescript
// ❌ NO hacer esto:

// 1. Mutaciones de estado en paralelo
await Promise.all([
  updateInvoice(),
  updateStock(),  // Si una falla, inconsistencia
]);

// 2. Queries N+1
for (const invoice of invoices) {
  invoice.items = await getItems(invoice.id); // N queries
}

// 3. Tipos any
const data: any = response.data;

// 4. Strings mágicos
if (status === 'DRAFT') { } // Usar enum/const

// 5. Importaciones circulares
// A imports B, B imports A
```
