import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestProduct,
  createTestUser,
  createTestWarehouse,
} from './factories';
import { inventoryMoves, productBatches, stock } from '../schema';
import { InventoryService } from '../modules/inventory/inventory.service';

/**
 * Despacho por lote (`S-26`).
 *
 * Tres reglas de almacén: un producto con lotes no sale sin lote, un lote vencido o bloqueado no se
 * despacha, y saltarse el FEFO exige autorización con motivo.
 */

const inventory = new InventoryService();

/** Fechas relativas para que la prueba no envejezca. */
function daysFromToday(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  return date;
}

async function scenario() {
  const branch = await createTestBranch();
  const user = await createTestUser();
  const product = await createTestProduct({ hasBatches: true, cost: '10.00' });
  const warehouse = await createTestWarehouse(branch.id);

  return { branch, user, product, warehouse };
}

/** Crea un lote con existencia directamente: es el estado en el que el almacén ya opera. */
async function batchWithStock(
  ctx: Awaited<ReturnType<typeof scenario>>,
  batchNumber: string,
  options: { daysToExpire?: number | null; isActive?: boolean; quantity?: string } = {}
) {
  const [batch] = await testDb
    .insert(productBatches)
    .values({
      productId: ctx.product.id,
      batchNumber,
      expirationDate:
        options.daysToExpire === null || options.daysToExpire === undefined
          ? null
          : daysFromToday(options.daysToExpire),
      isActive: options.isActive ?? true,
      cost: '10.00',
    })
    .returning();

  await testDb.insert(stock).values({
    warehouseId: ctx.warehouse.id,
    productId: ctx.product.id,
    batchId: batch.id,
    quantity: options.quantity ?? '10',
    updatedAt: new Date(),
  });

  return batch;
}

function dispatchPayload(
  ctx: Awaited<ReturnType<typeof scenario>>,
  batchId: string | null,
  extra: Record<string, unknown> = {}
) {
  return {
    type: 'SALIDA',
    fromWarehouseId: ctx.warehouse.id,
    lines: [
      {
        productId: ctx.product.id,
        quantity: '1',
        ...(batchId ? { batchId } : {}),
      },
    ],
    ...extra,
  } as never;
}

