import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateWarehouseDto {
  @ApiProperty({
    description: 'Warehouse name',
    example: 'Main Warehouse',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Warehouse address',
    example: '123 Main Street, City',
  })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional({
    description: 'Warehouse name',
    example: 'Main Warehouse Updated',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Warehouse address',
    example: '456 New Street, City',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Is active',
    example: true,
  })
  @IsOptional()
  @IsNumber()
  isActive?: number;
}

export class WarehouseResponseDto {
  @ApiProperty({
    description: 'Warehouse ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  branchId: string | null;

  @ApiProperty({
    description: 'Warehouse name',
    example: 'Main Warehouse',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Warehouse address',
    example: '123 Main Street, City',
  })
  address: string | null;

  @ApiProperty({
    description: 'Is active',
    example: true,
  })
  isActive: boolean;
}

export class InventoryMoveLineDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    description: 'Batch ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({
    description:
      'Número de lote. En una entrada, si el lote no existe se crea en ese momento (recepción); si existe se reutiliza.',
    example: 'L-2026-001',
  })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional({
    description: 'Fecha de vencimiento del lote (ISO). Sólo se usa cuando el lote se crea',
    example: '2027-01-31T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  batchExpirationDate?: string;

  @ApiPropertyOptional({
    description: 'Quantity',
    example: 100,
  })
  @IsString()
  quantity: string;

  @ApiPropertyOptional({
    description: 'Cost',
    example: 25.5,
  })
  @IsOptional()
  @IsString()
  cost?: string | null;
}

export class InventoryMoveLineResponseDto {
  @ApiProperty({
    description: 'Line ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Move ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  moveId: string;

  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  productId: string;

  @ApiPropertyOptional({
    description: 'Batch ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  batchId: string | null;

  @ApiProperty({
    description: 'Quantity',
    example: 100,
  })
  quantity: string;

  @ApiPropertyOptional({
    description: 'Cost',
    example: 25.5,
  })
  cost: string | null;
}

export class CreateInventoryMoveDto {
  @ApiProperty({
    description:
      'Move type. `AJUSTE` sets the stock to the counted quantity (physical count adjustment)',
    enum: ['ENTRADA', 'SALIDA', 'TRANSFERENCIA', 'AJUSTE'],
    example: 'ENTRADA',
  })
  @IsEnum(['ENTRADA', 'SALIDA', 'TRANSFERENCIA', 'AJUSTE'])
  type: string;

  @ApiPropertyOptional({
    description: 'Warehouse ID (for ENTRADA)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'From warehouse ID (for TRANSFERENCIA)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  fromWarehouseId?: string;

  @ApiPropertyOptional({
    description: 'To warehouse ID (for TRANSFERENCIA)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  toWarehouseId?: string;

  @ApiPropertyOptional({
    description: 'Reason ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  reasonId?: string;

  @ApiPropertyOptional({
    description:
      'Motivo del ajuste. Obligatorio cuando `type` es `AJUSTE` (CONTEO, DAÑO, VENCIMIENTO, HURTO, ERROR_DIGITACION).',
    enum: ['CONTEO', 'DAÑO', 'VENCIMIENTO', 'HURTO', 'ERROR_DIGITACION'],
    example: 'CONTEO',
  })
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiPropertyOptional({
    description: 'Reference number',
    example: 'REF-001',
  })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'Notes',
    example: 'Opening stock adjustment',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Move date',
    example: '2026-06-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Move lines',
    type: [InventoryMoveLineDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryMoveLineDto)
  lines?: {
    productId: string;
    batchId?: string;
    batchNumber?: string;
    batchExpirationDate?: string;
    quantity: string;
    cost?: string;
  }[];

  @ApiPropertyOptional({
    description:
      'Autoriza despachar un lote posterior al sugerido por FEFO. Exige `fefoOverrideReason` (S-26).',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  fefoOverride?: boolean;

  @ApiPropertyOptional({
    description: 'Motivo del despacho fuera de FEFO (obligatorio si `fefoOverride` es `true`)',
    example: 'El cliente exige el lote de la orden de compra',
  })
  @IsOptional()
  @IsString()
  fefoOverrideReason?: string;
}

export class ApproveInventoryMovesBatchDto {
  @ApiProperty({
    description: 'IDs de los movimientos a aprobar',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  ids: string[];
}

export class RejectInventoryMoveDto {
  @ApiProperty({
    description: 'Rejection reason',
    example: 'Invalid quantities',
  })
  @IsString()
  reason: string;
}

export class InventoryMoveResponseDto {
  @ApiProperty({
    description: 'Move ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Move code',
    example: 'INV-2026-00001',
  })
  code: string;

  @ApiProperty({
    description: 'Move type',
    enum: ['ENTRADA', 'SALIDA', 'TRANSFERENCIA'],
    example: 'ENTRADA',
  })
  type: string;

  @ApiProperty({
    description: 'Move status',
    enum: ['EN_TRAMITE', 'APPROVED', 'REJECTED', 'CANCELLED'],
    example: 'EN_TRAMITE',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Source warehouse ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  fromWarehouseId: string | null;

  @ApiPropertyOptional({
    description: 'Destination warehouse ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  toWarehouseId: string | null;

  @ApiPropertyOptional({ description: 'Almacén de referencia (origen, o destino en una entrada)' })
  warehouseId?: string | null;

  @ApiPropertyOptional({ description: 'Nombre del almacén de referencia' })
  warehouseName?: string | null;

  @ApiPropertyOptional({ description: 'Almacén destino en transferencias' })
  warehouseDestId?: string | null;

  @ApiPropertyOptional({ description: 'Nombre del almacén destino' })
  warehouseDestName?: string | null;

  @ApiPropertyOptional({ description: 'Producto de la primera línea' })
  productId?: string | null;

  @ApiPropertyOptional({ description: 'Nombre del producto de la primera línea' })
  productName?: string | null;

  @ApiPropertyOptional({ description: 'SKU del producto de la primera línea' })
  productSku?: string | null;

  @ApiPropertyOptional({ description: 'Cantidad de la primera línea' })
  quantity?: string | null;

  @ApiPropertyOptional({ description: 'Costo unitario de la primera línea' })
  unitCost?: string | null;

  @ApiPropertyOptional({ description: 'Costo total de la primera línea' })
  totalCost?: string | null;

  @ApiPropertyOptional({
    description: 'Approved by user ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  approvedBy: string | null;

  @ApiPropertyOptional({
    description: 'Approved at timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  approvedAt: Date | null;

  @ApiPropertyOptional({
    description: 'Rejection reason',
    example: 'Insufficient stock',
  })
  rejectionReason: string | null;

  @ApiPropertyOptional({
    description: 'Note',
    example: 'Initial stock entry',
  })
  note: string | null;

  @ApiPropertyOptional({
    description: 'Move date',
    example: '2026-06-01T12:00:00.000Z',
  })
  date?: Date | null;

  @ApiPropertyOptional({
    description: 'User ID who created the move',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  userId: string | null;

  @ApiPropertyOptional({
    description: 'Motivo del ajuste (`S-25`)',
    enum: ['CONTEO', 'DAÑO', 'VENCIMIENTO', 'HURTO', 'ERROR_DIGITACION'],
  })
  reasonCode?: string | null;

  @ApiPropertyOptional({
    description:
      'La diferencia superó la tolerancia: no puede aprobarla la misma persona que la registró (`S-25`)',
  })
  requiresSecondApproval?: boolean;

  @ApiPropertyOptional({
    description: 'La salida despachó un lote posterior al sugerido por FEFO (`S-26`)',
  })
  fefoOverride?: boolean;

  @ApiPropertyOptional({ description: 'Motivo del despacho fuera de FEFO (`S-26`)' })
  fefoOverrideReason?: string | null;

  @ApiPropertyOptional({
    description: 'Move lines',
    type: [InventoryMoveLineResponseDto],
  })
  lines?: InventoryMoveLineResponseDto[];
}

export class ApproveInventoryMovesBatchResponseDto {
  @ApiProperty({ description: 'Códigos de los movimientos aprobados', type: [String] })
  approved: string[];

  @ApiProperty({
    description: 'Movimientos que no se pudieron aprobar con el motivo',
    type: 'array',
    items: {
      type: 'object',
      properties: { id: { type: 'string' }, message: { type: 'string' } },
    },
  })
  failed: { id: string; message: string }[];
}

export class ProductBatchResponseDto {
  @ApiProperty({ description: 'Batch ID' })
  id: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Número de lote' })
  batchNumber: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento' })
  expirationDate: Date | null;

  @ApiPropertyOptional({ description: 'Costo del lote' })
  cost: string | null;

  @ApiPropertyOptional({
    description:
      'Cantidad disponible del lote en el almacén consultado, descontando las reservas activas',
  })
  availableQuantity?: string;

  @ApiPropertyOptional({ description: 'Cantidad reservada por salidas en borrador (`S-26`)' })
  reservedQuantity?: string;

  @ApiPropertyOptional({ description: 'El lote está habilitado para recibir y despachar' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'El lote ya venció: no se puede despachar (`S-26`)' })
  expired?: boolean;
}

export class CreateProductBatchDto {
  @ApiProperty({ description: 'Número de lote', example: 'L-2026-001' })
  @IsString()
  batchNumber: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento (ISO)', example: '2027-01-31' })
  @IsOptional()
  @IsString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Costo del lote', example: '25.50' })
  @IsOptional()
  @IsString()
  cost?: string;
}

export class StockResponseDto {
  @ApiProperty({
    description: 'Stock ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Warehouse ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  warehouseId: string;

  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  productId: string;

  @ApiPropertyOptional({
    description: 'Batch ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  batchId: string | null;

  @ApiPropertyOptional({
    description: 'Quantity',
    example: 100,
  })
  quantity?: string | null;

  @ApiPropertyOptional({
    description: 'Updated at',
    example: '2026-06-01T12:00:00.000Z',
  })
  updatedAt: Date | null;

  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Laptop Pro 15',
  })
  productName?: string;

  @ApiPropertyOptional({
    description: 'Product SKU',
    example: 'ELEC-001',
  })
  productSku?: string;

  @ApiPropertyOptional({
    description: 'Batch number',
    example: 'BATCH-2026-001',
  })
  batchNumber?: string;

  @ApiPropertyOptional({
    description: 'Stock mínimo del producto',
    example: '10.00',
  })
  minStock?: string | null;

  @ApiProperty({
    description: 'El stock está por debajo del mínimo del producto (T-07-06)',
    example: false,
  })
  belowMinimum: boolean;

  @ApiPropertyOptional({
    description:
      'Costo promedio móvil del producto (área de valoración = empresa). Es el costo con el que se valúa el inventario, no el de cada almacén (`S-25`).',
    example: '25.50',
  })
  averageCost?: string | null;

  @ApiPropertyOptional({
    description: 'Valor del inventario de esta fila: cantidad × costo promedio',
    example: '2550.00',
  })
  totalValue?: string | null;

  @ApiPropertyOptional({
    description: 'El producto maneja lotes: la salida debe elegir lote (FEFO)',
    example: false,
  })
  hasBatches?: boolean;
}
