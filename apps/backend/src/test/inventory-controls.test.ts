import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb } from './database';
import {
  createTestBranch,
  createTestProduct,
  createTestUser,
  createTestWarehouse,
} from './factories';
import { inventoryMoveLines, inventoryMoves, productBatches, products, stock } from '../schema';
import { InventoryService } from '../modules/inventory/inventory.service';

/**
 * Controles de inventario (`S-25`): motivo del ajuste, segunda aprobación fuera de tolerancia, lotes
 * con FEFO, costo promedio móvil y aprobación en lote.
 *
 * El almacén conserva el permiso de aprobación (es el maestro de ese rol). El control no se resuelve
 * quitando el permiso sino exigiendo motivo y escalando a otra persona cuando la diferencia es grande,
 * igual que la tolerancia de conteo de SAP.
 */

const inventory = new InventoryService();

async function scenario(productData: Record<string, unknown> = {}) {
  const branch = await createTestBranch();
  const creator = await createTestUser();
  const supervisor = await createTestUser();
  const product = await createTestProduct({ hasBatches: false, ...productData });
  const warehouse = await createTestWarehouse(branch.id);

  return { branch, creator, supervisor, product, warehouse };
}

async function stockOf(warehouseId: string, productId: string, batchId?: string) {
  const [row] = await testDb
    .select()
    .from(stock)
    .where(
      batchId
        ? and(
            eq(stock.warehouseId, warehouseId),
            eq(stock.productId, productId),
            eq(stock.batchId, batchId)
          )
        : and(eq(stock.warehouseId, warehouseId), eq(stock.productId, productId))
    )
    .limit(1);

  return Number(row?.quantity ?? 0);
}

async function productCost(productId: string) {
  const [row] = await testDb.select().from(products).where(eq(products.id, productId)).limit(1);
  return Number(row?.cost ?? 0);
}

async function enterStock(
  ctx: Awaited<ReturnType<typeof scenario>>,
  quantity: string,
  cost?: string
) {
  const move = await inventory.createMove(
    {
      type: 'ENTRADA',
      toWarehouseId: ctx.warehouse.id,
      lines: [{ productId: ctx.product.id, quantity, ...(cost ? { cost } : {}) }],
    } as never,
    ctx.creator.id,
    ctx.branch.id
  );

  await inventory.approveMove(move.id, ctx.creator.id);
  return move;
}

