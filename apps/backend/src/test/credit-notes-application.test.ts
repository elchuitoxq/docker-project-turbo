import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { and, desc, eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestInvoice,
  createTestInvoiceItem,
  createTestPartner,
  createTestProduct,
  createTestUser,
  createTestWarehouse,
  ensureTestBaseCurrency,
} from './factories';
import { creditNoteUsages, creditNotes, documentLinks, inventoryMoves, stock } from '../schema';
import { CreditNotesService } from '../modules/credit-notes/credit-notes.service';
import { InventoryService } from '../modules/inventory/inventory.service';
import { BillingService } from '../modules/billing/services/billing.service';
import { computeInvoiceBalance } from '../modules/billing/purchasing/invoice-balance';

/**
 * Notas de crédito y devoluciones (`T-03-07`).
 *
 * Reglas certificadas aquí:
 *   1. Emitir una devolución de cliente genera la `ENTRADA` de inventario en borrador, sin mover
 *      stock hasta que el almacén la apruebe.
 *   2. Aplicar una nota no inventa un pago (antes chocaba con la FK de `payment_methods`) y deja el
 *      uso contra la factura.
 *   3. Una nota sin factura de origen descuenta el saldo al aplicarse; una con factura, al emitirse.
 *   4. Anular una nota aplicada devuelve el saldo y es el paso previo para anular la factura.
 */
