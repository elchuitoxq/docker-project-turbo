import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), override: true });

import { db } from '../index';
import { seedFaker } from './seed-faker';
import { seedRbac } from './seed-rbac';
import { uuidv7 } from '../schema';
import {
  partners, products, warehouses, stock,
  orders, orderItems, invoices, invoiceItems,
  payments, paymentAllocations,
  currencies, branches, users, paymentMethods, bankAccounts,
  accountingAccounts, accountingEntries, accountingEntryLines, accountingMaps,
  partnersRelations,
} from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function seedBusinessFlow() {
  console.log('='.repeat(60));
  console.log('SEEDING BUSINESS FLOW: Order -> Invoice -> Payment');
  console.log('='.repeat(60));

  // 1. Asegurar que hay datos base
  console.log('\n[1] Verificando datos base...');
  
  const allPartners = await db.select().from(partners).limit(10);
  const allProducts = await db.select().from(products).limit(10);
  const allWarehouses = await db.select().from(warehouses);
  const allCurrencies = await db.select().from(currencies);
  const allUsers = await db.select().from(users);
  const [usd] = await db.select().from(currencies).where(eq(currencies.code, 'USD')).limit(1);
  
  console.log(`   Partners disponibles: ${allPartners.length}`);
  console.log(`   Products disponibles: ${allProducts.length}`);
  console.log(`   Warehouses: ${allWarehouses.length}`);
  console.log(`   Currencies: ${allCurrencies.length}`);
  console.log(`   Users: ${allUsers.length}`);

  if (allPartners.length < 5 || allProducts.length < 5) {
    console.log('\n   Ejecutando seed-faker primero...');
    await seedFaker({ partnersCount: 20, productsCount: 50, employeesCount: 10 });
  }

  // 2. Obtener datos actualizados
  const freshPartners = await db.select().from(partners).limit(10);
  const freshProducts = await db.select().from(products).limit(20);
  const [freshBranch] = await db.select().from(branches).limit(1);
  const [warehouse] = await db.select().from(warehouses).limit(1);
  const [adminUser] = await db.select().from(users).limit(1);

  if (!freshBranch || !warehouse || !adminUser || freshProducts.length === 0) {
    throw new Error('Faltan datos base: branch, warehouse, user o products');
  }

  console.log('\n[2] Creando Orders...');
  
  // 3. Crear Orders (3 pedidos)
  const createdOrders: any[] = [];
  
  // Verificar si ya existen orders para evitar duplicados
  const existingOrders = await db.select().from(orders).limit(3);
  if (existingOrders.length > 0) {
    console.log(`   Ya existen ${existingOrders.length} orders, usando datos existentes`);
    for (const ord of existingOrders) {
      createdOrders.push(ord);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const partner = freshPartners[i % freshPartners.length];
      const orderCode = `ORD-2026-${String(i + 1).padStart(4, '0')}-${Date.now()}`;
      
      const [order] = await db.insert(orders).values({
        id: uuidv7(),
        code: orderCode,
        partnerId: partner.id,
        branchId: freshBranch.id,
        warehouseId: warehouse.id,
        type: 'SALE',
        status: 'CONFIRMED',
        total: '0',
        exchangeRate: '1',
        currencyId: usd.id,
        date: new Date(),
        userId: adminUser.id,
      }).returning();
    
    createdOrders.push(order);
    console.log(`   Created order: ${order.code}`);

    // 4. Crear OrderItems para cada orden
    let orderTotal = 0;
    for (let j = 0; j < 3; j++) {
      const product = freshProducts[(i * 3 + j) % freshProducts.length];
      const quantity = (j + 1) * 2;
      const price = parseFloat(product.price);
      const total = quantity * price;
      orderTotal += total;

      await db.insert(orderItems).values({
        id: uuidv7(),
        orderId: order.id,
        productId: product.id,
        quantity: String(quantity),
        price: String(price),
      });
    }

    // Actualizar total de la orden
    await db.update(orders)
      .set({ total: String(orderTotal) })
      .where(eq(orders.id, order.id));
    
    console.log(`   Added items to order ${order.code}, total: $${orderTotal.toFixed(2)}`);
    }
  }

  // 5. Crear Invoices a partir de Orders
  console.log('\n[3] Creando Invoices from Orders...');
  
  const existingInvoices = await db.select().from(invoices);
  const existingInvoiceCodes = new Set(existingInvoices.map(inv => inv.code));
  
  for (const order of createdOrders) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const orderCodePart = order.code.split('-').slice(-2).join('-'); // Get last 2 parts like "2026-0001"
    const invoiceCode = `INV-${orderCodePart}`;
    
    // Skip if invoice already exists
    if (existingInvoiceCodes.has(invoiceCode)) {
      console.log(`   Invoice ${invoiceCode} already exists, skipping`);
      continue;
    }
    
    // Calcular totales
    let totalBase = 0;
    let totalTax = 0;
    
    for (const item of items) {
      const itemBase = parseFloat(item.price) * parseInt(item.quantity);
      const itemTax = itemBase * 0.16;
      totalBase += itemBase;
      totalTax += itemTax;
    }
    
    const total = totalBase + totalTax;

    const [invoice] = await db.insert(invoices).values({
      id: uuidv7(),
      code: invoiceCode,
      partnerId: order.partnerId,
      branchId: order.branchId,
      currencyId: usd.id,
      exchangeRate: '1',
      type: 'SALE',
      invoiceNumber: `F-${invoiceCode}`,
      userId: order.userId,
      orderId: order.id,
      status: 'POSTED',
      fiscalStatus: 'APPROVED',
      totalBase: String(totalBase.toFixed(2)),
      totalTax: String(totalTax.toFixed(2)),
      totalIgtf: '0',
      total: String(total.toFixed(2)),
      date: new Date(),
      warehouseId: warehouse.id,
    }).returning();

    // Crear invoice items
    for (const item of items) {
      const itemBase = parseFloat(item.price) * parseInt(item.quantity);
      const itemTax = itemBase * 0.16;
      const itemTotal = itemBase + itemTax;

      await db.insert(invoiceItems).values({
        id: uuidv7(),
        invoiceId: invoice.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        taxRate: '16.00',
        total: String(itemTotal.toFixed(2)),
      });
    }

    // Decrementar stock
    for (const item of items) {
      const currentStock = await db.select().from(stock)
        .where(eq(stock.productId, item.productId))
        .limit(1);
      
      if (currentStock.length > 0) {
        const newQty = Math.max(0, parseFloat(currentStock[0].quantity) - parseInt(item.quantity));
        await db.update(stock)
          .set({ quantity: String(newQty) })
          .where(eq(stock.id, currentStock[0].id));
      }
    }

    console.log(`   Created invoice: ${invoice.code}, total: $${total.toFixed(2)}`);
  }

  // 6. Crear Payments (recibir pagos de algunas facturas)
  console.log('\n[4] Creando Payments...');
  
  const allInvoices = await db.select().from(invoices);
  const [paymentMethod] = await db.select().from(paymentMethods).limit(1);
  
  if (!paymentMethod) {
    // Crear metodo de pago si no existe
    const [newMethod] = await db.insert(paymentMethods).values({
      id: uuidv7(),
      name: 'Efectivo USD',
      code: 'CASH_USD',
      isDigital: false,
      branchId: freshBranch.id,
    }).returning();
    
    await db.insert(paymentMethods).values({
      id: uuidv7(),
      name: 'Transferencia USD',
      code: 'TRANSFER_USD',
      isDigital: true,
      branchId: freshBranch.id,
    }).returning();
    
    console.log('   Created payment methods');
  }

  const methods = await db.select().from(paymentMethods);
  const filteredCash = methods.filter(m => m.code.includes('CASH'));
  const cashMethod = filteredCash[0] || methods[0];

  const existingPayments = await db.select().from(payments);
  const existingPaymentCodes = new Set(existingPayments.map(p => p.code));

  for (let i = 0; i < Math.min(2, allInvoices.length); i++) {
    const invoice = allInvoices[i];
    const invoicePart = invoice.code.split('-').slice(-2).join('-');
    const paymentCode = `PAY-${invoicePart}`;
    
    if (existingPaymentCodes.has(paymentCode)) {
      console.log(`   Payment ${paymentCode} already exists, skipping`);
      continue;
    }
    
    const [payment] = await db.insert(payments).values({
      id: uuidv7(),
      code: paymentCode,
      invoiceId: invoice.id,
      partnerId: invoice.partnerId,
      branchId: invoice.branchId,
      methodId: cashMethod?.id || uuidv7(),
      status: 'POSTED',
      type: 'INCOME',
      amount: invoice.total,
      currencyId: invoice.currencyId,
      exchangeRate: invoice.exchangeRate,
      reference: `Ref-${paymentCode}`,
      date: new Date(),
      userId: adminUser.id,
    }).returning();

    // Crear allocation
    await db.insert(paymentAllocations).values({
      id: uuidv7(),
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount: invoice.total,
    });

    console.log(`   Created payment: ${payment.code}, amount: $${invoice.total}`);
  }

  // 7. Crear Accounting Entries para las facturas
  console.log('\n[5] Creando Accounting Entries...');
  
  // Obtener o crear cuentas contables
  const existingAccounts = await db.select().from(accountingAccounts).limit(5);
  
  if (existingAccounts.length < 3) {
    // Crear plan de cuentas basico
    await db.insert(accountingAccounts).values([
      { id: uuidv7(), code: '1.1.01', name: 'Caja', type: 'ASSET', isActive: true },
      { id: uuidv7(), code: '1.1.02', name: 'Bancos', type: 'ASSET', isActive: true },
      { id: uuidv7(), code: '1.2.01', name: 'Cuentas por Cobrar', type: 'ASSET', isActive: true },
      { id: uuidv7(), code: '4.1.01', name: 'Ventas', type: 'REVENUE', isActive: true },
      { id: uuidv7(), code: '5.1.01', name: 'Costo de Ventas', type: 'EXPENSE', isActive: true },
    ]);
    console.log('   Created basic chart of accounts');
  }

  // Crear accounting maps para INVOICE y PAYMENT
  const existingMaps = await db.select().from(accountingMaps).limit(10);
  if (existingMaps.length < 2) {
    const accounts = await db.select().from(accountingAccounts).limit(5);
    const ctaCaja = accounts.find(a => a.code === '1.1.01') || accounts[0];
    const ctaVentas = accounts.find(a => a.code === '4.1.01') || accounts[1];
    const ctaCxCobrar = accounts.find(a => a.code === '1.2.01') || accounts[2];

    await db.insert(accountingMaps).values([
      {
        id: uuidv7(),
        module: 'INVOICE',
        transactionType: 'SALE',
        debitAccountId: ctaCxCobrar?.id,
        creditAccountId: ctaVentas?.id,
        isActive: true,
      },
      {
        id: uuidv7(),
        module: 'PAYMENT',
        transactionType: 'INCOME',
        debitAccountId: ctaCaja?.id,
        creditAccountId: ctaCxCobrar?.id,
        isActive: true,
      },
    ]);
    console.log('   Created accounting maps for INVOICE and PAYMENT');
  }

  const accounts = await db.select().from(accountingAccounts).limit(5);
  const ctaCaja = accounts.find(a => a.code === '1.1.01') || accounts[0];
  const ctaVentas = accounts.find(a => a.code === '4.1.01') || accounts[1];
  const ctaCxCobrar = accounts.find(a => a.code === '1.2.01') || accounts[2];

  // Crear asiento para cada factura
  const existingEntries = await db.select().from(accountingEntries);
  const existingEntryRefs = new Set(existingEntries.map(e => e.reference));

  for (const invoice of allInvoices) {
    const entryCode = `JE-2026-${invoice.code.split('-').pop()}`;
    
    if (existingEntryRefs.has(invoice.code)) {
      console.log(`   Entry for invoice ${invoice.code} already exists, skipping`);
      continue;
    }
    
    const [entry] = await db.insert(accountingEntries).values({
      id: uuidv7(),
      date: invoice.date,
      description: `Venta ${invoice.code}`,
      reference: invoice.code,
      branchId: invoice.branchId,
      status: 'POSTED',
      userId: adminUser.id,
    }).returning();

    const totalBase = parseFloat(invoice.totalBase);
    const totalTax = parseFloat(invoice.totalTax);

    // Debito: Cuentas por Cobrar
    await db.insert(accountingEntryLines).values({
      id: uuidv7(),
      entryId: entry.id,
      accountId: ctaCxCobrar?.id || uuidv7(),
      debit: String(totalBase + totalTax),
      credit: '0',
      description: `${invoice.partnerId}`,
    });

    // Credito: Ventas
    await db.insert(accountingEntryLines).values({
      id: uuidv7(),
      entryId: entry.id,
      accountId: ctaVentas?.id || uuidv7(),
      debit: '0',
      credit: String(totalBase),
      description: 'Venta',
    });

    // Credito: IVA debitado fiscal
    await db.insert(accountingEntryLines).values({
      id: uuidv7(),
      entryId: entry.id,
      accountId: ctaVentas?.id || uuidv7(),
      debit: '0',
      credit: String(totalTax),
      description: 'IVA',
    });

    console.log(`   Created entry: ${entryCode} - Debit: ${(totalBase + totalTax).toFixed(2)}, Credit: ${(totalBase + totalTax).toFixed(2)}`);
  }

  // 8. Resumen
  console.log('\n' + '='.repeat(60));
  console.log('SEED BUSINESS FLOW COMPLETADO');
  console.log('='.repeat(60));
  
  const finalOrders = await db.select().from(orders);
  const finalInvoices = await db.select().from(invoices);
  const finalPayments = await db.select().from(payments);
  const finalEntries = await db.select().from(accountingEntries);
  
  console.log('\nResumen de datos creados:');
  console.log(`   Orders: ${finalOrders.length}`);
  console.log(`   Invoices: ${finalInvoices.length}`);
  console.log(`   Payments: ${finalPayments.length}`);
  console.log(`   Accounting Entries: ${finalEntries.length}`);
  
  // 9. Validaciones post-seed
  console.log('\n[6] Ejecutando validaciones post-seed...');
  
  // Validar que cada invoice tenga items
  for (const inv of finalInvoices) {
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
    if (items.length === 0) {
      console.log(`   ⚠️ Invoice ${inv.code} no tiene items`);
    }
  }
  
  // Validar que cada payment tenga allocation
  for (const pay of finalPayments) {
    const allocs = await db.select().from(paymentAllocations).where(eq(paymentAllocations.paymentId, pay.id));
    if (allocs.length === 0) {
      console.log(`   ⚠️ Payment ${pay.code} no tiene allocation`);
    }
  }
  
  // Validar partida doble
  for (const entry of finalEntries) {
    const lines = await db.select().from(accountingEntryLines).where(eq(accountingEntryLines.entryId, entry.id));
    const sumDebit = lines.reduce((sum, l) => sum + parseFloat(l.debit || '0'), 0);
    const sumCredit = lines.reduce((sum, l) => sum + parseFloat(l.credit || '0'), 0);
    if (Math.abs(sumDebit - sumCredit) > 0.01) {
      console.log(`   ❌ Entry ${entry.code} descuadrado: Debit=${sumDebit.toFixed(2)}, Credit=${sumCredit.toFixed(2)}`);
    }
  }

  console.log('\n✅ Seed business flow completado exitosamente!');
}

// Standalone execution
seedBusinessFlow()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
