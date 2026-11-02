import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestProduct,
  createTestUser,
  createTestWarehouse,
} from './factories';
import { inventoryBatchReservations, productBatches, stock } from '../schema';
import { InventoryService } from '../modules/inventory/inventory.service';

/**
 * Reserva de lote y bloqueo automático por vencimiento (`S-26`, deuda cerrada).
 *
 * Una salida en borrador aparta la existencia que promete; dos documentos simultáneos no pueden
 * prometer el mismo lote. El bloqueo diario marca los vencidos sin esperar a que alguien lo haga a mano.
 */

const inventory = new InventoryService();

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

async function batchWithStock(
  ctx: Awaited<ReturnType<typeof scenario>>,
  batchNumber: string,
  options: { daysToExpire?: number | null; quantity?: string } = {}
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
      isActive: true,
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

function dispatch(
  ctx: Awaited<ReturnType<typeof scenario>>,
  batchId: string,
  quantity: string,
  extra: Record<string, unknown> = {}
) {
  return {
    type: 'SALIDA',
    fromWarehouseId: ctx.warehouse.id,
    lines: [{ productId: ctx.product.id, batchId, quantity }],
    ...extra,
  } as never;
}

async function reservationsOf(moveId: string) {
  return testDb
    .select()
    .from(inventoryBatchReservations)
    .where(eq(inventoryBatchReservations.moveId, moveId));
}

describe('Reserva de lote (S-26)', () => {
  it('dos salidas simultáneas no prometen la misma existencia', async () => {
    const ctx = await scenario();
    const batch = await batchWithStock(ctx, 'L-UNICO', { quantity: '10' });

    const first = await inventory.createMove(
      dispatch(ctx, batch.id, '6'),
      ctx.user.id,
      ctx.branch.id
    );

    await expect(
      inventory.createMove(dispatch(ctx, batch.id, '5'), ctx.user.id, ctx.branch.id)
    ).rejects.toThrow(/disponible 4, solicitado 5/);

    // Al rechazar el primero, la mercancía vuelve a estar disponible para el segundo.
    await inventory.rejectMove(first.id, { reason: 'Se canceló el despacho' });

    const second = await inventory.createMove(
      dispatch(ctx, batch.id, '5'),
      ctx.user.id,
      ctx.branch.id
    );
    expect(second.status).toBe('EN_TRAMITE');
  });

  it('al aprobar libera la reserva porque el stock ya bajó', async () => {
    const ctx = await scenario();
    const batch = await batchWithStock(ctx, 'L-APROBADO', { quantity: '10' });

    const move = await inventory.createMove(
      dispatch(ctx, batch.id, '4'),
      ctx.user.id,
      ctx.branch.id
    );

    const [active] = await reservationsOf(move.id);
    expect(active.status).toBe('ACTIVE');

    await inventory.approveMove(move.id, ctx.user.id);

    const [released] = await reservationsOf(move.id);
    expect(released.status).toBe('RELEASED');
    expect(released.releasedAt).not.toBeNull();

    const [remaining] = await testDb
      .select()
      .from(stock)
      .where(and(eq(stock.warehouseId, ctx.warehouse.id), eq(stock.batchId, batch.id)));
    expect(Number(remaining.quantity)).toBe(6);
  });

  it('la sugerencia FEFO ignora el lote que ya está reservado por completo', async () => {
    const ctx = await scenario();
    const first = await batchWithStock(ctx, 'L-ANTES', { daysToExpire: 10, quantity: '5' });
    const later = await batchWithStock(ctx, 'L-DESPUES', { daysToExpire: 60, quantity: '5' });

    await inventory.createMove(dispatch(ctx, first.id, '5'), ctx.user.id, ctx.branch.id);

    // L-ANTES no tiene existencia disponible: L-DESPUES pasa a ser el sugerido y no exige excepción.
    const move = await inventory.createMove(
      dispatch(ctx, later.id, '1'),
      ctx.user.id,
      ctx.branch.id
    );

    expect(move.fefoOverride).toBe(false);
  });

  it('el catálogo de lotes expone lo reservado y lo disponible', async () => {
    const ctx = await scenario();
    const batch = await batchWithStock(ctx, 'L-CATALOGO', { quantity: '10' });

    await inventory.createMove(dispatch(ctx, batch.id, '3'), ctx.user.id, ctx.branch.id);

    const batches = await inventory.findBatchesByProduct(ctx.product.id, ctx.warehouse.id);
    const row = batches.find(item => item.id === batch.id);

    expect(row?.reservedQuantity).toBe('3');
    expect(row?.availableQuantity).toBe('7');
  });
});

describe('Bloqueo automático de lotes vencidos (S-26)', () => {
  it('bloquea los vencidos y deja pasar el que vence hoy y el futuro', async () => {
    const ctx = await scenario();
    const expired = await batchWithStock(ctx, 'L-VENCIDO', { daysToExpire: -1 });
    const lastDay = await batchWithStock(ctx, 'L-VENCE-HOY', { daysToExpire: 0 });
    const future = await batchWithStock(ctx, 'L-FUTURO', { daysToExpire: 30 });

    const result = await inventory.blockExpiredBatches(new Date(), [ctx.product.id]);

    expect(result.blocked.some(batch => batch.id === expired.id)).toBe(true);

    const rows = await testDb
      .select()
      .from(productBatches)
      .where(eq(productBatches.productId, ctx.product.id));
    const byId = new Map(rows.map(row => [row.id, row.isActive]));

    expect(byId.get(expired.id)).toBe(false);
    expect(byId.get(lastDay.id)).toBe(true);
    expect(byId.get(future.id)).toBe(true);
  });

  it('es idempotente: no vuelve a reportar lo ya bloqueado', async () => {
    const ctx = await scenario();
    const batch = await batchWithStock(ctx, 'L-VENCIDO', { daysToExpire: -3 });

    const first = await inventory.blockExpiredBatches(new Date(), [ctx.product.id]);
    expect(first.blocked.some(item => item.id === batch.id)).toBe(true);

    const second = await inventory.blockExpiredBatches(new Date(), [ctx.product.id]);
    expect(second.blocked.some(item => item.id === batch.id)).toBe(false);
  });
});
