import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Tipo de cuenta del plan contable. Vocabulario único de almacenamiento y API (H-73): el seed y
 * `docs/DATABASE.md` ya usaban inglés, el enum del DTO hablaba español. Reportes y validaciones
 * dependen de estos valores, así que la migración `0013` normalizó los datos existentes.
 */
export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
  COST = 'COST',
  ORDER = 'ORDER',
}

export enum EntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
}

export enum PeriodStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

/** Origen del asiento; la pareja `(sourceType, sourceId)` es única (idempotencia, regla 4 de S-04). */
export enum EntrySourceType {
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  CREDIT_NOTE = 'CREDIT_NOTE',
  PAYROLL = 'PAYROLL',
  INVENTORY = 'INVENTORY',
  MANUAL = 'MANUAL',
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

  @ApiPropertyOptional({ description: 'Parent account ID for hierarchy' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    description:
      'Si acepta líneas de asiento. Por defecto `true`; al crear una hija pasa a `false`',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPostable?: boolean;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Caja General' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: AccountType })
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @ApiPropertyOptional({ description: 'Parent account ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPostable?: boolean;

  @ApiPropertyOptional({ description: 'Desactivar la cuenta sin borrarla' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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
    example: 'ASSET',
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

  @ApiProperty({ description: 'Si acepta líneas de asiento', example: true })
  isPostable: boolean;

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
    example: 'ASSET',
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

  @ApiProperty({ description: 'Si acepta líneas de asiento', example: true })
  isPostable: boolean;

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
    description: 'Importe original en la moneda del documento (si difiere de la funcional)',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  originalAmount?: number;

  @ApiPropertyOptional({
    description: 'Moneda del importe original',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  originalCurrencyId?: string;

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

  @ApiPropertyOptional({
    enum: [EntryStatus.DRAFT, EntryStatus.POSTED],
    description: 'Por defecto `POSTED`. Un `DRAFT` se edita y se postea después (T-04-02)',
  })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;

  @ApiPropertyOptional({ enum: EntrySourceType, description: 'Documento que origina el asiento' })
  @IsOptional()
  @IsEnum(EntrySourceType)
  sourceType?: EntrySourceType;

  @ApiPropertyOptional({ description: 'ID del documento origen (idempotencia por par)' })
  @IsOptional()
  @IsUUID()
  sourceId?: string;
}

/** Edición de un asiento en borrador: reemplaza cabecera y líneas por completo. */
export class UpdateEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string | null;

  @ApiPropertyOptional({ type: [CreateEntryLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEntryLineDto)
  lines?: CreateEntryLineDto[];
}

export class PeriodResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  id: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 10 })
  month: number;

  @ApiProperty({ enum: PeriodStatus, example: 'OPEN' })
  status: PeriodStatus;

  @ApiPropertyOptional({ example: '2026-11-01T12:00:00.000Z' })
  closedAt?: string | null;

  @ApiPropertyOptional()
  closedBy?: string | null;

  @ApiPropertyOptional({ example: '2026-11-02T09:00:00.000Z' })
  reopenedAt?: string | null;

  @ApiPropertyOptional({ example: 'Ajuste de retención omitida' })
  reopenReason?: string | null;

  @ApiPropertyOptional({ description: 'Asientos del período (incluye borradores)' })
  entries?: number;

  @ApiPropertyOptional({ description: 'Total debe de los asientos posteados' })
  totalDebit?: number;

  @ApiPropertyOptional({ description: 'Total haber de los asientos posteados' })
  totalCredit?: number;
}

export class ReopenPeriodDto {
  @ApiProperty({ description: 'Motivo de la reapertura; queda en la auditoría', example: 'Ajuste' })
  @IsString()
  reason: string;
}

export class EntryLineResponseDto {
  @ApiPropertyOptional({
    description: 'Importe original en la moneda del documento',
    example: 100,
    nullable: true,
  })
  originalAmount?: number | null;

  @ApiPropertyOptional({
    description: 'Moneda del importe original',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  originalCurrencyId?: string | null;
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
  @ApiPropertyOptional({
    description: 'Moneda funcional del libro (VES)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  baseCurrencyId?: string | null;

  @ApiPropertyOptional({
    description: 'Tasa del documento origen congelada al registrar el asiento',
    example: 36.5,
  })
  exchangeRate?: number;
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
    description: 'Documento que originó el asiento',
    enum: EntrySourceType,
    example: 'INVOICE',
  })
  sourceType?: string | null;

  @ApiPropertyOptional({ description: 'ID del documento origen' })
  sourceId?: string | null;

  @ApiPropertyOptional({ description: 'Momento del posteo (DRAFT → POSTED)' })
  postedAt?: Date | null;

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