describe('Ajustes de inventario con motivo y tolerancia (S-25)', () => {
  it('exige motivo en un ajuste', async () => {
    const ctx = await scenario();

    await expect(
      inventory.createMove(
        {
          type: 'AJUSTE',
          fromWarehouseId: ctx.warehouse.id,
          lines: [{ productId: ctx.product.id, quantity: '5' }],
        } as never,
        ctx.creator.id,
        ctx.branch.id
      )
    ).rejects.toThrow(/motivo \(reasonCode\)/);
  });

  it('rechaza un motivo que no está en el catálogo', async () => {
    const ctx = await scenario();

    await expect(
      inventory.createMove(
        {
          type: 'AJUSTE',
          fromWarehouseId: ctx.warehouse.id,
          reasonCode: 'CAPRICHO',
          lines: [{ productId: ctx.product.id, quantity: '5' }],
        } as never,
        ctx.creator.id,
        ctx.branch.id
      )
    ).rejects.toThrow(/Motivo de ajuste inválido/);
  });

  it('una diferencia dentro de la tolerancia la aprueba el mismo usuario', async () => {
    const ctx = await scenario();
    await enterStock(ctx, '100');

    const move = await inventory.createMove(
      {
        type: 'AJUSTE',
        fromWarehouseId: ctx.warehouse.id,
        reasonCode: 'CONTEO',
        lines: [{ productId: ctx.product.id, quantity: '105' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    expect(move.requiresSecondApproval).toBe(false);

    await inventory.approveMove(move.id, ctx.creator.id);
    expect(await stockOf(ctx.warehouse.id, ctx.product.id)).toBe(105);
  });

  it('una diferencia fuera de la tolerancia la tiene que aprobar otra persona', async () => {
    const ctx = await scenario();
    await enterStock(ctx, '100');

    const move = await inventory.createMove(
      {
        type: 'AJUSTE',
        fromWarehouseId: ctx.warehouse.id,
        reasonCode: 'HURTO',
        lines: [{ productId: ctx.product.id, quantity: '50' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    expect(move.requiresSecondApproval).toBe(true);

    await expect(inventory.approveMove(move.id, ctx.creator.id)).rejects.toThrow(
      /no puede aprobarlo quien lo registró/
    );

    await inventory.approveMove(move.id, ctx.supervisor.id);
    expect(await stockOf(ctx.warehouse.id, ctx.product.id)).toBe(50);
  });

  it('dar de alta stock que no existía siempre pide segunda aprobación', async () => {
    const ctx = await scenario();

    const move = await inventory.createMove(
      {
        type: 'AJUSTE',
        fromWarehouseId: ctx.warehouse.id,
        reasonCode: 'CONTEO',
        lines: [{ productId: ctx.product.id, quantity: '40' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    expect(move.requiresSecondApproval).toBe(true);
  });

  it('guarda el motivo en el movimiento para poder auditarlo', async () => {
    const ctx = await scenario();

    const move = await inventory.createMove(
      {
        type: 'AJUSTE',
        fromWarehouseId: ctx.warehouse.id,
        reasonCode: 'VENCIMIENTO',
        lines: [{ productId: ctx.product.id, quantity: '0' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    const [stored] = await testDb
      .select()
      .from(inventoryMoves)
      .where(eq(inventoryMoves.id, move.id))
      .limit(1);

    expect(stored.reasonCode).toBe('VENCIMIENTO');
  });
});

describe('Lotes por producto (S-25)', () => {
  it('la recepción crea el lote cuando llega sólo el número', async () => {
    const ctx = await scenario({ hasBatches: true });

    const move = await inventory.createMove(
      {
        type: 'ENTRADA',
        toWarehouseId: ctx.warehouse.id,
        lines: [
          {
            productId: ctx.product.id,
            quantity: '12',
            cost: '100',
            batchNumber: 'L-2026-001',
            batchExpirationDate: '2027-01-31',
          },
        ],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    const [line] = await testDb
      .select()
      .from(inventoryMoveLines)
      .where(eq(inventoryMoveLines.moveId, move.id))
      .limit(1);

    expect(line.batchId).toBeTruthy();

    await inventory.approveMove(move.id, ctx.creator.id);
    expect(await stockOf(ctx.warehouse.id, ctx.product.id, line.batchId!)).toBe(12);

    const [batch] = await testDb
      .select()
      .from(productBatches)
      .where(eq(productBatches.id, line.batchId!))
      .limit(1);

    expect(batch.batchNumber).toBe('L-2026-001');
    expect(batch.expirationDate).not.toBeNull();
  });

  it('reutiliza el lote existente en lugar de duplicarlo', async () => {
    const ctx = await scenario({ hasBatches: true });

    await inventory.createMove(
      {
        type: 'ENTRADA',
        toWarehouseId: ctx.warehouse.id,
        lines: [{ productId: ctx.product.id, quantity: '5', batchNumber: 'L-REPETIDO' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    await inventory.createMove(
      {
        type: 'ENTRADA',
        toWarehouseId: ctx.warehouse.id,
        lines: [{ productId: ctx.product.id, quantity: '5', batchNumber: 'L-REPETIDO' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    const batches = await testDb
      .select()
      .from(productBatches)
      .where(eq(productBatches.productId, ctx.product.id));

    expect(batches).toHaveLength(1);
  });

  it('una salida con un lote inexistente es un error de captura', async () => {
    const ctx = await scenario({ hasBatches: true });

    await expect(
      inventory.createMove(
        {
          type: 'SALIDA',
          fromWarehouseId: ctx.warehouse.id,
          lines: [{ productId: ctx.product.id, quantity: '1', batchNumber: 'NO-EXISTE' }],
        } as never,
        ctx.creator.id,
        ctx.branch.id
      )
    ).rejects.toThrow(/no existe para el producto/);
  });

  it('ordena los lotes por FEFO y expone la existencia del almacén', async () => {
    const ctx = await scenario({ hasBatches: true });

    for (const [number, expiration, quantity] of [
      ['L-SIN-VENCER', '2028-12-31', '3'],
      ['L-VENCE-PRONTO', '2026-06-30', '7'],
    ] as const) {
      const move = await inventory.createMove(
        {
          type: 'ENTRADA',
          toWarehouseId: ctx.warehouse.id,
          lines: [
            {
              productId: ctx.product.id,
              quantity,
              batchNumber: number,
              batchExpirationDate: expiration,
            },
          ],
        } as never,
        ctx.creator.id,
        ctx.branch.id
      );

      await inventory.approveMove(move.id, ctx.creator.id);
    }

    const batches = await inventory.findBatchesByProduct(ctx.product.id, ctx.warehouse.id);

    expect(batches.map(batch => batch.batchNumber)).toEqual(['L-VENCE-PRONTO', 'L-SIN-VENCER']);
    expect(Number(batches[0].availableQuantity)).toBe(7);
    expect(Number(batches[1].availableQuantity)).toBe(3);
  });

  it('no deja crear dos veces el mismo número de lote', async () => {
    const ctx = await scenario({ hasBatches: true });
    await inventory.createBatch(ctx.product.id, { batchNumber: 'L-DUPLICADO' });

    await expect(
      inventory.createBatch(ctx.product.id, { batchNumber: 'L-DUPLICADO' })
    ).rejects.toThrow(/ya existe para este producto/);
  });
});

describe('Costo promedio móvil (S-25)', () => {
  it('pondera el costo de las entradas y las salidas no lo cambian', async () => {
    const ctx = await scenario({ cost: '100.00' });

    await enterStock(ctx, '10', '100');
    expect(await productCost(ctx.product.id)).toBe(100);

    await enterStock(ctx, '10', '200');
    expect(await productCost(ctx.product.id)).toBe(150);

    const out = await inventory.createMove(
      {
        type: 'SALIDA',
        fromWarehouseId: ctx.warehouse.id,
        lines: [{ productId: ctx.product.id, quantity: '5' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    await inventory.approveMove(out.id, ctx.creator.id);

    expect(await productCost(ctx.product.id)).toBe(150);
    expect(await stockOf(ctx.warehouse.id, ctx.product.id)).toBe(15);
  });

  it('una entrada sin costo mantiene el promedio vigente', async () => {
    const ctx = await scenario({ cost: '80.00' });

    await enterStock(ctx, '4', '80');
    await enterStock(ctx, '6');

    expect(await productCost(ctx.product.id)).toBe(80);
  });
});

describe('Aprobación en lote (S-25)', () => {
  it('aprueba los válidos y reporta los que fallaron', async () => {
    const ctx = await scenario();
    // Producto distinto y sin existencia: la salida no se puede aprobar aunque el otro sí.
    const depleted = await createTestProduct({ hasBatches: false });

    const good = await inventory.createMove(
      {
        type: 'ENTRADA',
        toWarehouseId: ctx.warehouse.id,
        lines: [{ productId: ctx.product.id, quantity: '9', cost: '100' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    const bad = await inventory.createMove(
      {
        type: 'SALIDA',
        fromWarehouseId: ctx.warehouse.id,
        lines: [{ productId: depleted.id, quantity: '1' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    const result = await inventory.approveMovesBatch([good.id, bad.id], ctx.creator.id);

    expect(result.approved).toEqual([good.id]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe(bad.id);
    expect(await stockOf(ctx.warehouse.id, ctx.product.id)).toBe(9);
  });

  it('respeta la segunda aprobación dentro del lote', async () => {
    const ctx = await scenario();
    await enterStock(ctx, '100');

    const adjustment = await inventory.createMove(
      {
        type: 'AJUSTE',
        fromWarehouseId: ctx.warehouse.id,
        reasonCode: 'CONTEO',
        lines: [{ productId: ctx.product.id, quantity: '20' }],
      } as never,
      ctx.creator.id,
      ctx.branch.id
    );

    const byCreator = await inventory.approveMovesBatch([adjustment.id], ctx.creator.id);
    expect(byCreator.approved).toEqual([]);
    expect(byCreator.failed).toHaveLength(1);

    const bySupervisor = await inventory.approveMovesBatch([adjustment.id], ctx.supervisor.id);
    expect(bySupervisor.approved).toEqual([adjustment.id]);
  });
});
