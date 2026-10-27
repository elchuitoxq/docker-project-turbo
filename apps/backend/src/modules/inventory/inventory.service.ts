import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { db } from '../../database';
import {
  warehouses,
  stock,
  inventoryMoves,
  inventoryMoveLines,
  products,
  productBatches,
  inventoryMovesRelations,
  inventoryMoveLinesRelations,
  stockRelations,
} from '../../schema';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseResponseDto,
  CreateInventoryMoveDto,
  RejectInventoryMoveDto,
  InventoryMoveResponseDto,
  StockResponseDto,
  InventoryMoveLineResponseDto,
} from './dto/inventory.dto';

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

    const code = await this.generateMoveCode();

    const [newMove] = await db
      .insert(inventoryMoves)
      .values({
        code,
        type: createMoveDto.type,
        status: 'EN_TRAMITE',
        source: 'MANUAL',
        branchId: moveBranchId,
        fromWarehouseId: createMoveDto.fromWarehouseId,
        toWarehouseId: createMoveDto.toWarehouseId,
        note: createMoveDto.note,
        userId,
        date: new Date(),
      })
      .returning();

    for (const line of createMoveDto.lines || []) {
      await db.insert(inventoryMoveLines).values({
        moveId: newMove.id,
        productId: line.productId,
        batchId: line.batchId,
        quantity: line.quantity.toString(),
        cost: line.cost?.toString(),
      });
    }

    return this.findOneMove(newMove.id);
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
          Number(line.cost)
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
          Number(line.cost)
        );
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

    return this.toMoveResponseDto(updatedMove, true);
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

  private async generateMoveCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const existingMoves = await db
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
    const response: InventoryMoveResponseDto = {
      id: move.id,
      code: move.code,
      type: move.type,
      status: move.status,
      fromWarehouseId: move.fromWarehouseId,
      toWarehouseId: move.toWarehouseId,
      approvedBy: move.approvedBy,
      approvedAt: move.approvedAt,
      rejectionReason: move.rejectionReason,
      note: move.note,
      date: move.date,
      userId: move.userId,
    };

    if (includeLines) {
      const lines = await db
        .select()
        .from(inventoryMoveLines)
        .where(eq(inventoryMoveLines.moveId, move.id));

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

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (product) {
      productName = product.name;
      productSku = product.sku;
      minStock = product.minStock ?? null;
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
