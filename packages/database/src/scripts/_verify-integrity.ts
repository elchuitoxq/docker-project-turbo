import { db } from '../index';
import {
  users, roles, permissions, userAppSettings,
  branches, currencies, exchangeRates,
  partners, products, productCategories, warehouses,
  stock, inventoryMoves, inventoryMoveLines,
  orders, orderItems, invoices, invoiceItems,
  creditNotes, creditNoteItems, creditNoteUsages,
  banks, bankAccounts, paymentMethods, paymentMethodAccounts,
  payments, paymentAllocations, taxRetentions, taxRetentionLines,
  employees, departments, jobPositions, employeeContracts,
  employeeBenefits, employeeVacations, employeeProfitSharing,
  employeeSalaryHistory, employeeBankAccounts,
  payrollRuns, payrollItems, payrollItemLines, payrollSettings,
  payrollConceptTypes, payrollIncidents,
  accountingAccounts, accountingEntries, accountingEntryLines, accountingMaps,
  loans, loanItems, auditLogs,
  documentLinks, organizationModules, taxConcepts,
  usersRoles, usersBranches, rolesPermissions,
} from '../schema';
import { eq, sql, and, isNull, isNotNull, count } from 'drizzle-orm';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<boolean>, message: string, details?: any) {
  try {
    const passed = await fn();
    results.push({ name, passed, message, details });
  } catch (error: any) {
    results.push({ name, passed: false, message: `${message}: ${error.message}`, details });
  }
}

