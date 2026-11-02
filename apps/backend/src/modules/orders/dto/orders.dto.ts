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
import { DocumentEventDto } from '../../documents/dto/document-event.dto';

export enum OrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
}

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    description: 'Batch ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiProperty({
    description: 'Quantity',
    example: 10,
  })
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiProperty({
    description: 'Price per unit, expressed in the order currency',
    example: 25.5,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description:
      'Currency of `price`. Omit it when the price is already in the order currency; when present the API converts it before storing the line.',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  @IsOptional()
  @IsUUID()
  priceCurrencyId?: string;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Order code (unique)',
    example: 'ORD-2026-0001',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Partner ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  partnerId: string;

  @ApiPropertyOptional({
    description: 'Sucursal del pedido; si no se envía se toma de la cabecera `x-branch-id`',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Warehouse ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Order type',
    enum: OrderType,
    example: 'SALE',
  })
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  @ApiPropertyOptional({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional({
    description: 'Exchange rate',
    example: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiPropertyOptional({
    description: 'Order date',
    example: '2026-06-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({
    description: 'Order items',
    type: [CreateOrderItemDto],
    example: [
      {
        productId: '550e8400-e29b-41d4-a716-446655440001',
        quantity: 10,
        price: 25.5,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class UpdateOrderItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    description: 'Batch ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiProperty({
    description: 'Quantity',
    example: 15,
  })
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiProperty({
    description: 'Price per unit, expressed in the order currency',
    example: 30.0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Currency of `price`; omit it when it is already the order currency',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  @IsOptional()
  @IsUUID()
  priceCurrencyId?: string;
}

export class UpdateOrderDto {
  @ApiPropertyOptional({
    description: 'Warehouse ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Order status',
    enum: OrderStatus,
    example: 'CONFIRMED',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional({
    description: 'Exchange rate',
    example: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiPropertyOptional({
    description: 'Order date',
    example: '2026-06-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Order lines (replaces all lines); used when the rate or the currency changes',
    type: [UpdateOrderItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items?: UpdateOrderItemDto[];
}

export class OrderItemResponseDto {
  @ApiProperty({
    description: 'Order item ID',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  id: string;

  @ApiProperty({
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  orderId: string;

  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  productId: string;

  @ApiPropertyOptional({ example: 'ELEC-001', description: 'SKU del producto (ficha)' })
  productSku?: string | null;

  @ApiPropertyOptional({ example: 'Cable HDMI 2 m', description: 'Nombre del producto (ficha)' })
  productName?: string | null;

  @ApiPropertyOptional({
    description: 'Batch ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  batchId: string | null;

  @ApiProperty({
    description: 'Quantity',
    example: 10,
  })
  quantity: number;

  @ApiProperty({
    description: 'Price per unit',
    example: 25.5,
  })
  price: number;
}

export class OrderResponseDto {
  @ApiProperty({
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  id: string;

  @ApiProperty({
    description: 'Order code',
    example: 'ORD-2026-0001',
  })
  code: string;

  @ApiProperty({
    description: 'Partner ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  partnerId: string;

  @ApiPropertyOptional({
    description: 'Nombre del tercero (el listado lo resuelve para la UI)',
    example: 'Cliente Ejemplo C.A.',
  })
  partnerName?: string | null;

  @ApiProperty({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  branchId: string;

  @ApiPropertyOptional({
    description: 'Warehouse ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  warehouseId: string | null;

  @ApiProperty({
    description: 'Order type',
    enum: OrderType,
    example: 'SALE',
  })
  type: OrderType;

  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    example: 'DRAFT',
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Order total',
    example: 255.0,
  })
  total: number;

  @ApiPropertyOptional({
    description: 'Exchange rate',
    example: 1.0,
  })
  exchangeRate: number | null;

  @ApiPropertyOptional({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  currencyId: string | null;

  @ApiPropertyOptional({
    description: 'Order date',
    example: '2026-06-01T12:00:00.000Z',
  })
  date: Date | null;

  @ApiPropertyOptional({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  userId: string | null;

  @ApiPropertyOptional({
    description: 'Order creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;

  @ApiPropertyOptional({
    description: 'Order last update timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  updatedAt: Date | null;

  @ApiPropertyOptional({ example: 'J-12345678-9', description: 'RIF del tercero (ficha)' })
  partnerTaxId?: string | null;

  @ApiPropertyOptional({ example: 'USD', description: 'Código de la moneda del pedido' })
  currencyCode?: string | null;

  @ApiPropertyOptional({ example: 'Test Branch' })
  branchName?: string | null;

  @ApiPropertyOptional({ example: 'Almacén Principal' })
  warehouseName?: string | null;

  @ApiPropertyOptional({ example: 'Test Manager', description: 'Usuario que creó el pedido' })
  createdByName?: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440099',
    description: 'Factura generada por el pedido, si existe',
  })
  invoiceId?: string | null;

  @ApiPropertyOptional({ example: 'A-00021' })
  invoiceCode?: string | null;

  @ApiPropertyOptional({ example: 'DRAFT' })
  invoiceStatus?: string | null;

  @ApiPropertyOptional({
    description: 'Histórico de procesos del pedido y de su factura, en orden cronológico (`S-12`)',
    type: [DocumentEventDto],
  })
  history?: DocumentEventDto[];

  @ApiPropertyOptional({
    description: 'Order items',
    type: [OrderItemResponseDto],
  })
  items?: OrderItemResponseDto[];
}

export class OrderStatsResponseDto {
  @ApiProperty({
    description: 'Total number of orders',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Number of draft orders',
    example: 25,
  })
  draft: number;

  @ApiProperty({
    description: 'Number of confirmed orders',
    example: 30,
  })
  confirmed: number;

  @ApiProperty({
    description: 'Number of processing orders',
    example: 20,
  })
  processing: number;

  @ApiProperty({
    description: 'Number of completed orders',
    example: 20,
  })
  completed: number;

  @ApiProperty({
    description: 'Number of cancelled orders',
    example: 5,
  })
  cancelled: number;

  @ApiProperty({
    description: 'Total revenue from all orders',
    example: 50000.0,
  })
  totalRevenue: number;
}

export class ConfirmOrderResponseDto {
  @ApiProperty({
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  id: string;

  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    example: 'CONFIRMED',
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Confirmation message',
    example: 'Order confirmed successfully',
  })
  message: string;
}

export class CancelOrderResponseDto {
  @ApiProperty({
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  id: string;

  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    example: 'CANCELLED',
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Cancellation message',
    example: 'Order cancelled successfully',
  })
  message: string;
}
