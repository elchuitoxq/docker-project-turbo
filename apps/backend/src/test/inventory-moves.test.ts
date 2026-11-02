import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestProduct,
  createTestUser,
  createTestWarehouse,
} from './factories';
import { inventoryMoves, stock } from '../schema';
import { InventoryService } from '../modules/inventory/inventory.service';

/**
 * Movimientos de inventario (`S-23`).
 *
 * El alta existía en el API pero no tenía formulario, y el tipo `AJUSTE` que la interfaz ofrecía no
 * estaba soportado por el backend. Estas pruebas fijan el efecto de cada tipo sobre el stock.
 */

const inventory = new InventoryService();

async function scenario() {
  const branch = await createTestBranch();
  const user = await createTestUser();
  // Un ajuste fuera de tolerancia no lo puede aprobar quien lo registró (`S-25`).
  const supervisor = await createTestUser();
  const product = await createTestProduct({ hasBatches: false });
  const origin = await createTestWarehouse(branch.id);
  const destination = await createTestWarehouse(branch.id);

  return { branch, user, supervisor, product, origin, destination };
}

async function stockOf(warehouseId: string, productId: string): Promise<number> {
  const [row] = await testDb
    .select()
    .from(stock)
    .where(and(eq(stock.warehouseId, warehouseId), eq(stock.productId, productId)))
    .limit(1);

  return Number(row?.quantity ?? 0);
}

async function apply(
  overrides: {
    type: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    quantity?: string;
  },
  ctx: Awaited<ReturnType<typeof scenario>>
) {
  const move = await inventory.createMove(
    {
      type: overrides.type,
      ...(overrides.fromWarehouseId ? { fromWarehouseId: overrides.fromWarehouseId } : {}),
      ...(overrides.toWarehouseId ? { toWarehouseId: overrides.toWarehouseId } : {}),
      ...(overrides.type === 'AJUSTE' ? { reasonCode: 'CONTEO' } : {}),
      lines: [
        {
          productId: ctx.product.id,
          quantity: overrides.quantity ?? '10',
          cost: '100',
        },
      ],
    } as never,
    ctx.user.id,
    ctx.branch.id
  );

  // El ajuste por conteo casi siempre se sale de la tolerancia: se aprueba con otra persona.
  await inventory.approveMove(move.id, ctx.supervisor.id);
  return move;
}

describe('Movimientos de inventario (S-23)', () => {
  it('una entrada suma stock en el almacén de destino', async () => {
    const ctx = await scenario();

    const move = await apply({ type: 'ENTRADA', toWarehouseId: ctx.destination.id }, ctx);

    expect(move.type).toBe('ENTRADA');
    expect(await stockOf(ctx.destination.id, ctx.product.id)).toBe(10);
  });

  it('una salida resta stock del almacén de origen', async () => {
    const ctx = await scenario();
    await apply({ type: 'ENTRADA', toWarehouseId: ctx.origin.id, quantity: '15' }, ctx);

    await apply({ type: 'SALIDA', fromWarehouseId: ctx.origin.id, quantity: '5' }, ctx);

    expect(await stockOf(ctx.origin.id, ctx.product.id)).toBe(10);
  });

  it('una transferencia mueve la cantidad entre almacenes', async () => {
    const ctx = await scenario();
    await apply({ type: 'ENTRADA', toWarehouseId: ctx.origin.id, quantity: '8' }, ctx);

    await apply(
      {
        type: 'TRANSFERENCIA',
        fromWarehouseId: ctx.origin.id,
        toWarehouseId: ctx.destination.id,
        quantity: '3',
      },
      ctx
    );

    expect(await stockOf(ctx.origin.id, ctx.product.id)).toBe(5);
    expect(await stockOf(ctx.destination.id, ctx.product.id)).toBe(3);
  });

  it('un ajuste deja el stock en la cantidad contada, hacia arriba y hacia abajo', async () => {
    const ctx = await scenario();
    await apply({ type: 'ENTRADA', toWarehouseId: ctx.origin.id, quantity: '10' }, ctx);

    // Conteo físico dice 25: sube 15.
    await apply({ type: 'AJUSTE', fromWarehouseId: ctx.origin.id, quantity: '25' }, ctx);
    expect(await stockOf(ctx.origin.id, ctx.product.id)).toBe(25);

    // Conteo físico dice 4: baja 21.
    await apply({ type: 'AJUSTE', fromWarehouseId: ctx.origin.id, quantity: '4' }, ctx);
    expect(await stockOf(ctx.origin.id, ctx.product.id)).toBe(4);
  });

  it('un ajuste a la misma cantidad no altera el stock', async () => {
    const ctx = await scenario();
    await apply({ type: 'ENTRADA', toWarehouseId: ctx.origin.id, quantity: '6' }, ctx);

    await apply({ type: 'AJUSTE', fromWarehouseId: ctx.origin.id, quantity: '6' }, ctx);

    expect(await stockOf(ctx.origin.id, ctx.product.id)).toBe(6);
  });

  it('rechaza un ajuste sin almacén y un movimiento sin líneas', async () => {
    const ctx = await scenario();

    await expect(
      inventory.createMove({ type: 'AJUSTE', lines: [] } as never, ctx.user.id, ctx.branch.id)
    ).rejects.toThrow(/fromWarehouseId is required for AJUSTE/);

    await expect(
      inventory.createMove(
        { type: 'ENTRADA', toWarehouseId: ctx.origin.id, lines: [] } as never,
        ctx.user.id,
        ctx.branch.id
      )
    ).rejects.toThrow(/al menos una línea/);
  });

  it('el movimiento nace en borrador y sólo mueve stock al aprobarse', async () => {
    const ctx = await scenario();

    const move = await inventory.createMove(
      {
        type: 'ENTRADA',
        toWarehouseId: ctx.origin.id,
        lines: [{ productId: ctx.product.id, quantity: '7', cost: '100' }],
      } as never,
      ctx.user.id,
      ctx.branch.id
    );

    expect(move.status).toBe('EN_TRAMITE');
    expect(await stockOf(ctx.origin.id, ctx.product.id)).toBe(0);

    await inventory.approveMove(move.id, ctx.user.id);

    expect(await stockOf(ctx.origin.id, ctx.product.id)).toBe(7);

    const [stored] = await testDb
      .select()
      .from(inventoryMoves)
      .where(eq(inventoryMoves.id, move.id));

    expect(stored.status).toBe('APPROVED');
  });
});