async function runIntegrityTests() {
  console.log('='.repeat(60));
  console.log('AUDITORIA DE INTEGRIDAD DE DATOS');
  console.log('='.repeat(60));

  // ============================================
  // MODULO 1: USERS Y AUTENTICACION
  // ============================================
  console.log('\n[1] Modulo: Seguridad y Autenticacion');

  await test('Users tienen email unico',
    async () => {
      const dupe = await db.select({ email: users.email, count: count() })
        .from(users)
        .groupBy(users.email)
        .having(sql`count(*) > 1`);
      return dupe.length === 0;
    },
    'Emails duplicados encontrados',
    { count: 0 });

  await test('Users tienen password hash',
    async () => {
      const withoutPassword = await db.select().from(users).where(sql`length(password) < 10`);
      return withoutPassword.length === 0;
    },
    'Users sin password hash valido');

  await test('Todos los roles tienen al menos un permiso',
    async () => {
      const rolesWithoutPerms = await db.select({ id: roles.id, name: roles.name })
        .from(roles)
        .leftJoin(rolesPermissions, eq(roles.id, rolesPermissions.roleId))
        .groupBy(roles.id, roles.name)
        .having(sql`count(${rolesPermissions.permissionId}) = 0`);
      return rolesWithoutPerms.length === 0;
    },
    'Roles sin permisos');

  // ============================================
  // MODULO 2: GESTION COMERCIAL
  // ============================================
  console.log('\n[2] Modulo: Gestion Comercial');

  await test('Invoices tienen partner valido (sin orphans)',
    async () => {
      const orphans = await db.select({ id: invoices.id, code: invoices.code })
        .from(invoices)
        .leftJoin(partners, eq(invoices.partnerId, partners.id))
        .where(isNull(partners.id));
      return orphans.length === 0;
    },
    'Invoices sin partner valido',
    { orphans: 0 });

  await test('InvoiceItems referencian invoice existente',
    async () => {
      const orphans = await db.select({ id: invoiceItems.id })
        .from(invoiceItems)
        .leftJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
        .where(isNull(invoices.id));
      return orphans.length === 0;
    },
    'InvoiceItems sin invoice');

  await test('Invoices tienen currency valida',
    async () => {
      const orphans = await db.select({ id: invoices.id })
        .from(invoices)
        .leftJoin(currencies, eq(invoices.currencyId, currencies.id))
        .where(isNull(currencies.id));
      return orphans.length === 0;
    },
    'Invoices sin currency');

  await test('Ordenes tienen status validos',
    async () => {
      const validStatus = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
      const invalid = await db.select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(sql`status NOT IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')`);
      return invalid.length === 0;
    },
    'Ordenes con status invalido');

  // ============================================
  // MODULO 3: INVENTARIO
  // ============================================
  console.log('\n[3] Modulo: Inventario');

  await test('Stock tiene warehouse valido',
    async () => {
      const orphans = await db.select({ id: stock.id })
        .from(stock)
        .leftJoin(warehouses, eq(stock.warehouseId, warehouses.id))
        .where(isNull(warehouses.id));
      return orphans.length === 0;
    },
    'Stock sin warehouse');

  await test('Stock tiene producto valido',
    async () => {
      const orphans = await db.select({ id: stock.id })
        .from(stock)
        .leftJoin(products, eq(stock.productId, products.id))
        .where(isNull(products.id));
      return orphans.length === 0;
    },
    'Stock sin producto');

  await test('Inventory moves tienen codigo unico',
    async () => {
      const dupe = await db.select({ code: inventoryMoves.code, count: count() })
        .from(inventoryMoves)
        .groupBy(inventoryMoves.code)
        .having(sql`count(*) > 1`);
      return dupe.length === 0;
    },
    'Codigos de movimiento duplicados');

  // ============================================
  // MODULO 4: TESORERIA
  // ============================================
  console.log('\n[4] Modulo: Tesoreria');

  await test('Payments tienen partner valido',
    async () => {
      const orphans = await db.select({ id: payments.id })
        .from(payments)
        .leftJoin(partners, eq(payments.partnerId, partners.id))
        .where(isNull(partners.id));
      return orphans.length === 0;
    },
    'Payments sin partner');

  await test('Payments tienen metodo de pago valido',
    async () => {
      const orphans = await db.select({ id: payments.id })
        .from(payments)
        .leftJoin(paymentMethods, eq(payments.methodId, paymentMethods.id))
        .where(isNull(paymentMethods.id));
      return orphans.length === 0;
    },
    'Payments sin metodo de pago');

  await test('Payment allocations referencian payment existente',
    async () => {
      const orphans = await db.select({ id: paymentAllocations.id })
        .from(paymentAllocations)
        .leftJoin(payments, eq(paymentAllocations.paymentId, payments.id))
        .where(isNull(payments.id));
      return orphans.length === 0;
    },
    'Allocations sin payment');

  await test('Payment allocations referencian invoice existente',
    async () => {
      const orphans = await db.select({ id: paymentAllocations.id })
        .from(paymentAllocations)
        .leftJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
        .where(isNull(invoices.id));
      return orphans.length === 0;
    },
    'Allocations sin invoice');

  // ============================================
  // MODULO 5: NOMINA
  // ============================================
  console.log('\n[5] Modulo: Nomina y RRHH');

  await test('Employees tienen branch valido',
    async () => {
      const orphans = await db.select({ id: employees.id })
        .from(employees)
        .leftJoin(branches, eq(employees.branchId, branches.id))
        .where(and(isNotNull(employees.branchId), isNull(branches.id)));
      return orphans.length === 0;
    },
    'Employees sin branch');

  await test('Employees tienen position valida',
    async () => {
      const orphans = await db.select({ id: employees.id })
        .from(employees)
        .leftJoin(jobPositions, eq(employees.positionId, jobPositions.id))
        .where(and(isNotNull(employees.positionId), isNull(jobPositions.id)));
      return orphans.length === 0;
    },
    'Employees sin position');

  await test('Employees tienen department valido',
    async () => {
      const orphans = await db.select({ id: employees.id })
        .from(employees)
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .where(and(isNotNull(employees.departmentId), isNull(departments.id)));
      return orphans.length === 0;
    },
    'Employees sin department');

  await test('Payroll runs tienen currency valida',
    async () => {
      const orphans = await db.select({ id: payrollRuns.id })
        .from(payrollRuns)
        .leftJoin(currencies, eq(payrollRuns.currencyId, currencies.id))
        .where(isNull(currencies.id));
      return orphans.length === 0;
    },
    'Payroll runs sin currency');

  // ============================================
  // MODULO 6: CONTABILIDAD
  // ============================================
  console.log('\n[6] Modulo: Contabilidad');

  await test('Accounting entries tienen partida doble balanceada',
    async () => {
      const entries = await db.select().from(accountingEntries);
      const lines = await db.select().from(accountingEntryLines);
      
      const linesByEntry = new Map<string, typeof lines>();
      for (const line of lines) {
        const existing = linesByEntry.get(line.entryId) || [];
        existing.push(line);
        linesByEntry.set(line.entryId, existing);
      }
      
      const unbalanced: string[] = [];
      for (const entry of entries) {
        const entryLines = linesByEntry.get(entry.id) || [];
        const sumDebit = entryLines.reduce((sum, l) => sum + parseFloat(l.debit || '0'), 0);
        const sumCredit = entryLines.reduce((sum, l) => sum + parseFloat(l.credit || '0'), 0);
        if (Math.abs(sumDebit - sumCredit) > 0.01) {
          unbalanced.push(entry.code);
        }
      }
      return unbalanced.length === 0;
    },
    'Entradas contables descuadradas');

  await test('Accounting entry lines referencian entry valida',
    async () => {
      const orphans = await db.select({ id: accountingEntryLines.id })
        .from(accountingEntryLines)
        .leftJoin(accountingEntries, eq(accountingEntryLines.entryId, accountingEntries.id))
        .where(isNull(accountingEntries.id));
      return orphans.length === 0;
    },
    'Lines sin entry');

  // ============================================
  // MODULO 7: MULTI-MONEDA
  // ============================================
  console.log('\n[7] Modulo: Multi-Moneda');

  await test('Exchange rates tienen currency valida',
    async () => {
      const orphans = await db.select({ id: exchangeRates.id })
        .from(exchangeRates)
        .leftJoin(currencies, eq(exchangeRates.currencyId, currencies.id))
        .where(isNull(currencies.id));
      return orphans.length === 0;
    },
    'Exchange rates sin currency');

  await test('Existe moneda base (is_base = true)',
    async () => {
      const baseCurrency = await db.select().from(currencies).where(eq(currencies.isBase, true));
      return baseCurrency.length === 1;
    },
    'Moneda base no existe o hay mas de una');

  // ============================================
  // MODULO 8: PRODUCTOS
  // ============================================
  console.log('\n[8] Modulo: Productos');

  await test('Products tienen SKU unico',
    async () => {
      const dupe = await db.select({ sku: products.sku, count: count() })
        .from(products)
        .groupBy(products.sku)
        .having(sql`count(*) > 1`);
      return dupe.length === 0;
    },
    'SKUs duplicados');

  await test('Products referencian categoria valida (si tienen)',
    async () => {
      const orphans = await db.select({ id: products.id })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(and(isNotNull(products.categoryId), isNull(productCategories.id)));
      return orphans.length === 0;
    },
    'Products sin categoria valida');

  // ============================================
  // MODULO 9: CREDITOS
  // ============================================
  console.log('\n[9] Modulo: Creditos y Prestamos');

  await test('Loans tienen partner valido',
    async () => {
      const orphans = await db.select({ id: loans.id })
        .from(loans)
        .leftJoin(partners, eq(loans.partnerId, partners.id))
        .where(isNull(partners.id));
      return orphans.length === 0;
    },
    'Loans sin partner');

  await test('Loan items referencian loan valido',
    async () => {
      const orphans = await db.select({ id: loanItems.id })
        .from(loanItems)
        .leftJoin(loans, eq(loanItems.loanId, loans.id))
        .where(isNull(loans.id));
      return orphans.length === 0;
    },
    'Loan items sin loan');

  // ============================================
  // RESUMEN
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE PRUEBAS');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\nTotal: ${results.length} | ✅ Pasadas: ${passed} | ❌ Fallidas: ${failed}`);

  if (failed > 0) {
    console.log('\n--- PRUEBAS FALLIDAS ---');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`❌ ${r.name}: ${r.message}`);
      if (r.details) console.log('   Detalles:', JSON.stringify(r.details));
    });
  }

  console.log('\n--- TODAS LAS PRUEBAS ---');
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${r.name}`);
  });

  return { passed, failed, results };
}

runIntegrityTests()
  .then(({ passed, failed }) => {
    if (failed > 0) {
      process.exit(1);
    }
    console.log('\n✅ Todas las pruebas de integridad pasaron.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error ejecutando pruebas:', err);
    process.exit(1);
  });
