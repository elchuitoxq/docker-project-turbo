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
import { DocumentEventDto } from '../../documents/dto/document-event.dto';

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
    description: 'Unit price, expressed in the document currency',
    example: 100.0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description:
      'Currency of `price`. Omit it when the price is already in the document currency; when present the API converts it before storing the line.',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  @IsOptional()
  @IsUUID()
  priceCurrencyId?: string;

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

  @ApiPropertyOptional({
    description: 'Sucursal del documento; si no se envía se toma de la cabecera `x-branch-id`',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Moneda del documento; por defecto, la moneda funcional (VES)',
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

  @ApiPropertyOptional({
    description: 'Número de factura del proveedor (compras)',
    example: '00001234',
  })
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @ApiPropertyOptional({
    description: 'Fecha de emisión de la factura del proveedor; por defecto, la del documento',
    example: '2026-06-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  supplierInvoiceDate?: string;

  @ApiProperty({
    description: 'Invoice items',
    type: [InvoiceItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class VoidInvoiceDto {
  @ApiPropertyOptional({
    description: 'Motivo de la anulación: queda en el histórico del documento (`S-12`)',
    example: 'Error en el precio del servicio',
  })
  @IsOptional()
  @IsString()
  reason?: string;
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

/** Pago aplicado a la factura, para la ficha del documento. */
export class InvoicePaymentSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  id: string;

  @ApiProperty({ example: 'PAY-00012' })
  code: string;

  @ApiPropertyOptional({ example: '2026-10-30T00:00:00.000Z' })
  date?: Date | null;

  @ApiProperty({ example: 1825.0, description: 'Importe del pago en su propia moneda' })
  amount: number;

  @ApiProperty({ example: 'VES' })
  currencyCode: string | null;

  @ApiPropertyOptional({ example: 36.5 })
  exchangeRate?: number | null;

  @ApiPropertyOptional({
    example: 'ZELLE-123456',
    description: 'Referencia de la transacción con la que se cobró/pagó',
  })
  reference?: string | null;

  @ApiProperty({ example: 'POSTED' })
  status: string | null;
}

/** Nota de crédito aplicada o emitida contra la factura. */
export class InvoiceCreditNoteSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440020' })
  id: string;

  @ApiProperty({ example: 'NC-00003' })
  code: string;

  @ApiProperty({ example: 100.0 })
  total: number;

  @ApiProperty({ example: 'POSTED' })
  status: string | null;
}

/** Comprobante de retención asociado a una factura de compra. */
export class InvoiceRetentionSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440030' })
  id: string;

  @ApiProperty({ example: 'IVA-2026-0007' })
  code: string;

  @ApiProperty({ example: 'IVA' })
  type: string;

  @ApiProperty({ example: 1000.0 })
  totalBase: number;

  @ApiProperty({ example: 120.0 })
  totalRetained: number;

  @ApiPropertyOptional({ example: '0007' })
  voucherNumber?: string | null;

  @ApiPropertyOptional({ example: '2026-10-30T00:00:00.000Z' })
  date?: Date | null;
}

/**
 * Saldo de la factura en **la moneda del documento** (ver `summarizeBalance`).
 *
 * Se expone como objeto para no repetir la ambigüedad de `total_base`: aquí todo está en la moneda
 * del documento, y el equivalente en moneda funcional se calcula con `exchangeRate`.
 */
export class InvoiceSettlementDto {
  @ApiProperty({ example: 1000.0 })
  total: number;

  @ApiProperty({ example: 400.0 })
  paid: number;

  @ApiProperty({ example: 100.0 })
  credited: number;

  @ApiProperty({ example: 120.0 })
  retained: number;

  @ApiProperty({ example: 620.0 })
  settled: number;

  @ApiProperty({ example: 380.0 })
  balance: number;
}

export class InvoiceResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'A-00001' })
  code: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  partnerId: string;

  @ApiPropertyOptional({ example: 'Cliente Ejemplo C.A.' })
  partnerName?: string | null;

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

  @ApiPropertyOptional({ example: 'PED-00012', description: 'Pedido que originó la factura' })
  orderCode?: string | null;

  @ApiPropertyOptional({ example: 'USD', description: 'Código de la moneda del documento' })
  currencyCode?: string | null;

  @ApiPropertyOptional({ example: 'Test Branch' })
  branchName?: string | null;

  @ApiPropertyOptional({ example: 'Almacén Principal' })
  warehouseName?: string | null;

  @ApiPropertyOptional({ example: 'Test Manager', description: 'Usuario que emitió el documento' })
  createdByName?: string | null;

  @ApiPropertyOptional({
    example: 12,
    description: 'Días vencidos respecto de `dueDate`; 0 si está vigente o sin vencimiento',
  })
  daysOverdue?: number;

  @ApiPropertyOptional({
    type: InvoiceSettlementDto,
    description: 'Total, pagado, acreditado, retenido y saldo en la moneda del documento',
  })
  settlement?: InvoiceSettlementDto;

  @ApiPropertyOptional({ type: [InvoicePaymentSummaryDto], description: 'Pagos aplicados' })
  payments?: InvoicePaymentSummaryDto[];

  @ApiPropertyOptional({ type: [InvoiceCreditNoteSummaryDto], description: 'Notas de crédito' })
  creditNotes?: InvoiceCreditNoteSummaryDto[];

  @ApiPropertyOptional({ type: [InvoiceRetentionSummaryDto], description: 'Retenciones (compras)' })
  retentions?: InvoiceRetentionSummaryDto[];

  @ApiPropertyOptional({ example: '2026-06-01T12:00:00.000Z' })
  createdAt?: Date | null;

  @ApiPropertyOptional({ example: '2026-06-01T12:00:00.000Z' })
  updatedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Histórico de procesos de la factura y de su pedido de origen (`S-12`)',
    type: [DocumentEventDto],
  })
  history?: DocumentEventDto[];

  @ApiPropertyOptional({ type: Object, description: 'Invoice items' })
  items?: InvoiceItemResponseDto[];
}

export class InvoiceItemResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  productId: string;

  @ApiPropertyOptional({
    example: 'ELEC-001',
    description: 'SKU del producto (ficha del documento)',
  })
  productSku?: string | null;

  @ApiPropertyOptional({ example: 'Cable HDMI 2 m', description: 'Nombre del producto' })
  productName?: string | null;

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
