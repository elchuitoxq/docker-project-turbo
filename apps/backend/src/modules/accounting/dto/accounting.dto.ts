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

export enum AccountType {
  ACTIVO = 'ACTIVO',
  PASIVO = 'PASIVO',
  PATRIMONIO = 'PATRIMONIO',
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
  COSTO = 'costo',
  ORDEN = 'orden',
}

export enum EntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
}

export class CreateAccountDto {
  @ApiProperty({
    description: 'Account code (unique per branch)',
    example: '1.1.1.001',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Account name',
    example: 'Caja General',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Account type',
    enum: AccountType,
    example: 'ACTIVO',
  })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Parent account ID for hierarchy',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class AccountResponseDto {
  @ApiProperty({
    description: 'Account ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Account code',
    example: '1.1.1.001',
  })
  code: string;

  @ApiProperty({
    description: 'Account name',
    example: 'Caja General',
  })
  name: string;

  @ApiProperty({
    description: 'Account type',
    enum: AccountType,
    example: 'ACTIVO',
  })
  type: AccountType;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  branchId: string | null;

  @ApiPropertyOptional({
    description: 'Parent account ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  parentId: string | null;

  @ApiProperty({
    description: 'Whether the account is active',
    example: true,
  })
  isActive: boolean;
}

export class AccountTreeDto {
  @ApiProperty({
    description: 'Account ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Account code',
    example: '1.1.1.001',
  })
  code: string;

  @ApiProperty({
    description: 'Account name',
    example: 'Caja General',
  })
  name: string;

  @ApiProperty({
    description: 'Account type',
    enum: AccountType,
    example: 'ACTIVO',
  })
  type: AccountType;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  branchId: string | null;

  @ApiPropertyOptional({
    description: 'Parent account ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  parentId: string | null;

  @ApiProperty({
    description: 'Whether the account is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Child accounts',
    type: [AccountTreeDto],
  })
  children: AccountTreeDto[];
}

export class CreateEntryLineDto {
  @ApiProperty({
    description: 'Account ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    description: 'Debit amount',
    example: 1000.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  debit?: number;

  @ApiPropertyOptional({
    description: 'Credit amount',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  credit?: number;

  @ApiPropertyOptional({
    description: 'Line description',
    example: 'Venta de productos',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateEntryDto {
  @ApiProperty({
    description: 'Entry date',
    example: '2026-06-01T12:00:00.000Z',
  })
  @IsString()
  date: string;

  @ApiProperty({
    description: 'Entry description',
    example: 'Venta del dia',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Reference number',
    example: 'FV-2026-0001',
  })
  @IsOptional()
  @IsString()
  reference?: string | null;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiProperty({
    description: 'Entry lines (must sum to zero)',
    type: [CreateEntryLineDto],
    example: [
      {
        accountId: '550e8400-e29b-41d4-a716-446655440001',
        debit: 1000,
        credit: 0,
        description: 'Venta',
      },
      {
        accountId: '550e8400-e29b-41d4-a716-446655440004',
        debit: 0,
        credit: 1000,
        description: 'IVA por pagar',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEntryLineDto)
  lines: CreateEntryLineDto[];
}

export class EntryLineResponseDto {
  @ApiProperty({
    description: 'Line ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Entry ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  entryId: string;

  @ApiProperty({
    description: 'Account ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  accountId: string;

  @ApiPropertyOptional({
    description: 'Account code',
    example: '1.1.1.001',
  })
  accountCode: string | null;

  @ApiPropertyOptional({
    description: 'Account name',
    example: 'Caja General',
  })
  accountName: string | null;

  @ApiProperty({
    description: 'Debit amount',
    example: 1000,
  })
  debit: number;

  @ApiProperty({
    description: 'Credit amount',
    example: 0,
  })
  credit: number;

  @ApiPropertyOptional({
    description: 'Line description',
    example: 'Venta de productos',
  })
  description: string | null;
}

export class EntryResponseDto {
  @ApiProperty({
    description: 'Entry ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Entry date',
    example: '2026-06-01T12:00:00.000Z',
  })
  date: Date | null;

  @ApiProperty({
    description: 'Entry description',
    example: 'Venta del dia',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Reference number',
    example: 'FV-2026-0001',
  })
  reference: string | null;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  branchId: string | null;

  @ApiPropertyOptional({
    description: 'Branch name',
    example: 'Sucursal Principal',
  })
  branchName: string | null;

  @ApiProperty({
    description: 'Entry status',
    enum: EntryStatus,
    example: 'POSTED',
  })
  status: EntryStatus;

  @ApiPropertyOptional({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  userId: string | null;

  @ApiPropertyOptional({
    description: 'User name',
    example: 'Juan Perez',
  })
  userName: string | null;

  @ApiPropertyOptional({
    description: 'Creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;

  @ApiProperty({
    description: 'Entry lines',
    type: [EntryLineResponseDto],
  })
  lines: EntryLineResponseDto[];
}

export class CreateMapDto {
  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    description: 'Module (INVOICE, PAYMENT, etc.)',
    example: 'INVOICE',
  })
  @IsString()
  module: string;

  @ApiPropertyOptional({
    description: 'Transaction type (SALE, PURCHASE, INCOME, EXPENSE, etc.)',
    example: 'SALE',
  })
  @IsOptional()
  @IsString()
  transactionType?: string;

  @ApiPropertyOptional({
    description: 'Category ID for filtering',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Product ID for filtering',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Payment method ID for filtering',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiProperty({
    description: 'Debit account ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsUUID()
  debitAccountId: string;

  @ApiProperty({
    description: 'Credit account ID',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  @IsUUID()
  creditAccountId: string;
}

export class MapResponseDto {
  @ApiProperty({
    description: 'Map ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  branchId: string | null;

  @ApiProperty({
    description: 'Module',
    example: 'INVOICE',
  })
  module: string;

  @ApiPropertyOptional({
    description: 'Transaction type',
    example: 'SALE',
  })
  transactionType: string | null;

  @ApiPropertyOptional({
    description: 'Category ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  categoryId: string | null;

  @ApiPropertyOptional({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  productId: string | null;

  @ApiPropertyOptional({
    description: 'Payment method ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  paymentMethodId: string | null;

  @ApiPropertyOptional({
    description: 'Debit account ID',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  debitAccountId: string | null;

  @ApiPropertyOptional({
    description: 'Debit account code',
    example: '1.1.1.001',
  })
  debitAccountCode: string | null;

  @ApiPropertyOptional({
    description: 'Debit account name',
    example: 'Caja General',
  })
  debitAccountName: string | null;

  @ApiPropertyOptional({
    description: 'Credit account ID',
    example: '550e8400-e29b-41d4-a716-446655440007',
  })
  creditAccountId: string | null;

  @ApiPropertyOptional({
    description: 'Credit account code',
    example: '4.1.1.001',
  })
  creditAccountCode: string | null;

  @ApiPropertyOptional({
    description: 'Credit account name',
    example: 'Ventas',
  })
  creditAccountName: string | null;

  @ApiProperty({
    description: 'Whether the map is active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;
}

export class AccountingMapApplyResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Created entry ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  entryId: string;

  @ApiProperty({
    description: 'Result message',
    example: 'Map applied successfully. Entry created.',
  })
  message: string;
}
