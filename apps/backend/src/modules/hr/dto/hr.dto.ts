import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TERMINATED = 'TERMINATED',
}

export enum PayrollRunStatus {
  DRAFT = 'DRAFT',
  PROCESSED = 'PROCESSED',
  PAID = 'PAID',
}

export enum PayFrequency {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'V-12345678' })
  @IsString()
  identityCard: string;

  @ApiPropertyOptional({ example: 'juan@empresa.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+58 412 1234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Position ID' })
  @IsUUID()
  positionId: string;

  @ApiProperty({ description: 'Department ID' })
  @IsUUID()
  departmentId: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ description: 'Base salary' })
  @IsNumber()
  @Min(0)
  baseSalary: number;

  @ApiPropertyOptional({ description: 'Salary currency ID' })
  @IsOptional()
  @IsUUID()
  salaryCurrencyId?: string;

  @ApiPropertyOptional({ enum: PayFrequency, default: PayFrequency.BIWEEKLY })
  @IsOptional()
  @IsEnum(PayFrequency)
  payFrequency?: PayFrequency;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Bank ID' })
  @IsOptional()
  @IsUUID()
  bankId?: string;

  @ApiPropertyOptional({ description: 'Bank account number' })
  @IsOptional()
  @IsString()
  accountNumber?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Juan' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+58 412 7654321' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Position ID' })
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({ description: 'Department ID' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Base salary' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'Termination reason' })
  @IsOptional()
  @IsString()
  terminationReason?: string;

  @ApiPropertyOptional({ description: 'Termination date' })
  @IsOptional()
  @IsDateString()
  terminationDate?: string;
}

export class EmployeeBankAccountDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  bankId: string;

  @ApiProperty({ example: '0134-5678-9012-3456-7890' })
  accountNumber: string;

  @ApiPropertyOptional({ example: 'CHECKING' })
  accountType?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  currencyId?: string;

  @ApiProperty({ example: true })
  isPrimary: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class CreateEmployeeBankAccountDto {
  @ApiProperty({ description: 'Bank ID' })
  @IsUUID()
  bankId: string;

  @ApiProperty({ description: 'Account number' })
  @IsString()
  accountNumber: string;

  @ApiPropertyOptional({ example: 'CHECKING' })
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional({ description: 'Currency ID' })
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional({ description: 'Is primary account' })
  @IsOptional()
  isPrimary?: boolean;
}

export class EmployeeResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Juan' })
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  lastName: string;

  @ApiProperty({ example: 'V-12345678' })
  identityCard: string;

  @ApiPropertyOptional({ example: 'juan@empresa.com' })
  email?: string;

  @ApiPropertyOptional({ example: '+58 412 1234567' })
  phone?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  positionId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  departmentId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440003' })
  branchId?: string;

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00.000Z' })
  hireDate?: Date | null;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  terminationDate?: Date | null;

  @ApiPropertyOptional({ example: 'Voluntary resignation' })
  terminationReason?: string;

  @ApiProperty({ example: 1500.00 })
  baseSalary: number;

  @ApiPropertyOptional({ example: 'BIWEEKLY' })
  payFrequency?: string;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  status?: string;

  @ApiProperty({ example: 'Gerente' })
  positionName?: string;

  @ApiProperty({ example: 'Ventas' })
  departmentName?: string;

  @ApiPropertyOptional({ type: [EmployeeBankAccountDto] })
  bankAccounts?: EmployeeBankAccountDto[];
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Ventas' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Parent department ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ description: 'Branch ID' })
  @IsUUID()
  branchId: string;
}

export class CreatePositionDto {
  @ApiProperty({ example: 'Gerente de Ventas' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Responsible for sales team' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Currency ID' })
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional({ description: 'Minimum salary' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalaryMin?: number;

  @ApiPropertyOptional({ description: 'Maximum salary' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalaryMax?: number;
}

export class CreatePayrollRunDto {
  @ApiProperty({ description: 'Branch ID' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ enum: PayFrequency })
  @IsEnum(PayFrequency)
  frequency: PayFrequency;

  @ApiProperty({ description: 'Start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Currency ID' })
  @IsUUID()
  currencyId: string;
}

export class PayrollRunResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'NOM-2026-06-01' })
  code: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  branchId: string;

  @ApiPropertyOptional({ example: 'BIWEEKLY' })
  frequency?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  currencyId: string;

  @ApiPropertyOptional({ example: '2026-05-16T00:00:00.000Z' })
  startDate?: Date | null;

  @ApiPropertyOptional({ example: '2026-05-31T00:00:00.000Z' })
  endDate?: Date | null;

  @ApiProperty({ example: 15000.00 })
  totalAmount: number;

  @ApiPropertyOptional({ example: 'DRAFT' })
  status?: string | null;

  @ApiPropertyOptional({ example: '2026-06-01T12:00:00.000Z' })
  createdAt?: Date | null;

  @ApiPropertyOptional({ type: [Object] })
  items?: PayrollItemResponseDto[];
}

export class PayrollItemResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  employeeId: string;

  @ApiProperty({ example: 'Juan Pérez' })
  employeeName?: string;

  @ApiProperty({ example: 1500.00 })
  baseAmount: number;

  @ApiProperty({ example: 200.00 })
  bonuses: number;

  @ApiProperty({ example: 150.00 })
  deductions: number;

  @ApiProperty({ example: 1550.00 })
  netTotal: number;

  @ApiPropertyOptional({ type: [Object] })
  lines?: {
    conceptCode: string;
    conceptName: string;
    category: string;
    base: number;
    rate: number;
    amount: number;
  }[];
}

export class CreateIncidentDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ description: 'Concept type ID' })
  @IsUUID()
  conceptId: string;

  @ApiProperty({ description: 'Incident date' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Quantity (for hours, days)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Amount (for fixed amounts)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayslipDto {
  @ApiProperty({ example: 'Juan Pérez' })
  employeeName: string;

  @ApiProperty({ example: 'Gerente' })
  position: string;

  @ApiProperty({ example: '2026-05-16' })
  periodStart: string;

  @ApiProperty({ example: '2026-05-31' })
  periodEnd: string;

  @ApiProperty({ example: 1500.00 })
  baseSalary: number;

  @ApiProperty({ type: [Object] })
  incomeConcepts: {
    code: string;
    name: string;
    amount: number;
  }[];

  @ApiProperty({ type: [Object] })
  deductionConcepts: {
    code: string;
    name: string;
    amount: number;
  }[];

  @ApiProperty({ example: 200.00 })
  totalIncome: number;

  @ApiProperty({ example: 150.00 })
  totalDeductions: number;

  @ApiProperty({ example: 1550.00 })
  netSalary: number;
}
