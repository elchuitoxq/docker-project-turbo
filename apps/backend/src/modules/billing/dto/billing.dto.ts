import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  IsEnum,
  ValidateNested,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  PAID = 'PAID',
  VOID = 'VOID',
}

export enum InvoiceType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
}

export enum FiscalStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export class InvoiceItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 10,
    minimum: 1,
  })
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiProperty({
    description: 'Unit price',
    example: 100.0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Tax rate (default 16 for IVA)',
    example: 16.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Partner (customer/supplier) ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  partnerId: string;

  @ApiProperty({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({
    description: 'Currency ID (default USD)',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional({
    description: 'Warehouse ID for inventory',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Order ID (if created from order)',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Invoice type',
    enum: InvoiceType,
    default: InvoiceType.SALE,
  })
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @ApiPropertyOptional({
    description: 'Invoice number (for purchases)',
    example: 'FAC-12345',
  })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({
    description: 'Exchange rate (default 1)',
    example: 50.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiPropertyOptional({
    description: 'Due date',
    example: '2026-06-30T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({
    description: 'Invoice items',
    type: [InvoiceItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({
    description: 'Partner ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({
    description: 'Due date',
    example: '2026-06-30T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Exchange rate',
    example: 50.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiPropertyOptional({
    description: 'Invoice items (replaces all items)',
    type: [InvoiceItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
}

export class InvoiceResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'A-00001' })
  code: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  partnerId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  branchId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440003' })
  currencyId: string;

  @ApiPropertyOptional({ example: 50.0 })
  exchangeRate?: number | string | null;

  @ApiPropertyOptional({ example: 'SALE' })
  type?: string | null;

  @ApiPropertyOptional({ example: 'FAC-12345' })
  invoiceNumber?: string | null;

  @ApiPropertyOptional({ example: 'DRAFT' })
  status?: string | null;

  @ApiPropertyOptional({ example: 'PENDING' })
  fiscalStatus?: string | null;

  @ApiProperty({ example: 1000.0 })
  totalBase: number;

  @ApiProperty({ example: 160.0 })
  totalTax: number;

  @ApiProperty({ example: 34.8 })
  totalIgtf: number;

  @ApiProperty({ example: 1194.8 })
  total: number;

  @ApiPropertyOptional({ example: '2026-06-01T12:00:00.000Z' })
  date?: Date | null;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.000Z' })
  dueDate?: Date | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440004' })
  warehouseId?: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440005' })
  orderId?: string | null;

  @ApiPropertyOptional({ example: '2026-06-01T12:00:00.000Z' })
  createdAt?: Date | null;

  @ApiPropertyOptional({ example: '2026-06-01T12:00:00.000Z' })
  updatedAt?: Date | null;

  @ApiPropertyOptional({ type: Object, description: 'Invoice items' })
  items?: InvoiceItemResponseDto[];
}

export class InvoiceItemResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  productId: string;

  @ApiPropertyOptional({ example: 10 })
  quantity?: number | string;

  @ApiPropertyOptional({ example: 100.0 })
  price?: number | string;

  @ApiPropertyOptional({ example: 16.0 })
  taxRate?: number | string;

  @ApiProperty({ example: 1000.0 })
  total: number | string;
}

export class InvoiceStatsDto {
  @ApiProperty({ example: 150 })
  totalCount: number;

  @ApiProperty({ example: 75000.0 })
  totalAmount: number;

  @ApiProperty({ example: 45 })
  draftCount: number;

  @ApiProperty({ example: 80 })
  postedCount: number;

  @ApiProperty({ example: 25 })
  paidCount: number;

  @ApiProperty({ example: 5 })
  voidCount: number;
}

export class FiscalJsonDto {
  @ApiProperty({ description: 'Fiscal JSON for SENIAT' })
  controlCode: string;

  @ApiProperty({ description: 'Invoice number' })
  invoiceNumber: string;

  @ApiProperty({ description: 'Fiscal serial' })
  serial: string;

  @ApiProperty({ description: 'SENIAT verification URL' })
  verificationUrl: string;

  @ApiProperty({ description: 'Generation timestamp' })
  generationTimestamp: string;

  @ApiPropertyOptional({ description: 'Invoice date' })
  invoiceDate?: string | null;

  @ApiProperty({ description: 'RIF seller' })
  sellerRif: string;

  @ApiProperty({ description: 'RIF buyer' })
  buyerRif: string;

  @ApiProperty({ description: 'Total amount' })
  totalAmount: number;

  @ApiProperty({ description: 'Taxable amount' })
  taxableAmount: number;

  @ApiProperty({ description: 'IVA amount' })
  ivaAmount: number;

  @ApiProperty({ description: 'IV Aitf amount' })
  ivaIgtf: number;
}