describe('Despacho por lote (S-26)', () => {
  it('un producto con lotes no sale sin lote', async () => {
    const ctx = await scenario();
    await batchWithStock(ctx, 'L-1');

    await expect(
      inventory.createMove(dispatchPayload(ctx, null), ctx.user.id, ctx.branch.id)
    ).rejects.toThrow(/maneja lotes: hay que indicar de qué lote sale/);
  });

  it('no despacha un lote vencido', async () => {
    const ctx = await scenario();
    const expired = await batchWithStock(ctx, 'L-VENCIDO', { daysToExpire: -1 });

    await expect(
      inventory.createMove(dispatchPayload(ctx, expired.id), ctx.user.id, ctx.branch.id)
    ).rejects.toThrow(/está vencido/);
  });

  it('despacha un lote que vence hoy: todavía no está vencido', async () => {
    const ctx = await scenario();
    const lastDay = await batchWithStock(ctx, 'L-ULTIMO-DIA', { daysToExpire: 0 });

    const move = await inventory.createMove(
      dispatchPayload(ctx, lastDay.id),
      ctx.user.id,
      ctx.branch.id
    );

    expect(move.status).toBe('EN_TRAMITE');
  });

  it('no despacha un lote bloqueado', async () => {
    const ctx = await scenario();
    const blocked = await batchWithStock(ctx, 'L-BLOQUEADO', { isActive: false });

    await expect(
      inventory.createMove(dispatchPayload(ctx, blocked.id), ctx.user.id, ctx.branch.id)
    ).rejects.toThrow(/está bloqueado/);
  });

  it('exige despachar primero el lote que vence antes', async () => {
    const ctx = await scenario();
    const first = await batchWithStock(ctx, 'L-ANTES', { daysToExpire: 10 });
    const later = await batchWithStock(ctx, 'L-DESPUES', { daysToExpire: 60 });

    await expect(
      inventory.createMove(dispatchPayload(ctx, later.id), ctx.user.id, ctx.branch.id)
    ).rejects.toThrow(new RegExp(`El lote ${first.batchNumber} vence antes`));

    const move = await inventory.createMove(
      dispatchPayload(ctx, first.id),
      ctx.user.id,
      ctx.branch.id
    );
    expect(move.status).toBe('EN_TRAMITE');
  });

  it('permite el despacho fuera de FEFO con motivo y lo deja registrado', async () => {
    const ctx = await scenario();
    await batchWithStock(ctx, 'L-ANTES', { daysToExpire: 10 });
    const later = await batchWithStock(ctx, 'L-DESPUES', { daysToExpire: 60 });

    const move = await inventory.createMove(
      dispatchPayload(ctx, later.id, {
        fefoOverride: true,
        fefoOverrideReason: 'El cliente exige este lote en la orden de compra',
      }),
      ctx.user.id,
      ctx.branch.id
    );

    const [stored] = await testDb
      .select()
      .from(inventoryMoves)
      .where(eq(inventoryMoves.id, move.id))
      .limit(1);

    expect(stored.fefoOverride).toBe(true);
    expect(stored.fefoOverrideReason).toMatch(/orden de compra/);
    expect(move.fefoOverride).toBe(true);
  });

  it('una autorización sin motivo no vale', async () => {
    const ctx = await scenario();
    await batchWithStock(ctx, 'L-ANTES', { daysToExpire: 10 });
    const later = await batchWithStock(ctx, 'L-DESPUES', { daysToExpire: 60 });

    await expect(
      inventory.createMove(
        dispatchPayload(ctx, later.id, { fefoOverride: true, fefoOverrideReason: '   ' }),
        ctx.user.id,
        ctx.branch.id
      )
    ).rejects.toThrow(/hay que indicar el motivo/);
  });

  it('el lote sugerido ignora vencidos y bloqueados', async () => {
    const ctx = await scenario();
    await batchWithStock(ctx, 'L-VENCIDO', { daysToExpire: -5 });
    await batchWithStock(ctx, 'L-BLOQUEADO', { isActive: false, daysToExpire: 5 });
    await batchWithStock(ctx, 'L-VALIDO', { daysToExpire: 30 });

    const batches = await inventory.findBatchesByProduct(ctx.product.id, ctx.warehouse.id);
    const valid = batches.find(batch => batch.batchNumber === 'L-VALIDO');

    expect(valid?.expired).toBe(false);
    expect(batches.find(batch => batch.batchNumber === 'L-VENCIDO')?.expired).toBe(true);
    expect(batches.find(batch => batch.batchNumber === 'L-BLOQUEADO')?.isActive).toBe(false);

    // El despacho del válido no exige autorización: no hay otro lote utilizable antes que él.
    const move = await inventory.createMove(
      dispatchPayload(ctx, valid!.id),
      ctx.user.id,
      ctx.branch.id
    );

    expect(move.fefoOverride).toBe(false);
  });

  it('una salida no afecta al resto de lotes al aprobarse', async () => {
    const ctx = await scenario();
    const first = await batchWithStock(ctx, 'L-ANTES', { daysToExpire: 10 });
    await batchWithStock(ctx, 'L-DESPUES', { daysToExpire: 60 });

    const move = await inventory.createMove(
      dispatchPayload(ctx, first.id),
      ctx.user.id,
      ctx.branch.id
    );

    await inventory.approveMove(move.id, ctx.user.id);

    const [remaining] = await testDb
      .select()
      .from(stock)
      .where(and(eq(stock.warehouseId, ctx.warehouse.id), eq(stock.batchId, first.id)));

    expect(Number(remaining.quantity)).toBe(9);
  });
});
