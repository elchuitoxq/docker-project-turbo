import { describe, expect, it } from 'vitest';
import { testDb } from './database';
import {
  createTestBranch,
  createTestPartner,
  createTestProduct,
  createTestUser,
  ensureTestBaseCurrency,
} from './factories';
import { documentEvents } from '../schema';
import { eq } from 'drizzle-orm';
import { BillingService } from '../modules/billing/services/billing.service';
import { OrdersService } from '../modules/orders/orders.service';

/**
 * Histórico de procesos (`S-12`) contra Postgres real.
 *
 * El requisito es de negocio: el detalle debe contar **quién** hizo **qué** y **cuándo**, y la cadena
 * tiene que viajar desde el pedido hasta la facturación. Por eso la prueba recorre el flujo completo y
 * lo consulta desde los dos extremos.
 */
const billing = new BillingService();
const orders = new OrdersService();

function uniqueCode(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

describe('Histórico de procesos del documento', () => {
  it('recorre pedido → confirmación → facturación → emisión con autor y fecha en cada paso', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser({ name: 'Gerente de Prueba' });
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct();
    const base = await ensureTestBaseCurrency();

    const created = await orders.create(
      {
        code: uniqueCode('ORD-HIST'),
        partnerId: partner.id,
        type: 'SALE',
        currencyId: base.id,
        exchangeRate: 1,
        items: [{ productId: product.id, quantity: 2, price: 25 }],
      },
      branch.id,
      user.id
    );

    // 1. El pedido nace con su primer paso firmado.
    const createdDetail = await orders.findOneWithHistory(created.id, branch.id);
    expect(createdDetail.history).toHaveLength(1);
    expect(createdDetail.history?.[0]).toMatchObject({
      documentType: 'ORDER',
      documentId: created.id,
      documentCode: created.code,
      action: 'ORDER_CREATED',
      toStatus: 'DRAFT',
      userName: 'Gerente de Prueba',
    });
    expect(createdDetail.history?.[0].createdAt).toBeInstanceOf(Date);
    // El autor queda también en el documento: la ficha muestra "Registró".
    expect(createdDetail.createdByName).toBe('Gerente de Prueba');

    // 2. Confirmar agrega un paso nuevo, no reescribe el anterior.
    await orders.confirm(created.id, branch.id, user.id);
    const confirmed = await orders.findOneWithHistory(created.id, branch.id);
    expect(confirmed.history?.map(event => event.action)).toEqual([
      'ORDER_CREATED',
      'ORDER_CONFIRMED',
    ]);
    expect(confirmed.history?.[1]).toMatchObject({ fromStatus: 'DRAFT', toStatus: 'CONFIRMED' });

    // 3. Facturar crea la factura y deja constancia en el pedido.
    const invoiced = await orders.invoice(created.id, branch.id, user.id);
    const afterInvoice = await orders.findOneWithHistory(created.id, branch.id);
    expect(afterInvoice.history?.map(event => event.action)).toEqual([
      'ORDER_CREATED',
      'ORDER_CONFIRMED',
      'INVOICE_CREATED',
      'ORDER_INVOICED',
    ]);

    const invoiceEvent = afterInvoice.history?.find(event => event.action === 'INVOICE_CREATED');
    expect(invoiceEvent).toMatchObject({
      documentType: 'INVOICE',
      documentId: invoiced.invoiceId,
      documentCode: invoiced.invoiceCode,
      // El enlace con el pedido es lo que hace que la cadena se pueda leer desde la factura.
      parentDocumentId: created.id,
    });

    const orderInvoiced = afterInvoice.history?.find(event => event.action === 'ORDER_INVOICED');
    expect(orderInvoiced).toMatchObject({ fromStatus: 'CONFIRMED', toStatus: 'COMPLETED' });
    expect(orderInvoiced?.description).toContain(invoiced.invoiceCode);

    // 4. Emitir la factura cierra el flujo.
    await billing.post(invoiced.invoiceId, branch.id, user.id);
    const finalInvoice = await billing.findOneWithHistory(invoiced.invoiceId, branch.id);
    expect(finalInvoice.history?.map(event => event.action)).toEqual([
      'ORDER_CREATED',
      'ORDER_CONFIRMED',
      'INVOICE_CREATED',
      'ORDER_INVOICED',
      'INVOICE_POSTED',
    ]);
    expect(finalInvoice.history?.every(event => event.userName === 'Gerente de Prueba')).toBe(true);

    // 5. La factura ve el mismo histórico que el pedido: una sola cadena, no dos.
    const finalOrder = await orders.findOneWithHistory(created.id, branch.id);
    expect(finalInvoice.history?.map(event => event.id)).toEqual(
      finalOrder.history?.map(event => event.id)
    );

    // El orden es cronológico: el primer paso es el pedido y el último, la emisión.
    expect(finalInvoice.history?.[0].action).toBe('ORDER_CREATED');
    expect(finalInvoice.history?.at(-1)?.action).toBe('INVOICE_POSTED');
  });

  it('una factura sin pedido de origen sólo muestra sus propios pasos', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser({ name: 'Facturadora' });
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct();
    const base = await ensureTestBaseCurrency();

    const invoice = await billing.create(
      {
        partnerId: partner.id,
        currencyId: base.id,
        type: 'SALE',
        items: [{ productId: product.id, quantity: 1, price: 100 }],
      },
      user.id,
      branch.id
    );

    const detail = await billing.findOneWithHistory(invoice.id, branch.id);

    expect(detail.history).toHaveLength(1);
    expect(detail.history?.[0]).toMatchObject({
      action: 'INVOICE_CREATED',
      documentId: invoice.id,
      parentDocumentId: null,
      userName: 'Facturadora',
    });
  });

  it('la anulación guarda el motivo en el histórico', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser({ name: 'Supervisora' });
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct();
    const base = await ensureTestBaseCurrency();

    const invoice = await billing.create(
      {
        partnerId: partner.id,
        currencyId: base.id,
        type: 'SALE',
        items: [{ productId: product.id, quantity: 1, price: 50 }],
      },
      user.id,
      branch.id
    );
    await billing.post(invoice.id, branch.id, user.id);
    await billing.void(invoice.id, branch.id, user.id, 'Error en el precio');

    const detail = await billing.findOneWithHistory(invoice.id, branch.id);
    const voided = detail.history?.find(event => event.action === 'INVOICE_VOIDED');

    expect(voided).toMatchObject({
      fromStatus: 'POSTED',
      toStatus: 'VOID',
      userName: 'Supervisora',
      description: 'Factura anulada: Error en el precio',
    });
    expect(voided?.metadata).toMatchObject({ reason: 'Error en el precio' });
  });

  it('el histórico es append-only: cada acción deja una fila nueva', async () => {
    const branch = await createTestBranch();
    const user = await createTestUser();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const base = await ensureTestBaseCurrency();

    const order = await orders.create(
      {
        code: uniqueCode('ORD-APPEND'),
        partnerId: partner.id,
        type: 'SALE',
        currencyId: base.id,
        exchangeRate: 1,
        items: [],
      },
      branch.id,
      user.id
    );

    await orders.confirm(order.id, branch.id, user.id);
    await orders.cancel(order.id, branch.id, user.id);

    const rows = await testDb
      .select()
      .from(documentEvents)
      .where(eq(documentEvents.documentId, order.id));

    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.action).sort()).toEqual([
      'ORDER_CANCELLED',
      'ORDER_CONFIRMED',
      'ORDER_CREATED',
    ]);
  });
});
