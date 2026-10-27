import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum LoanStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum LoanType {
  QUOTA = 'QUOTA',
  ADVANCE = 'ADVANCE',
}

export class CreateLoanItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 1,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Serial number',
    example: 'SN-12345',
  })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Item condition',
    example: 'GOOD',
  })
  @IsOptional()
  @IsString()
  condition?: string;
}

export class CreateLoanDto {
  @ApiProperty({
    description: 'Loan code',
    example: 'LOAN-2026-001',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Partner ID (employee)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  partnerId: string;

  @ApiPropertyOptional({
    description: 'Loan type',
    enum: LoanType,
    example: 'QUOTA',
  })
  @IsOptional()
  @IsEnum(LoanType)
  type?: LoanType;

  @ApiPropertyOptional({
    description: 'Due date',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Notes',
    example: 'Loan for equipment',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Loan items',
    type: [CreateLoanItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLoanItemDto)
  items?: CreateLoanItemDto[];
}

export class UpdateLoanDto {
  @ApiPropertyOptional({
    description: 'Due date',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Return date',
    example: '2026-06-15T23:59:59.000Z',
  })
  @IsOptional()
  @IsString()
  returnDate?: string;

  @ApiPropertyOptional({
    description: 'Notes',
    example: 'Updated notes',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Loan status',
    enum: LoanStatus,
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;
}

export class PayLoanDto {
  @ApiProperty({
    description: 'Payment items to record',
    type: [CreateLoanItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLoanItemDto)
  items: CreateLoanItemDto[];
}

export class LoanItemResponseDto {
  @ApiProperty({
    description: 'Loan item ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Loan ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  loanId: string;

  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  productId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 1,
  })
  quantity: number;

  @ApiPropertyOptional({
    description: 'Serial number',
    example: 'SN-12345',
  })
  serialNumber: string | null;

  @ApiProperty({
    description: 'Condition',
    example: 'GOOD',
  })
  condition: string | null;

  @ApiProperty({
    description: 'Movimiento del ítem: entrega o devolución',
    enum: ['DELIVERED', 'RETURNED'],
    example: 'DELIVERED',
  })
  kind: 'DELIVERED' | 'RETURNED';
}

export class LoanResponseDto {
  @ApiProperty({
    description: 'Loan ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Loan code',
    example: 'LOAN-2026-001',
  })
  code: string;

  @ApiProperty({
    description: 'Partner ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  partnerId: string;

  @ApiProperty({
    description: 'Status',
    enum: LoanStatus,
    example: 'ACTIVE',
  })
  status: LoanStatus;

  @ApiPropertyOptional({
    description: 'Start date',
    example: '2026-06-01T12:00:00.000Z',
  })
  startDate: Date | null;

  @ApiPropertyOptional({
    description: 'Due date',
    example: '2026-12-31T23:59:59.000Z',
  })
  dueDate: Date | null;

  @ApiPropertyOptional({
    description: 'Return date',
    example: '2026-06-15T23:59:59.000Z',
  })
  returnDate: Date | null;

  @ApiPropertyOptional({
    description: 'Notes',
    example: 'Loan for equipment',
  })
  notes: string | null;

  @ApiPropertyOptional({
    description: 'Creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;

  @ApiPropertyOptional({
    description: 'Loan items',
    type: [LoanItemResponseDto],
  })
  items?: LoanItemResponseDto[];
}
