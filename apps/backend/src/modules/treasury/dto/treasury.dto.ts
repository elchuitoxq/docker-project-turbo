import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentStatus {
  POSTED = 'POSTED',
  VOID = 'VOID',
}

export enum PaymentType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export class CreatePaymentDto {
  @ApiPropertyOptional({
    description: 'Invoice ID to link payment',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiProperty({
    description: 'Partner ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  partnerId: string;

  @ApiProperty({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  branchId: string;

  @ApiProperty({
    description: 'Payment method ID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsUUID()
  methodId: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 1000.0,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsUUID()
  currencyId: string;

  @ApiProperty({
    description: 'Exchange rate',
    example: 50.0,
  })
  @IsNumber()
  @Min(0)
  exchangeRate: number;

  @ApiPropertyOptional({
    description: 'Bank account ID',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional({
    description: 'Reference number',
    example: 'ZELLE-123456',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Payment date ISO string',
    example: '2026-06-01T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Payment type',
    enum: PaymentType,
    default: PaymentType.INCOME,
  })
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;
}

export class PaymentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  invoiceId?: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  partnerId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440003' })
  branchId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440004' })
  methodId: string;

  @ApiPropertyOptional({ example: 'POSTED' })
  status?: string | null;

  @ApiPropertyOptional({ example: 'INCOME' })
  type?: string | null;

  @ApiProperty({ example: 1000.0 })
  amount: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440005' })
  currencyId: string;

  @ApiPropertyOptional({ example: 50.0 })
  exchangeRate?: number | string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440006' })
  bankAccountId?: string | null;

  @ApiPropertyOptional({ example: 'ZELLE-123456' })
  reference?: string | null;

  @ApiPropertyOptional({ example: '2026-06-01T12:00:00.000Z' })
  date?: Date | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440007' })
  payrollRunId?: string | null;

  @ApiPropertyOptional({ example: '2026-06-01T12:00:00.000Z' })
  createdAt?: Date | null;
}

export class PaymentMethodResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Efectivo USD' })
  name: string;

  @ApiProperty({ example: 'CASH_USD' })
  code: string;

  @ApiPropertyOptional({ example: false })
  isDigital?: boolean | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  currencyId?: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  branchId?: string | null;
}

export class BankAccountResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Banesco Principal' })
  name: string;

  @ApiPropertyOptional({ example: '****1234' })
  accountNumber?: string | null;

  @ApiProperty({ example: 'CHECKING' })
  type: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  currencyId: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  branchId?: string | null;

  @ApiProperty({ example: 5000.0 })
  currentBalance: number;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean | null;
}

export class CreatePaymentMethodDto {
  @ApiProperty({ example: 'Efectivo USD' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'CASH_USD' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: 'Is digital payment method' })
  @IsOptional()
  isDigital?: boolean;

  @ApiPropertyOptional({ description: 'Currency ID' })
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CreateBankAccountDto {
  @ApiProperty({ example: 'Banesco Principal' })
  @IsString()
  name: string;

  @ApiProperty({ example: '****12345678' })
  @IsString()
  accountNumber: string;

  @ApiProperty({ example: 'CHECKING' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Currency ID' })
  @IsUUID()
  currencyId: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Initial balance' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentBalance?: number;
}

export class PartnerStatementDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  partnerId: string;

  @ApiProperty({ example: 'Partner Name' })
  partnerName: string;

  @ApiProperty({ example: 'J-123456789' })
  partnerTaxId: string;

  @ApiProperty({ example: 5000.0 })
  totalPaid: number;

  @ApiProperty({ example: 3500.0 })
  totalOutstanding: number;

  @ApiProperty({ example: 1500.0 })
  creditBalance: number;

  @ApiProperty({ type: [PaymentResponseDto] })
  recentPayments: PaymentResponseDto[];

  @ApiProperty({ type: [Object] })
  outstandingInvoices: {
    id: string;
    code: string;
    date?: Date | null;
    total: number;
    paid: number;
    pending: number;
  }[];
}

export class DailyCloseDto {
  @ApiProperty({ example: '2026-06-01' })
  date: string;

  @ApiProperty({ example: 15000.0 })
  totalIncome: number;

  @ApiProperty({ example: 5000.0 })
  totalExpense: number;

  @ApiProperty({ example: 10000.0 })
  netBalance: number;

  @ApiProperty({ type: [Object] })
  byPaymentMethod: {
    methodName: string;
    income: number;
    expense: number;
  }[];

  @ApiProperty({ type: [Object] })
  byCurrency: {
    currencyCode: string;
    income: number;
    expense: number;
  }[];
}
