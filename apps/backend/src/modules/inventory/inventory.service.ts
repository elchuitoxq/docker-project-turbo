import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { db } from '../../database';
import {
  warehouses,
  stock,
  inventoryMoves,
  inventoryMoveLines,
  inventoryBatchReservations,
  products,
  productBatches,
  inventoryMovesRelations,
  inventoryMoveLinesRelations,
  stockRelations,
} from '../../schema';
import { eq, and, or, sql, inArray, lt } from 'drizzle-orm';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseResponseDto,
  CreateInventoryMoveDto,
  RejectInventoryMoveDto,
  InventoryMoveResponseDto,
  StockResponseDto,
  InventoryMoveLineResponseDto,
  ProductBatchResponseDto,
  CreateProductBatchDto,
} from './dto/inventory.dto';

/**
 * Motivos de ajuste (`S-25`).
 *
 * El almacén conserva el permiso de aprobación porque es el maestro de ese rol; el control se logra
 * como en SAP: sin motivo no hay ajuste, y si la diferencia supera la tolerancia tiene que aprobarla
 * otra persona.
 */
export const ADJUSTMENT_REASONS: Record<string, string> = {
  CONTEO: 'Diferencia de conteo físico',
  DAÑO: 'Mercancía dañada',
  VENCIMIENTO: 'Mercancía vencida',
  HURTO: 'Pérdida o hurto',
  ERROR_DIGITACION: 'Error de digitación',
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ResolvedMoveLine = {
  line: NonNullable<CreateInventoryMoveDto['lines']>[number];
  batchId: string | null;
};

@Injectable()
export class InventoryService {
  async findAllWarehouses(branchId?: string): Promise<WarehouseResponseDto[]> {
    if (branchId) {
      const warehousesOfBranch = await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.branchId, branchId));

      return warehousesOfBranch.map(this.toWarehouseResponseDto);
    }

    const allWarehouses = await db.select().from(warehouses);
    return allWarehouses.map(this.toWarehouseResponseDto);
  }

  /**
   * Almacenes de la sucursal para selectores de stock.
   *
   * Se expone aparte del catálogo completo porque `inventory:products:view` (el permiso que habilita
   * la pantalla de Stock) no incluye `inventory:warehouses:view`; sin esto el selector quedaba vacío.
   */
  async findWarehouseOptions(
    branchId?: string
  ): Promise<{ id: string; name: string; isActive: boolean }[]> {
    const rows = branchId
      ? await db.select().from(warehouses).where(eq(warehouses.branchId, branchId))
      : await db.select().from(warehouses);

    return rows
      .filter(row => row.isActive !== false)
      .map(row => ({ id: row.id, name: row.name, isActive: true }));
  }

  async findOneWarehouse(id: string, branchId?: string): Promise<WarehouseResponseDto> {
    const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);

    // R2: almacén de otra sucursal -> 404.
    if (!warehouse || (branchId && warehouse.branchId && warehouse.branchId !== branchId)) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    return this.toWarehouseResponseDto(warehouse);
  }

  async createWarehouse(createWarehouseDto: CreateWarehouseDto): Promise<WarehouseResponseDto> {
    const [newWarehouse] = await db
      .insert(warehouses)
      .values({
        name: createWarehouseDto.name,
        branchId: createWarehouseDto.branchId,
        address: createWarehouseDto.address,
        isActive: true,
      })
      .returning();

    return this.toWarehouseResponseDto(newWarehouse);
  }

  async updateWarehouse(
    id: string,
    updateWarehouseDto: UpdateWarehouseDto
  ): Promise<WarehouseResponseDto> {
    const [existing] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    const updateData: Partial<typeof warehouses.$inferInsert> = {};

    if (updateWarehouseDto.name !== undefined) {
      updateData.name = updateWarehouseDto.name;
    }
    if (updateWarehouseDto.branchId !== undefined) {
      updateData.branchId = updateWarehouseDto.branchId;
    }
    if (updateWarehouseDto.address !== undefined) {
      updateData.address = updateWarehouseDto.address;
    }
    if (updateWarehouseDto.isActive !== undefined) {
      updateData.isActive = updateWarehouseDto.isActive === 1;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(warehouses).set(updateData).where(eq(warehouses.id, id));
    }

    return this.findOneWarehouse(id);
  }

  /**
   * Baja lÃ³gica de un almacÃ©n (T-01-10): sÃ³lo si no tiene stock ni movimientos.
   * Borrar un almacÃ©n con historia romperÃ­a los movimientos y los saldos.
   */
  async deactivateWarehouse(id: string, branchId?: string): Promise<WarehouseResponseDto> {
    const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);

    if (!warehouse || (branchId && warehouse.branchId !== branchId)) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    if (!warehouse.isActive) {
      return this.toWarehouseResponseDto(warehouse);
    }

    const stockRows = await db.select().from(stock).where(eq(stock.warehouseId, id));
    const withQuantity = stockRows.filter(row => Number(row.quantity) !== 0);
    if (withQuantity.length > 0) {
      throw new ConflictException('Warehouse has stock; it cannot be deactivated');
    }

    const moves = await db
      .select({ id: inventoryMoves.id })
      .from(inventoryMoves)
      .where(or(eq(inventoryMoves.fromWarehouseId, id), eq(inventoryMoves.toWarehouseId, id)))
      .limit(1);

    if (moves.length > 0) {
      throw new ConflictException('Warehouse has inventory movements; it cannot be deactivated');
    }

    const [updated] = await db
      .update(warehouses)
      .set({ isActive: false })
      .where(eq(warehouses.id, id))
      .returning();

    return { ...updated, isActive: updated.isActive ?? false };
  }
  async findStockByWarehouse(warehouseId: string, branchId?: string): Promise<StockResponseDto[]> {
    if (branchId) {
      const [warehouse] = await db
        .select({ branchId: warehouses.branchId })
        .from(warehouses)
        .where(eq(warehouses.id, warehouseId))
        .limit(1);

      if (!warehouse || warehouse.branchId !== branchId) {
        throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
      }
    }

    const [warehouse] = await db
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .limit(1);

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
    }

    const stockItems = await db.select().from(stock).where(eq(stock.warehouseId, warehouseId));

    const result: StockResponseDto[] = [];
    for (const item of stockItems) {
      const response = await this.toStockResponseDto(item);
      result.push(response);
    }

    return result;
  }

  async findAllMoves(
    status?: string,
    warehouseId?: string,
    branchId?: string
  ): Promise<InventoryMoveResponseDto[]> {
    const conditions = [...(branchId ? [eq(inventoryMoves.branchId, branchId)] : [])];

    if (status) {
      conditions.push(eq(inventoryMoves.status, status) as any);
    }

    if (warehouseId) {
      const warehouseCondition = or(
        eq(inventoryMoves.fromWarehouseId, warehouseId) as any,
        eq(inventoryMoves.toWarehouseId, warehouseId) as any
      );
      if (warehouseCondition) {
        conditions.push(warehouseCondition);
      }
    }

    let query;
    if (conditions.length > 0) {
      query = db
        .select()
        .from(inventoryMoves)
        .where(and(...conditions)) as any;
    } else {
      query = db.select().from(inventoryMoves);
    }

    const allMoves = await query;
    const result: InventoryMoveResponseDto[] = [];

    for (const move of allMoves) {
      const response = await this.toMoveResponseDto(move);
      result.push(response);
    }

    return result;
  }

  async findOneMove(id: string, branchId?: string): Promise<InventoryMoveResponseDto> {
    const [move] = await db.select().from(inventoryMoves).where(eq(inventoryMoves.id, id)).limit(1);

    // R2: movimiento de otra sucursal -> 404.
    if (!move || (branchId && move.branchId !== branchId)) {
      throw new NotFoundException(`Inventory move with ID ${id} not found`);
    }

    return this.toMoveResponseDto(move, true);
  }

  async createMove(
    createMoveDto: CreateInventoryMoveDto,
    userId?: string,
    branchId?: string
  ): Promise<InventoryMoveResponseDto> {
    const moveBranchId = branchId ?? (await this.resolveBranchFromWarehouse(createMoveDto));
    if (createMoveDto.type === 'SALIDA' && !createMoveDto.fromWarehouseId) {
      throw new BadRequestException('fromWarehouseId is required for SALIDA moves');
    }

    if (createMoveDto.type === 'ENTRADA' && !createMoveDto.toWarehouseId) {
      throw new BadRequestException('toWarehouseId is required for ENTRADA moves');
    }

    if (
      createMoveDto.type === 'TRANSFERENCIA' &&
      (!createMoveDto.fromWarehouseId || !createMoveDto.toWarehouseId)
    ) {
      throw new BadRequestException(
        'fromWarehouseId and toWarehouseId are required for TRANSFERENCIA moves'
      );
    }

    // Un ajuste corrige el conteo físico de un almacén: se toma la cantidad contada y el servicio
    // calcula la diferencia contra el stock real al aprobarlo.
    if (createMoveDto.type === 'AJUSTE' && !createMoveDto.fromWarehouseId) {
      throw new BadRequestException('fromWarehouseId is required for AJUSTE moves');
    }

    if (!createMoveDto.lines || createMoveDto.lines.length === 0) {
      throw new BadRequestException('Un movimiento necesita al menos una línea de producto');
    }

    // `S-25`: un ajuste sin motivo es una corrección a ciegas; se rechaza igual que haría SAP.
    if (createMoveDto.type === 'AJUSTE' && !createMoveDto.reasonCode) {
      throw new BadRequestException(
        `Un ajuste necesita motivo (reasonCode). Valores válidos: ${Object.keys(ADJUSTMENT_REASONS).join(', ')}`
      );
    }

    if (createMoveDto.reasonCode && !ADJUSTMENT_REASONS[createMoveDto.reasonCode]) {
      throw new BadRequestException(
        `Motivo de ajuste inválido: ${createMoveDto.reasonCode}. Valores válidos: ${Object.keys(ADJUSTMENT_REASONS).join(', ')}`
      );
    }

    // La diferencia se mide contra el stock real **antes** de tocar nada, para decidir si el ajuste
    // necesita una segunda aprobación.
    const requiresSecondApproval =
      createMoveDto.type === 'AJUSTE'
        ? await this.adjustmentExceedsTolerance(createMoveDto)
        : false;

    // `S-26`: en una salida el lote manda. Se valida antes de crear el documento para que no nazca una
    // salida que después no se puede aprobar (vencida, bloqueada o fuera de FEFO).
    if (createMoveDto.type === 'SALIDA') {
      await this.assertDispatchableBatches(createMoveDto);
    }

    // El lote puede venir por ID o por número: en la recepción el usuario teclea el número y el
    // sistema lo crea si es la primera vez que entra (como el maestro de lotes de SAP).
    const resolvedLines: ResolvedMoveLine[] = [];
    for (const line of createMoveDto.lines || []) {
      resolvedLines.push({
        line,
        batchId: await this.resolveBatchId(line, createMoveDto.type),
      });
    }

    // El documento, sus líneas y su reserva nacen juntos: si la reserva no alcanza, no debe quedar
    // una salida a medias que después alguien apruebe.
    //
    // El reintento del consecutivo se hace sobre la transacción completa: un choque de código aborta
    // la transacción en Postgres, así que no basta con reintentar el `insert` dentro de ella.
    let moveId = '';
    for (let attempt = 0; ; attempt += 1) {
      try {
        moveId = await db.transaction(async tx => {
          const newMove = await this.insertMoveWithGeneratedCode(
            {
              type: createMoveDto.type,
              branchId: moveBranchId,
              fromWarehouseId: createMoveDto.fromWarehouseId,
              toWarehouseId: createMoveDto.toWarehouseId,
              note: createMoveDto.note,
              reasonCode: createMoveDto.reasonCode ?? null,
              requiresSecondApproval,
              fefoOverride: createMoveDto.fefoOverride ?? false,
              fefoOverrideReason: createMoveDto.fefoOverride
                ? (createMoveDto.fefoOverrideReason ?? null)
                : null,
              userId,
            },
            tx
          );

          const insertedLines: { id: string; resolved: ResolvedMoveLine }[] = [];
          for (const resolved of resolvedLines) {
            const [inserted] = await tx
              .insert(inventoryMoveLines)
              .values({
                moveId: newMove.id,
                productId: resolved.line.productId,
                batchId: resolved.batchId,
                quantity: resolved.line.quantity.toString(),
                cost: resolved.line.cost?.toString(),
              })
              .returning();

            insertedLines.push({ id: inserted.id, resolved });
          }

          if (createMoveDto.type === 'SALIDA') {
            await this.reserveDispatchBatches(tx, newMove.id, createMoveDto, insertedLines);
          }

          return newMove.id;
        });

        break;
      } catch (error) {
        if (attempt >= 4 || !this.isUniqueViolation(error)) throw error;
      }
    }

    return this.findOneMove(moveId);
  }

  /**
   * Reserva la existencia de cada lote de una salida (`S-26`).
   *
   * El candado de asesoría serializa a los documentos que compiten por el mismo
   * `(almacén, producto, lote)`: el segundo ve la reserva del primero y no puede prometer la misma
   * mercancía. La reserva se mide contra el stock físico menos las reservas activas; el stock no se
   * toca hasta aprobar.
   */
  private async reserveDispatchBatches(
    tx: Transaction,
    moveId: string,
    dto: CreateInventoryMoveDto,
    lines: { id: string; resolved: ResolvedMoveLine }[]
  ): Promise<void> {
    const warehouseId = dto.fromWarehouseId;
    if (!warehouseId) return;

    const requests = new Map<string, { productId: string; batchId: string; quantity: number }>();

    for (const { resolved } of lines) {
      if (!resolved.batchId) continue;

      const quantity = Number(resolved.line.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      const key = `${resolved.line.productId}:${resolved.batchId}`;
      const current = requests.get(key);
      if (current) {
        current.quantity += quantity;
      } else {
        requests.set(key, {
          productId: resolved.line.productId,
          batchId: resolved.batchId,
          quantity,
        });
      }
    }

    for (const key of [...requests.keys()].sort()) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${warehouseId}:${key}`})::bigint)`
      );
    }

    for (const request of requests.values()) {
      const [stockRow] = await tx
        .select({ quantity: stock.quantity })
        .from(stock)
        .where(
          and(
            eq(stock.warehouseId, warehouseId),
            eq(stock.productId, request.productId),
            eq(stock.batchId, request.batchId)
          )
        )
        .limit(1);

      const reserved = await this.activeReservedQuantity(
        request.productId,
        request.batchId,
        warehouseId
      );
      const available = this.round(Number(stockRow?.quantity ?? 0) - reserved);

      if (request.quantity > available) {
        const [batch] = await tx
          .select({ batchNumber: productBatches.batchNumber })
          .from(productBatches)
          .where(eq(productBatches.id, request.batchId))
          .limit(1);

        throw new BadRequestException(
          `El lote ${batch?.batchNumber ?? request.batchId} no tiene existencia disponible suficiente: disponible ${available}, solicitado ${this.round(request.quantity)}`
        );
      }
    }

    const reservations = lines
      .filter(({ resolved }) => resolved.batchId)
      .map(({ id, resolved }) => ({
        moveId,
        moveLineId: id,
        warehouseId,
        productId: resolved.line.productId,
        batchId: resolved.batchId!,
        quantity: resolved.line.quantity.toString(),
        status: 'ACTIVE',
      }));

    // Un producto sin lotes no reserva: la reserva existe para no prometer dos veces el mismo lote.
    if (reservations.length > 0) {
      await tx.insert(inventoryBatchReservations).values(reservations);
    }
  }

  /** Suma de reservas activas de un lote en un almacén (0 si no hay ninguna). */
  private async activeReservedQuantity(
    productId: string,
    batchId: string,
    warehouseId?: string
  ): Promise<number> {
    const conditions = [
      eq(inventoryBatchReservations.productId, productId),
      eq(inventoryBatchReservations.batchId, batchId),
      eq(inventoryBatchReservations.status, 'ACTIVE'),
    ];
    if (warehouseId) {
      conditions.push(eq(inventoryBatchReservations.warehouseId, warehouseId));
    }

    const [row] = await db
      .select({
        quantity: sql<string>`coalesce(sum(${inventoryBatchReservations.quantity}), 0)`,
      })
      .from(inventoryBatchReservations)
      .where(and(...conditions));

    return Number(row?.quantity ?? 0);
  }

  /** Reservas activas por lote del producto, para descontarlas de la existencia disponible. */
  private async activeReservationsByBatch(
    productId: string,
    warehouseId?: string
  ): Promise<Map<string, number>> {
    const conditions = [
      eq(inventoryBatchReservations.productId, productId),
      eq(inventoryBatchReservations.status, 'ACTIVE'),
    ];
    if (warehouseId) {
      conditions.push(eq(inventoryBatchReservations.warehouseId, warehouseId));
    }

    const rows = await db
      .select({
        batchId: inventoryBatchReservations.batchId,
        quantity: sql<string>`coalesce(sum(${inventoryBatchReservations.quantity}), 0)`,
      })
      .from(inventoryBatchReservations)
      .where(and(...conditions))
      .groupBy(inventoryBatchReservations.batchId);

    return new Map(rows.map(row => [row.batchId, Number(row.quantity)]));
  }

  /** Libera las reservas activas de un documento: ya se aprobó (el stock bajó) o se rechazó. */
  private async releaseReservations(moveId: string): Promise<void> {
    await db
      .update(inventoryBatchReservations)
      .set({ status: 'RELEASED', releasedAt: new Date() })
      .where(
        and(
          eq(inventoryBatchReservations.moveId, moveId),
          eq(inventoryBatchReservations.status, 'ACTIVE')
        )
      );
  }

  /**
   * Bloquea automáticamente los lotes vencidos (`S-26`).
   *
   * Es el job diario: un lote que venció ayer deja de poder recibir ni despachar sin que nadie tenga
   * que acordarse de marcarlo. La baja del stock sigue siendo un ajuste manual con motivo
   * (`VENCIMIENTO`), porque sacar mercancía del inventario es una decisión contable, no un efecto
   * colateral del calendario.
   */
  async blockExpiredBatches(
    reference: Date = new Date(),
    productIds?: string[]
  ): Promise<{ blocked: { id: string; batchNumber: string }[] }> {
    const startOfToday = new Date(reference);
    startOfToday.setHours(0, 0, 0, 0);

    const conditions = [
      sql`${productBatches.isActive} IS DISTINCT FROM false`,
      sql`${productBatches.expirationDate} IS NOT NULL`,
      lt(productBatches.expirationDate, startOfToday),
    ];
    if (productIds && productIds.length > 0) {
      conditions.push(inArray(productBatches.productId, productIds));
    }

    const blocked = await db
      .update(productBatches)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: productBatches.id, batchNumber: productBatches.batchNumber });

    return { blocked };
  }

  /**
   * Inserta el movimiento con un código correlativo nuevo.
   *
   * El consecutivo se calcula leyendo el máximo existente, así que dos altas simultáneas pueden chocar
   * contra el índice único. El llamador reintenta la transacción completa con el siguiente número (ver
   * `createMove`): es el mismo comportamiento que el «número bloqueado» de SAP cuando dos usuarios
   * numeran a la vez.
   */
  private async insertMoveWithGeneratedCode(
    values: {
      type: string;
      branchId: string | null;
      fromWarehouseId?: string;
      toWarehouseId?: string;
      note?: string;
      reasonCode: string | null;
      requiresSecondApproval: boolean;
      fefoOverride?: boolean;
      fefoOverrideReason?: string | null;
      source?: string;
      userId?: string;
    },
    tx: Transaction
  ): Promise<typeof inventoryMoves.$inferSelect> {
    const code = await this.generateMoveCode(tx);

    const [move] = await tx
      .insert(inventoryMoves)
      .values({
        ...values,
        code,
        status: 'EN_TRAMITE',
        source: values.source ?? 'MANUAL',
        date: new Date(),
      })
      .returning();

    return move;
  }

  /**
   * Devolución de cliente generada por una nota de crédito (`T-03-07`).
   *
   * La mercancía devuelta entra al almacén, pero el movimiento nace en `EN_TRAMITE`: el almacén lo
   * aprueba o lo rechaza igual que cualquier otro movimiento, así que la devolución no mueve stock
   * sin que alguien del almacén lo confirme. Corre en la transacción del documento que la origina
   * para que no quede una entrada huérfana si ese documento no se puede emitir.
   */
  async createReturnEntry(
    input: {
      branchId: string;
      warehouseId: string;
      note: string;
      userId?: string;
      lines: { productId: string; quantity: number; cost?: number | null }[];
    },
    tx: Transaction
  ): Promise<{ id: string; code: string }> {
    const move = await this.insertMoveWithGeneratedCode(
      {
        type: 'ENTRADA',
        branchId: input.branchId,
        toWarehouseId: input.warehouseId,
        note: input.note,
        reasonCode: null,
        requiresSecondApproval: false,
        source: 'CREDIT_NOTE',
        userId: input.userId,
      },
      tx
    );

    for (const line of input.lines) {
      await tx.insert(inventoryMoveLines).values({
        moveId: move.id,
        productId: line.productId,
        quantity: String(line.quantity),
        cost: line.cost === null || line.cost === undefined ? undefined : String(line.cost),
      });
    }

    return { id: move.id, code: move.code };
  }

  /**
   * Revierte la entrada de una devolución cuando su nota de crédito se anula.
   *
   * Si el almacén todavía no la aprobó, se rechaza el borrador (no hubo movimiento de stock). Si ya
   * estaba aprobada, el stock volvió: se emite una `SALIDA` compensatoria en borrador en vez de
   * borrar el movimiento, porque el kardex es un histórico y no se reescribe.
   */
  async revertReturnEntry(moveId: string, userId?: string, reason?: string): Promise<void> {
    const [move] = await db
      .select()
      .from(inventoryMoves)
      .where(eq(inventoryMoves.id, moveId))
      .limit(1);

    if (!move || move.status === 'REJECTED' || move.status === 'CANCELLED') return;

    const motivo = reason ?? `Reversión del movimiento ${move.code}`;

    if (move.status === 'EN_TRAMITE') {
      await this.rejectMove(moveId, { reason: motivo });
      return;
    }

    const lines = await db
      .select()
      .from(inventoryMoveLines)
      .where(eq(inventoryMoveLines.moveId, moveId));

    await db.transaction(async tx => {
      const compensation = await this.insertMoveWithGeneratedCode(
        {
          type: 'SALIDA',
          branchId: move.branchId,
          fromWarehouseId: move.toWarehouseId ?? move.fromWarehouseId ?? undefined,
          note: motivo,
          reasonCode: null,
          requiresSecondApproval: false,
          source: 'CREDIT_NOTE',
          userId,
        },
        tx
      );

      for (const line of lines) {
        await tx.insert(inventoryMoveLines).values({
          moveId: compensation.id,
          productId: line.productId,
          batchId: line.batchId,
          quantity: line.quantity,
          cost: line.cost ?? undefined,
        });
      }
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    // Drizzle envuelve el error de Postgres (`Failed query: ...`) y deja el original en `cause`.
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current; depth += 1) {
      const candidate = current as { code?: string; message?: string; cause?: unknown };
      if (candidate.code === '23505' || /duplicate key/i.test(candidate.message ?? '')) return true;
      current = candidate.cause;
    }
    return false;
  }

  async approveMove(id: string, userId?: string): Promise<InventoryMoveResponseDto> {
    const [move] = await db.select().from(inventoryMoves).where(eq(inventoryMoves.id, id)).limit(1);

    if (!move) {
      throw new NotFoundException(`Inventory move with ID ${id} not found`);
    }

    if (move.status !== 'EN_TRAMITE') {
      throw new BadRequestException(
        `Cannot approve move with status ${move.status}. Only EN_TRAMITE moves can be approved.`
      );
    }

    // `S-25`: el almacén mantiene el permiso de aprobación, pero un ajuste que se sale de la
    // tolerancia no lo puede aprobar quien lo registró. Es la segregación de funciones mínima sin
    // quitarle el permiso al rol maestro.
    if (move.requiresSecondApproval && userId && move.userId && userId === move.userId) {
      throw new ForbiddenException(
        'El ajuste supera la tolerancia permitida y no puede aprobarlo quien lo registró. Debe aprobarlo un gerente o un administrador.'
      );
    }

    const lines = await db
      .select()
      .from(inventoryMoveLines)
      .where(eq(inventoryMoveLines.moveId, id));

    for (const line of lines) {
      const quantity = Number(line.quantity);

      if (move.type === 'ENTRADA') {
        await this.addStock(
          move.toWarehouseId!,
          line.productId,
          line.batchId,
          quantity,
          this.toOptionalNumber(line.cost)
        );
      } else if (move.type === 'SALIDA') {
        await this.subtractStock(move.fromWarehouseId!, line.productId, line.batchId, quantity);
      } else if (move.type === 'TRANSFERENCIA') {
        await this.subtractStock(move.fromWarehouseId!, line.productId, line.batchId, quantity);
        await this.addStock(
          move.toWarehouseId!,
          line.productId,
          line.batchId,
          quantity,
          this.toOptionalNumber(line.cost)
        );
      } else if (move.type === 'AJUSTE') {
        // `quantity` es la cantidad **contada**: el movimiento no suma ni resta, deja el stock en lo
        // contado. Es lo que hace un ajuste por inventario físico y lo que evita que el usuario tenga
        // que calcular la diferencia a mano (y equivocarse de signo).
        const current = await this.currentStock(
          move.fromWarehouseId!,
          line.productId,
          line.batchId
        );
        const delta = Number(this.round(quantity - current));

        if (delta > 0) {
          await this.addStock(
            move.fromWarehouseId!,
            line.productId,
            line.batchId,
            delta,
            this.toOptionalNumber(line.cost)
          );
        } else if (delta < 0) {
          await this.subtractStock(
            move.fromWarehouseId!,
            line.productId,
            line.batchId,
            Math.abs(delta)
          );
        }
      }
    }

    const [updatedMove] = await db
      .update(inventoryMoves)
      .set({
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      })
      .where(eq(inventoryMoves.id, id))
      .returning();

    // La reserva cumplió su función: el stock ya bajó, así que la cantidad vuelve a estar disponible
    // para el siguiente documento.
    await this.releaseReservations(id);

    return this.toMoveResponseDto(updatedMove, true);
  }

  /**
   * Aprobación en lote (`S-25`).
   *
   * Se procesa movimiento por movimiento y se devuelve el resultado de cada uno: un documento inválido
   * no puede revertir los que ya quedaron aprobados (misma semántica que la aprobación masiva de SAP,
   * donde los errores se reportan por documento).
   */
  async approveMovesBatch(
    ids: string[],
    userId?: string
  ): Promise<{ approved: string[]; failed: { id: string; message: string }[] }> {
    const approved: string[] = [];
    const failed: { id: string; message: string }[] = [];

    for (const id of ids) {
      try {
        const move = await this.approveMove(id, userId);
        approved.push(move.id);
      } catch (error) {
        failed.push({
          id,
          message: error instanceof Error ? error.message : 'No se pudo aprobar el movimiento',
        });
      }
    }

    return { approved, failed };
  }

  async rejectMove(
    id: string,
    rejectDto: RejectInventoryMoveDto
  ): Promise<InventoryMoveResponseDto> {
    const [move] = await db.select().from(inventoryMoves).where(eq(inventoryMoves.id, id)).limit(1);

    if (!move) {
      throw new NotFoundException(`Inventory move with ID ${id} not found`);
    }

    if (move.status !== 'EN_TRAMITE') {
      throw new BadRequestException(
        `Cannot reject move with status ${move.status}. Only EN_TRAMITE moves can be rejected.`
      );
    }

    const [updatedMove] = await db
      .update(inventoryMoves)
      .set({
        status: 'REJECTED',
        rejectionReason: rejectDto.reason,
      })
      .where(eq(inventoryMoves.id, id))
      .returning();

    // El documento no va a consumir la mercancía: la reserva se libera en el acto.
    await this.releaseReservations(id);

    return this.toMoveResponseDto(updatedMove, true);
  }

  /** Deduce la sucursal del movimiento a partir de los almacenes implicados. */
  private async resolveBranchFromWarehouse(
    createMoveDto: CreateInventoryMoveDto
  ): Promise<string | null> {
    const warehouseIds = [createMoveDto.fromWarehouseId, createMoveDto.toWarehouseId].filter(
      (id): id is string => Boolean(id)
    );

    if (warehouseIds.length === 0) return null;

    const [warehouse] = await db
      .select({ branchId: warehouses.branchId })
      .from(warehouses)
      .where(inArray(warehouses.id, warehouseIds))
      .limit(1);

    return warehouse?.branchId ?? null;
  }

  /**
   * Stock actual de un producto en un almacén (y lote). `0` cuando todavía no hay fila.
   *
   * Lo usa el ajuste por conteo (`S-23`) para calcular la diferencia y la UI para mostrar al usuario
   * contra qué está ajustando.
   */
  async currentStock(
    warehouseId: string,
    productId: string,
    batchId: string | null
  ): Promise<number> {
    const [row] = await db
      .select({ quantity: stock.quantity })
      .from(stock)
      .where(
        and(
          eq(stock.warehouseId, warehouseId),
          eq(stock.productId, productId),
          batchId ? eq(stock.batchId, batchId) : sql`${stock.batchId} IS NULL`
        ) as any
      )
      .limit(1);

    return Number(row?.quantity ?? 0);
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
  }

  private toOptionalNumber(value: string | null | undefined): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /** Tolerancia de ajuste en porcentaje del stock (`SEGREGATION_TOLERANCE_PERCENT`, 10 % por defecto). */
  private tolerancePercent(): number {
    const raw = Number(process.env.SEGREGATION_TOLERANCE_PERCENT ?? '10');
    return Number.isFinite(raw) && raw >= 0 ? raw : 10;
  }

  /**
   * ¿La diferencia del conteo se sale de la tolerancia?
   *
   * Un stock en cero cuenta como base 1 para que «aparecer» mercancía no pase nunca inadvertido: dar
   * de alta inventario que no existía siempre requiere segunda aprobación.
   */
  private async adjustmentExceedsTolerance(dto: CreateInventoryMoveDto): Promise<boolean> {
    if (!dto.fromWarehouseId || !dto.lines?.length) return false;

    const tolerance = this.tolerancePercent();

    for (const line of dto.lines) {
      const batchId =
        line.batchId ??
        (line.batchNumber
          ? await this.findBatchIdByNumber(line.productId, line.batchNumber)
          : null);

      const current = await this.currentStock(dto.fromWarehouseId, line.productId, batchId);
      const counted = Number(line.quantity);
      const delta = Math.abs(counted - current);

      if (!Number.isFinite(counted) || delta === 0) continue;

      const base = Math.max(current, 1);
      if ((delta / base) * 100 > tolerance) return true;
    }

    return false;
  }

  /**
   * Traduce el lote que llega en la línea a un `batchId`.
   *
   * Si viene el número y el lote no existe, se crea sólo cuando el movimiento **ingresa** mercancía
   * (entrada, traslado o ajuste positivo). Una salida con un lote inexistente es un error de captura.
   */
  private async resolveBatchId(
    line: NonNullable<CreateInventoryMoveDto['lines']>[number],
    moveType: string
  ): Promise<string | null> {
    if (line.batchId) return line.batchId;

    const batchNumber = line.batchNumber?.trim();
    if (!batchNumber) return null;

    const existingId = await this.findBatchIdByNumber(line.productId, batchNumber);
    if (existingId) return existingId;

    if (moveType === 'SALIDA') {
      throw new BadRequestException(
        `El lote ${batchNumber} no existe para el producto ${line.productId}`
      );
    }

    const [created] = await db
      .insert(productBatches)
      .values({
        productId: line.productId,
        batchNumber,
        expirationDate: line.batchExpirationDate ? new Date(line.batchExpirationDate) : null,
        cost: line.cost ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (created) return created.id;

    // Otra transacción lo creó en paralelo: se reutiliza.
    return this.findBatchIdByNumber(line.productId, batchNumber);
  }

  /**
   * Valida el lote de cada línea de una salida (`S-26`).
   *
   * Tres reglas, en el orden en que el almacenista las necesita:
   * 1. Un producto con lotes no sale sin lote: si no, el descuento no toca el lote y el vencimiento
   *    deja de tener sentido.
   * 2. El lote no puede estar bloqueado ni vencido (SAP bloquea el despacho de un lote vencido).
   * 3. Si hay un lote que vence antes y tiene existencia, hay que despachar ese; saltárselo exige
   *    `fefoOverride` con motivo, para que la excepción quede auditada.
   */
  private async assertDispatchableBatches(dto: CreateInventoryMoveDto): Promise<void> {
    const warehouseId = dto.fromWarehouseId;
    if (!warehouseId) return;

    const override = dto.fefoOverride === true;
    if (override && !dto.fefoOverrideReason?.trim()) {
      throw new BadRequestException(
        'Para despachar un lote distinto al sugerido hay que indicar el motivo (fefoOverrideReason)'
      );
    }

    for (const line of dto.lines ?? []) {
      const batchId =
        line.batchId ??
        (line.batchNumber
          ? await this.findBatchIdByNumber(line.productId, line.batchNumber)
          : null);

      const [product] = await db
        .select({ hasBatches: products.hasBatches })
        .from(products)
        .where(eq(products.id, line.productId))
        .limit(1);

      if (!batchId) {
        if (line.batchNumber?.trim()) {
          throw new BadRequestException(
            `El lote ${line.batchNumber.trim()} no existe para el producto ${line.productId}`
          );
        }

        if (product?.hasBatches) {
          throw new BadRequestException(
            `El producto ${line.productId} maneja lotes: hay que indicar de qué lote sale`
          );
        }
        continue;
      }

      const [batch] = await db
        .select()
        .from(productBatches)
        .where(eq(productBatches.id, batchId))
        .limit(1);

      if (!batch) {
        throw new NotFoundException(`Batch with ID ${batchId} not found`);
      }

      if (batch.isActive === false) {
        throw new BadRequestException(
          `El lote ${batch.batchNumber} está bloqueado y no se puede despachar`
        );
      }

      if (this.isExpired(batch.expirationDate)) {
        throw new BadRequestException(
          `El lote ${batch.batchNumber} está vencido (${batch.expirationDate?.toISOString().slice(0, 10)}) y no se puede despachar`
        );
      }

      const suggested = await this.resolveFefoBatch(line.productId, warehouseId);
      if (suggested && suggested.id !== batchId && !override) {
        throw new BadRequestException(
          `El lote ${suggested.batchNumber} vence antes y tiene existencia: despáchalo primero o autoriza la excepción con fefoOverride y su motivo`
        );
      }
    }
  }

  /** ¿El lote venció? Se compara por día: un lote que vence hoy todavía se puede despachar. */
  private isExpired(expirationDate: Date | null): boolean {
    if (!expirationDate) return false;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return new Date(expirationDate).getTime() < startOfToday.getTime();
  }

  /**
   * Lote sugerido por FEFO: el que vence antes **y** tiene existencia en el almacén.
   *
   * Se descartan los vencidos y los bloqueados: sugerir un lote que luego el despacho va a rechazar
   * sería un callejón sin salida para el almacenista.
   */
  private async resolveFefoBatch(
    productId: string,
    warehouseId: string
  ): Promise<{ id: string; batchNumber: string } | null> {
    const rows = await db
      .select({
        id: productBatches.id,
        batchNumber: productBatches.batchNumber,
        expirationDate: productBatches.expirationDate,
        isActive: productBatches.isActive,
        quantity: stock.quantity,
      })
      .from(stock)
      .innerJoin(productBatches, eq(productBatches.id, stock.batchId))
      .where(and(eq(stock.productId, productId), eq(stock.warehouseId, warehouseId)));

    const reserved = await this.activeReservationsByBatch(productId, warehouseId);

    const candidates = rows
      .filter(
        row =>
          row.isActive !== false &&
          !this.isExpired(row.expirationDate) &&
          Number(row.quantity) - (reserved.get(row.id) ?? 0) > 0
      )
      .sort((a, b) => {
        const aTime = a.expirationDate
          ? new Date(a.expirationDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.expirationDate
          ? new Date(b.expirationDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return (a.batchNumber ?? '').localeCompare(b.batchNumber ?? '');
      });

    const [first] = candidates;
    return first ? { id: first.id, batchNumber: first.batchNumber } : null;
  }

  private async findBatchIdByNumber(
    productId: string,
    batchNumber: string
  ): Promise<string | null> {
    const [batch] = await db
      .select({ id: productBatches.id })
      .from(productBatches)
      .where(
        and(eq(productBatches.productId, productId), eq(productBatches.batchNumber, batchNumber))
      )
      .limit(1);

    return batch?.id ?? null;
  }

  /** Lotes del producto, con la existencia en el almacén consultado (para el FEFO de la salida). */
  async findBatchesByProduct(
    productId: string,
    warehouseId?: string
  ): Promise<ProductBatchResponseDto[]> {
    const batches = await db
      .select()
      .from(productBatches)
      .where(eq(productBatches.productId, productId));

    if (batches.length === 0) return [];

    const stockRows = warehouseId
      ? await db
          .select({ batchId: stock.batchId, quantity: stock.quantity })
          .from(stock)
          .where(and(eq(stock.productId, productId), eq(stock.warehouseId, warehouseId)))
      : await db
          .select({ batchId: stock.batchId, quantity: stock.quantity })
          .from(stock)
          .where(eq(stock.productId, productId));

    const available = new Map<string, number>();
    for (const row of stockRows) {
      if (!row.batchId) continue;
      available.set(row.batchId, (available.get(row.batchId) ?? 0) + Number(row.quantity));
    }

    const reserved = await this.activeReservationsByBatch(productId, warehouseId);

    // FEFO: primero lo que vence antes; los lotes sin vencimiento van al final. El vencido y el
    // bloqueado se muestran —el usuario necesita verlos— pero marcados para que no los elija (`S-26`).
    // `availableQuantity` descuenta las reservas activas: es lo que de verdad puede prometer otra salida.
    return batches
      .map(batch => {
        const reservedQuantity = reserved.get(batch.id) ?? 0;
        return {
          id: batch.id,
          productId: batch.productId,
          batchNumber: batch.batchNumber,
          expirationDate: batch.expirationDate,
          cost: batch.cost,
          availableQuantity: String(this.round((available.get(batch.id) ?? 0) - reservedQuantity)),
          reservedQuantity: String(reservedQuantity),
          isActive: batch.isActive ?? true,
          expired: this.isExpired(batch.expirationDate),
        };
      })
      .sort((a, b) => {
        const aTime = a.expirationDate
          ? new Date(a.expirationDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.expirationDate
          ? new Date(b.expirationDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return a.batchNumber.localeCompare(b.batchNumber);
      });
  }

  async createBatch(
    productId: string,
    dto: CreateProductBatchDto
  ): Promise<ProductBatchResponseDto> {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const batchNumber = dto.batchNumber?.trim();
    if (!batchNumber) {
      throw new BadRequestException('El número de lote es obligatorio');
    }

    const [created] = await db
      .insert(productBatches)
      .values({
        productId,
        batchNumber,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
        cost: dto.cost ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      throw new ConflictException(
        `El lote ${batchNumber} ya existe para este producto. Elíjalo del listado en lugar de crearlo.`
      );
    }

    return {
      id: created.id,
      productId: created.productId,
      batchNumber: created.batchNumber,
      expirationDate: created.expirationDate,
      cost: created.cost,
    };
  }

  private async addStock(
    warehouseId: string,
    productId: string,
    batchId: string | null,
    quantity: number,
    cost?: number
  ): Promise<void> {
    const existingStocks = await db
      .select()
      .from(stock)
      .where(
        and(
          eq(stock.warehouseId, warehouseId),
          eq(stock.productId, productId),
          batchId ? eq(stock.batchId, batchId) : sql`${stock.batchId} IS NULL`
        ) as any
      );

    if (existingStocks.length > 0) {
      const existing = existingStocks[0];
      const newQuantity = Number(existing.quantity) + quantity;
      await db
        .update(stock)
        .set({
          quantity: newQuantity.toString(),
          updatedAt: new Date(),
        })
        .where(eq(stock.id, existing.id));
    } else {
      await db.insert(stock).values({
        warehouseId,
        productId,
        batchId,
        quantity: quantity.toString(),
        updatedAt: new Date(),
      });
    }

    await this.applyMovingAverage(productId, quantity, cost);
  }

  /**
   * Costo promedio móvil (`S-25`).
   *
   * El área de valoración es la empresa (una sola sociedad), así que la media vive en el maestro de
   * material (`products.cost`) y no por almacén ni por lote: es lo que permite valorar el inventario y
   * costear la salida sin que el mismo producto valga distinto en cada bodega.
   *
   * Solo lo mueven las entradas; las salidas consumen el promedio vigente.
   */
  private async applyMovingAverage(
    productId: string,
    incomingQuantity: number,
    incomingCost?: number
  ): Promise<void> {
    if (incomingQuantity <= 0) return;

    const [product] = await db
      .select({ cost: products.cost })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) return;

    const [totals] = await db
      .select({ quantity: sql<string>`coalesce(sum(${stock.quantity}), 0)` })
      .from(stock)
      .where(eq(stock.productId, productId));

    const quantityAfter = Number(totals?.quantity ?? 0);
    const quantityBefore = Math.max(quantityAfter - incomingQuantity, 0);
    const currentCost = Number(product.cost ?? 0);
    const unitCost =
      incomingCost !== undefined && Number.isFinite(incomingCost) ? incomingCost : currentCost;

    if (!Number.isFinite(unitCost) || unitCost < 0) return;

    const denominator = quantityBefore + incomingQuantity;
    if (denominator <= 0) return;

    const average = (quantityBefore * currentCost + incomingQuantity * unitCost) / denominator;
    if (!Number.isFinite(average) || average <= 0) return;

    await db
      .update(products)
      .set({ cost: average.toFixed(4), updatedAt: new Date() })
      .where(eq(products.id, productId));
  }

  private async subtractStock(
    warehouseId: string,
    productId: string,
    batchId: string | null,
    quantity: number
  ): Promise<void> {
    const existingStocks = await db
      .select()
      .from(stock)
      .where(
        and(
          eq(stock.warehouseId, warehouseId),
          eq(stock.productId, productId),
          batchId ? eq(stock.batchId, batchId) : sql`${stock.batchId} IS NULL`
        ) as any
      );

    if (existingStocks.length === 0) {
      throw new BadRequestException(
        `Insufficient stock for product ${productId} in warehouse ${warehouseId}`
      );
    }

    const existing = existingStocks[0];
    const currentQuantity = Number(existing.quantity);

    if (currentQuantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${currentQuantity}, Requested: ${quantity}`
      );
    }

    const newQuantity = currentQuantity - quantity;

    if (newQuantity <= 0) {
      await db.delete(stock).where(eq(stock.id, existing.id));
    } else {
      await db
        .update(stock)
        .set({
          quantity: newQuantity.toString(),
          updatedAt: new Date(),
        })
        .where(eq(stock.id, existing.id));
    }
  }

  private async generateMoveCode(tx: Transaction): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const existingMoves = await tx
      .select({ code: inventoryMoves.code })
      .from(inventoryMoves)
      .where(sql`${inventoryMoves.code} LIKE ${`${prefix}%`}`);

    let maxNumber = 0;
    for (const move of existingMoves) {
      const numStr = move.code.replace(prefix, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }

    const nextNumber = maxNumber + 1;
    return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
  }

  private async toMoveResponseDto(
    move: typeof inventoryMoves.$inferSelect,
    includeLines = false
  ): Promise<InventoryMoveResponseDto> {
    const warehouseId = move.fromWarehouseId ?? move.toWarehouseId;
    const destWarehouseId = move.type === 'TRANSFERENCIA' ? move.toWarehouseId : null;

    const warehouseIds = [warehouseId, destWarehouseId].filter((id): id is string => !!id);
    const warehouseRows =
      warehouseIds.length > 0
        ? await db
            .select({ id: warehouses.id, name: warehouses.name })
            .from(warehouses)
            .where(inArray(warehouses.id, warehouseIds))
        : [];
    const warehouseNames = new Map(warehouseRows.map(row => [row.id, row.name]));

    const lines = await db
      .select()
      .from(inventoryMoveLines)
      .where(eq(inventoryMoveLines.moveId, move.id));

    const [firstProduct] =
      lines.length > 0
        ? await db
            .select({ id: products.id, name: products.name, sku: products.sku })
            .from(products)
            .where(eq(products.id, lines[0].productId))
            .limit(1)
        : [];

    const firstQuantity = Number(lines[0]?.quantity ?? 0);
    const firstCost = Number(lines[0]?.cost ?? 0);

    const response: InventoryMoveResponseDto = {
      id: move.id,
      code: move.code,
      type: move.type,
      status: move.status,
      fromWarehouseId: move.fromWarehouseId,
      toWarehouseId: move.toWarehouseId,
      warehouseId: warehouseId ?? null,
      warehouseName: warehouseId ? (warehouseNames.get(warehouseId) ?? null) : null,
      warehouseDestId: destWarehouseId,
      warehouseDestName: destWarehouseId ? (warehouseNames.get(destWarehouseId) ?? null) : null,
      productId: lines[0]?.productId ?? null,
      productName: firstProduct?.name ?? null,
      productSku: firstProduct?.sku ?? null,
      quantity: lines[0]?.quantity ?? null,
      unitCost: lines[0]?.cost ?? null,
      totalCost: lines.length > 0 ? String(firstQuantity * firstCost) : null,
      approvedBy: move.approvedBy,
      approvedAt: move.approvedAt,
      rejectionReason: move.rejectionReason,
      note: move.note,
      reasonCode: move.reasonCode,
      requiresSecondApproval: move.requiresSecondApproval ?? false,
      fefoOverride: move.fefoOverride ?? false,
      fefoOverrideReason: move.fefoOverrideReason,
      date: move.date,
      userId: move.userId,
    };

    if (includeLines) {
      response.lines = lines.map(this.toMoveLineResponseDto);
    }

    return response;
  }

  private toMoveLineResponseDto(
    line: typeof inventoryMoveLines.$inferSelect
  ): InventoryMoveLineResponseDto {
    return {
      id: line.id,
      moveId: line.moveId,
      productId: line.productId,
      batchId: line.batchId,
      quantity: line.quantity,
      cost: line.cost,
    };
  }

  private async toStockResponseDto(item: typeof stock.$inferSelect): Promise<StockResponseDto> {
    let productName: string | undefined;
    let productSku: string | undefined;
    let batchNumber: string | undefined;
    let minStock: string | null = null;
    let averageCost: string | null = null;
    let hasBatches = false;

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (product) {
      productName = product.name;
      productSku = product.sku;
      minStock = product.minStock ?? null;
      averageCost = product.cost ?? null;
      hasBatches = product.hasBatches ?? false;
    }

    if (item.batchId) {
      const [batch] = await db
        .select()
        .from(productBatches)
        .where(eq(productBatches.id, item.batchId))
        .limit(1);

      if (batch) {
        batchNumber = batch.batchNumber;
      }
    }

    const quantity = Number(item.quantity ?? 0);
    const minimum = Number(minStock ?? 0);
    const unitCost = Number(averageCost ?? 0);

    return {
      id: item.id,
      warehouseId: item.warehouseId,
      productId: item.productId,
      batchId: item.batchId,
      quantity: item.quantity,
      updatedAt: item.updatedAt,
      productName,
      productSku,
      batchNumber,
      minStock,
      belowMinimum: minimum > 0 && quantity < minimum,
      averageCost,
      totalValue: (quantity * unitCost).toFixed(2),
      hasBatches,
    };
  }

  private toWarehouseResponseDto(warehouse: typeof warehouses.$inferSelect): WarehouseResponseDto {
    return {
      id: warehouse.id,
      branchId: warehouse.branchId,
      name: warehouse.name,
      address: warehouse.address,
      isActive: warehouse.isActive || false,
    };
  }
}
