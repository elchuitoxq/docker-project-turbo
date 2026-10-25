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

export type CreditNoteStatus = 'DRAFT' | 'POSTED' | 'VOIDED' | 'APPLIED';

export class CreateCreditNoteItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({
    description: 'Price per unit',
    example: 100.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateCreditNoteDto {
  @ApiPropertyOptional({
    description: 'Invoice ID this credit note is related to',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiProperty({
    description: 'Partner ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  partnerId: string;

  @ApiProperty({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({
    description: 'Warehouse ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiProperty({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsUUID()
  currencyId: string;

  @ApiProperty({
    description: 'Exchange rate',
    example: 1.0,
  })
  @IsNumber()
  exchangeRate: number;

  @ApiPropertyOptional({
    description: 'Credit note date',
    example: '2026-06-01T12:00:00.000Z',
  })
  @IsOptional()
  date?: Date;

  @ApiProperty({
    description: 'Credit note items',
    type: [CreateCreditNoteItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCreditNoteItemDto)
  items: CreateCreditNoteItemDto[];
}

export class UpdateCreditNoteDto {
  @ApiPropertyOptional({
    description: 'Warehouse ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Exchange rate',
    example: 1.0,
  })
  @IsOptional()
  @IsNumber()
  exchangeRate?: number;

  @ApiPropertyOptional({
    description: 'Credit note date',
    example: '2026-06-01T12:00:00.000Z',
  })
  @IsOptional()
  date?: Date;
}

export class ApplyCreditNoteDto {
  @ApiProperty({
    description: 'Amount to apply',
    example: 500.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreditNoteItemResponseDto {
  @ApiProperty({
    description: 'Item ID',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  id: string;

  @ApiProperty({
    description: 'Credit note ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  creditNoteId: string;

  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  productId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 5,
  })
  quantity: number;

  @ApiProperty({
    description: 'Price per unit',
    example: 100.0,
  })
  price: number;

  @ApiProperty({
    description: 'Total amount',
    example: 500.0,
  })
  total: number;
}

export class CreditNoteUsageResponseDto {
  @ApiProperty({
    description: 'Usage ID',
    example: '550e8400-e29b-41d4-a716-446655440020',
  })
  id: string;

  @ApiProperty({
    description: 'Credit note ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  creditNoteId: string;

  @ApiProperty({
    description: 'Payment ID',
    example: '550e8400-e29b-41d4-a716-446655440021',
  })
  paymentId: string;

  @ApiProperty({
    description: 'Amount used',
    example: 250.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;
}

export class CreditNoteResponseDto {
  @ApiProperty({
    description: 'Credit note ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  id: string;

  @ApiProperty({
    description: 'Credit note code',
    example: 'CN-2026-0001',
  })
  code: string;

  @ApiPropertyOptional({
    description: 'Invoice ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  invoiceId: string | null;

  @ApiProperty({
    description: 'Partner ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  partnerId: string;

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
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  currencyId: string;

  @ApiProperty({
    description: 'Exchange rate',
    example: 1.0,
  })
  exchangeRate: number;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'POSTED', 'VOIDED', 'APPLIED'],
    example: 'DRAFT',
  })
  status: CreditNoteStatus;

  @ApiProperty({
    description: 'Total base amount',
    example: 500.0,
  })
  totalBase: number;

  @ApiProperty({
    description: 'Total tax amount',
    example: 80.0,
  })
  totalTax: number;

  @ApiProperty({
    description: 'Total IGTF amount',
    example: 0.0,
  })
  totalIgtf: number;

  @ApiProperty({
    description: 'Total amount',
    example: 580.0,
  })
  total: number;

  @ApiProperty({
    description: 'Available amount (total - used)',
    example: 580.0,
  })
  availableAmount: number;

  @ApiProperty({
    description: 'Credit note date',
    example: '2026-06-01T12:00:00.000Z',
  })
  date: Date | null;

  @ApiPropertyOptional({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440030',
  })
  userId: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  updatedAt: Date | null;

  @ApiPropertyOptional({
    description: 'Credit note items',
    type: [CreditNoteItemResponseDto],
  })
  items?: CreditNoteItemResponseDto[];

  @ApiPropertyOptional({
    description: 'Credit note usages',
    type: [CreditNoteUsageResponseDto],
  })
  usages?: CreditNoteUsageResponseDto[];
}

export class CreditNoteListResponseDto {
  @ApiProperty({
    description: 'Credit note ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  id: string;

  @ApiProperty({
    description: 'Credit note code',
    example: 'CN-2026-0001',
  })
  code: string;

  @ApiProperty({
    description: 'Partner ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  partnerId: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'POSTED', 'VOIDED', 'APPLIED'],
    example: 'DRAFT',
  })
  status: CreditNoteStatus;

  @ApiProperty({
    description: 'Total amount',
    example: 580.0,
  })
  total: number;

  @ApiProperty({
    description: 'Available amount',
    example: 580.0,
  })
  availableAmount: number;

  @ApiProperty({
    description: 'Credit note date',
    example: '2026-06-01T12:00:00.000Z',
  })
  date: Date | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;
}

export class PostCreditNoteResponseDto {
  @ApiProperty({
    description: 'Credit note ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  id: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'POSTED', 'VOIDED', 'APPLIED'],
    example: 'POSTED',
  })
  status: CreditNoteStatus;

  @ApiProperty({
    description: 'Message',
    example: 'Credit note posted successfully',
  })
  message: string;
}

export class VoidCreditNoteResponseDto {
  @ApiProperty({
    description: 'Credit note ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  id: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'POSTED', 'VOIDED', 'APPLIED'],
    example: 'VOIDED',
  })
  status: CreditNoteStatus;

  @ApiProperty({
    description: 'Message',
    example: 'Credit note voided successfully',
  })
  message: string;
}

export class ApplyCreditNoteResponseDto {
  @ApiProperty({
    description: 'Credit note ID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  id: string;

  @ApiProperty({
    description: 'Invoice ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  invoiceId: string;

  @ApiProperty({
    description: 'Amount applied',
    example: 500.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Remaining available amount',
    example: 80.0,
  })
  remainingAvailableAmount: number;

  @ApiProperty({
    description: 'Message',
    example: 'Credit note applied to invoice successfully',
  })
  message: string;
}
