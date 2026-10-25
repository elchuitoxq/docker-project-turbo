import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
  IsArray,
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
    description: 'Quantity',
    example: 100,
  })
  quantity?: string | null;

  @ApiPropertyOptional({
    description: 'Cost',
    example: 25.50,
  })
  cost: string | null;
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
    example: 25.50,
  })
  cost: string | null;
}

export class CreateInventoryMoveDto {
  @ApiProperty({
    description: 'Move type',
    enum: ['ENTRADA', 'SALIDA', 'TRANSFERENCIA'],
    example: 'ENTRADA',
  })
  @IsEnum(['ENTRADA', 'SALIDA', 'TRANSFERENCIA'])
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
    type: [InventoryMoveLineResponseDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryMoveLineResponseDto)
  lines?: {
    productId: string;
    batchId?: string;
    quantity: string;
    cost?: string;
  }[];
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
    description: 'Move lines',
    type: [InventoryMoveLineResponseDto],
  })
  lines?: InventoryMoveLineResponseDto[];
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
}