describe('Notas de crédito y devoluciones', () => {
  const credit = new CreditNotesService();
  const inventory = new InventoryService();
  const billing = new BillingService();

  async function scenario(total = 100) {
    const branch = await createTestBranch();
    const user = await createTestUser();
    const partner = await createTestPartner({ type: 'CUSTOMER' });
    const product = await createTestProduct({ hasBatches: false });
    const warehouse = await createTestWarehouse(branch.id);
    const currency = await ensureTestBaseCurrency();

    const invoice = await createTestInvoice(partner.id, branch.id, currency.id, {
      status: 'POSTED',
      totalBase: String(total),
      total: String(total),
      warehouseId: warehouse.id,
    });
    await createTestInvoiceItem(invoice.id, product.id, {
      quantity: '1',
      price: String(total),
      total: String(total),
    });

    return { branch, user, partner, product, warehouse, currency, invoice };
  }

  async function stockOf(warehouseId: string, productId: string): Promise<number> {
    const [row] = await testDb
      .select()
      .from(stock)
      .where(and(eq(stock.warehouseId, warehouseId), eq(stock.productId, productId)))
      .limit(1);

    return Number(row?.quantity ?? 0);
  }

  async function returnMoveOf(creditNoteId: string) {
    const [link] = await testDb
      .select()
      .from(documentLinks)
      .where(
        and(eq(documentLinks.sourceId, creditNoteId), eq(documentLinks.sourceTable, 'CREDIT_NOTE'))
      )
      .limit(1);

    if (!link) return null;

    const [move] = await testDb
      .select()
      .from(inventoryMoves)
      .where(eq(inventoryMoves.id, link.targetId))
      .limit(1);

    return move ?? null;
  }

  it('emitir una devolución de cliente crea la entrada de inventario en borrador', async () => {
    const ctx = await scenario();

    const note = await credit.create(
      {
        invoiceId: ctx.invoice.id,
        partnerId: ctx.partner.id,
        currencyId: ctx.currency.id,
        exchangeRate: 1,
        type: 'SALE',
        warehouseId: ctx.warehouse.id,
        items: [{ productId: ctx.product.id, quantity: 1, price: 100 }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );

    await credit.post(note.id, ctx.branch.id, ctx.user.id);

    const move = await returnMoveOf(note.id);
    expect(move?.type).toBe('ENTRADA');
    expect(move?.status).toBe('EN_TRAMITE');
    expect(move?.toWarehouseId).toBe(ctx.warehouse.id);

    // El documento nace en borrador: el stock no se mueve hasta que el almacén lo aprueba.
    expect(await stockOf(ctx.warehouse.id, ctx.product.id)).toBe(0);

    await inventory.approveMove(move!.id, ctx.user.id);
    expect(await stockOf(ctx.warehouse.id, ctx.product.id)).toBe(1);

    // La nota asociada a la factura la acredita al emitirse.
    const balance = await computeInvoiceBalance(ctx.invoice.id);
    expect(balance?.credited).toBeCloseTo(100, 2);
  });

  it('una devolución sin almacén no se puede emitir', async () => {
    const ctx = await scenario();

    const note = await credit.create(
      {
        invoiceId: ctx.invoice.id,
        partnerId: ctx.partner.id,
        currencyId: ctx.currency.id,
        exchangeRate: 1,
        type: 'SALE',
        items: [{ productId: ctx.product.id, quantity: 1, price: 100 }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );

    await expect(credit.post(note.id, ctx.branch.id, ctx.user.id)).rejects.toThrow(
      BadRequestException
    );
  });

  it('aplicar una nota sin factura de origen descuenta el saldo sin inventar un pago', async () => {
    const ctx = await scenario(100);

    const note = await credit.create(
      {
        partnerId: ctx.partner.id,
        currencyId: ctx.currency.id,
        exchangeRate: 1,
        type: 'SALE',
        warehouseId: ctx.warehouse.id,
        items: [{ productId: ctx.product.id, quantity: 1, price: 40 }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );

    await credit.post(note.id, ctx.branch.id, ctx.user.id);

    // Sin factura de origen no acredita nada hasta aplicarse.
    expect((await computeInvoiceBalance(ctx.invoice.id))?.credited).toBeCloseTo(0, 2);

    const result = await credit.apply(
      note.id,
      ctx.invoice.id,
      { amount: 40 } as never,
      ctx.branch.id
    );
    expect(result.remainingAvailableAmount).toBeCloseTo(0, 2);

    const [usage] = await testDb
      .select()
      .from(creditNoteUsages)
      .where(eq(creditNoteUsages.creditNoteId, note.id));

    expect(usage.invoiceId).toBe(ctx.invoice.id);
    expect(usage.paymentId).toBeNull();
    expect((await computeInvoiceBalance(ctx.invoice.id))?.credited).toBeCloseTo(40, 2);
  });

  it('aplicar una nota que ya acreditó su factura no duplica el crédito', async () => {
    const ctx = await scenario(100);

    const note = await credit.create(
      {
        invoiceId: ctx.invoice.id,
        partnerId: ctx.partner.id,
        currencyId: ctx.currency.id,
        exchangeRate: 1,
        type: 'SALE',
        warehouseId: ctx.warehouse.id,
        items: [{ productId: ctx.product.id, quantity: 1, price: 100 }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );
    await credit.post(note.id, ctx.branch.id, ctx.user.id);

    const before = await computeInvoiceBalance(ctx.invoice.id);
    expect(before?.credited).toBeCloseTo(100, 2);

    const result = await credit.apply(
      note.id,
      ctx.invoice.id,
      { amount: 100 } as never,
      ctx.branch.id
    );
    expect(result.remainingAvailableAmount).toBeCloseTo(0, 2);

    const after = await computeInvoiceBalance(ctx.invoice.id);
    expect(after?.credited).toBeCloseTo(100, 2);
    expect(after?.balance).toBeCloseTo(before?.balance ?? 0, 2);
  });

  it('no permite aplicar más que el saldo de la factura', async () => {
    const ctx = await scenario(100);

    const note = await credit.create(
      {
        partnerId: ctx.partner.id,
        currencyId: ctx.currency.id,
        exchangeRate: 1,
        type: 'SALE',
        warehouseId: ctx.warehouse.id,
        items: [{ productId: ctx.product.id, quantity: 1, price: 200 }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );
    await credit.post(note.id, ctx.branch.id, ctx.user.id);

    await expect(
      credit.apply(note.id, ctx.invoice.id, { amount: 150 } as never, ctx.branch.id)
    ).rejects.toThrow(BadRequestException);
  });

  it('anular una nota aplicada libera el crédito y permite anular la factura', async () => {
    const ctx = await scenario(100);

    const note = await credit.create(
      {
        partnerId: ctx.partner.id,
        currencyId: ctx.currency.id,
        exchangeRate: 1,
        type: 'SALE',
        warehouseId: ctx.warehouse.id,
        items: [{ productId: ctx.product.id, quantity: 1, price: 40 }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );
    await credit.post(note.id, ctx.branch.id, ctx.user.id);
    await credit.apply(note.id, ctx.invoice.id, { amount: 40 } as never, ctx.branch.id);

    const [applied] = await testDb.select().from(creditNotes).where(eq(creditNotes.id, note.id));
    expect(applied.status).toBe('APPLIED');

    await credit.void(note.id, ctx.branch.id, ctx.user.id);

    const usages = await testDb
      .select()
      .from(creditNoteUsages)
      .where(eq(creditNoteUsages.creditNoteId, note.id));
    expect(usages).toHaveLength(0);
    expect((await computeInvoiceBalance(ctx.invoice.id))?.credited).toBeCloseTo(0, 2);

    const voided = await billing.void(
      ctx.invoice.id,
      ctx.branch.id,
      ctx.user.id,
      'Devolución total'
    );
    expect(voided.status).toBe('VOID');
  });

  it('no anula una factura que tiene una nota de crédito vigente', async () => {
    const ctx = await scenario(100);

    const note = await credit.create(
      {
        invoiceId: ctx.invoice.id,
        partnerId: ctx.partner.id,
        currencyId: ctx.currency.id,
        exchangeRate: 1,
        type: 'SALE',
        warehouseId: ctx.warehouse.id,
        items: [{ productId: ctx.product.id, quantity: 1, price: 100 }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );
    await credit.post(note.id, ctx.branch.id, ctx.user.id);

    await expect(
      billing.void(ctx.invoice.id, ctx.branch.id, ctx.user.id, 'Intento')
    ).rejects.toThrow(ConflictException);
  });

  it('anular la nota rechaza la entrada de inventario que sigue en borrador', async () => {
    const ctx = await scenario(100);

    const note = await credit.create(
      {
        invoiceId: ctx.invoice.id,
        partnerId: ctx.partner.id,
        currencyId: ctx.currency.id,
        exchangeRate: 1,
        type: 'SALE',
        warehouseId: ctx.warehouse.id,
        items: [{ productId: ctx.product.id, quantity: 1, price: 100 }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );
    await credit.post(note.id, ctx.branch.id, ctx.user.id);

    await credit.void(note.id, ctx.branch.id, ctx.user.id);

    const move = await returnMoveOf(note.id);
    expect(move?.status).toBe('REJECTED');
    expect(await stockOf(ctx.warehouse.id, ctx.product.id)).toBe(0);
  });

  it('si el almacén ya aprobó la devolución, la anulación emite una salida compensatoria', async () => {
    const ctx = await scenario(100);

    const note = await credit.create(
      {
        invoiceId: ctx.invoice.id,
        partnerId: ctx.partner.id,
        currencyId: ctx.currency.id,
        exchangeRate: 1,
        type: 'SALE',
        warehouseId: ctx.warehouse.id,
        items: [{ productId: ctx.product.id, quantity: 1, price: 100 }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );
    await credit.post(note.id, ctx.branch.id, ctx.user.id);

    const move = await returnMoveOf(note.id);
    await inventory.approveMove(move!.id, ctx.user.id);
    expect(await stockOf(ctx.warehouse.id, ctx.product.id)).toBe(1);

    await credit.void(note.id, ctx.branch.id, ctx.user.id);

    const [compensation] = await testDb
      .select()
      .from(inventoryMoves)
      .where(
        and(
          eq(inventoryMoves.source, 'CREDIT_NOTE'),
          eq(inventoryMoves.type, 'SALIDA'),
          eq(inventoryMoves.branchId, ctx.branch.id)
        )
      )
      .orderBy(desc(inventoryMoves.date))
      .limit(1);

    expect(compensation?.status).toBe('EN_TRAMITE');
    // El kardex no se reescribe: el stock sigue arriba hasta que se apruebe la salida.
    expect(await stockOf(ctx.warehouse.id, ctx.product.id)).toBe(1);
  });
});
