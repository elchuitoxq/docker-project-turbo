import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsISO8601,
  IsInt,
  Matches,
  Min,
  Max,
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

/**
 * Naturaleza del concepto de nómina (`09-HR-NOMINA-VENEZUELA.md` §5).
 * `EMPLOYER_CONTRIBUTION` no toca el neto; `INFORMATIVE` sólo expone bases y alícuotas.
 */
export enum PayrollConceptCategory {
  ASSIGNMENT = 'ASSIGNMENT',
  DEDUCTION = 'DEDUCTION',
  EMPLOYER_CONTRIBUTION = 'EMPLOYER_CONTRIBUTION',
  INFORMATIVE = 'INFORMATIVE',
}

/** Cómo se obtiene el monto del concepto. `FORMULA` exige `expression`. */
export enum PayrollConceptKind {
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
  FORMULA = 'FORMULA',
  BASE = 'BASE',
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

  @ApiProperty({ example: 1500.0 })
  baseSalary: number;

  @ApiPropertyOptional({ description: 'Moneda en la que está pactado el sueldo' })
  salaryCurrencyId?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Código de la moneda del sueldo' })
  salaryCurrencyCode?: string;

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

  @ApiProperty({ example: 15000.0 })
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

  @ApiProperty({ example: 1500.0 })
  baseAmount: number;

  @ApiProperty({ example: 200.0 })
  bonuses: number;

  @ApiProperty({ example: 150.0 })
  deductions: number;

  @ApiProperty({ example: 1550.0 })
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

  @ApiProperty({ example: 1500.0 })
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

  @ApiProperty({ example: 200.0 })
  totalIncome: number;

  @ApiProperty({ example: 150.0 })
  totalDeductions: number;

  @ApiProperty({ example: 1550.0 })
  netSalary: number;
}

export class TerminateEmployeeDto {
  @ApiProperty({ description: 'Fecha de egreso (ISO)', example: '2026-10-31' })
  @IsString()
  date: string;

  @ApiPropertyOptional({ description: 'Motivo del egreso', example: 'Renuncia voluntaria' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Causa legal del egreso (LOTTT)',
    example: 'RENUNCIA',
  })
  @IsOptional()
  @IsString()
  cause?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'AdministraciÃ³n' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Departamento padre', nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class UpdatePositionDto {
  @ApiPropertyOptional({ example: 'Analista de nÃ³mina' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsNumber()
  baseSalaryMin?: number;

  @ApiPropertyOptional({ example: 450 })
  @IsOptional()
  @IsNumber()
  baseSalaryMax?: number;
}

export class UpdatePayrollSettingDto {
  @ApiProperty({ description: 'Clave del parámetro', example: 'SALARIO_MINIMO' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'La clave debe ser mayúsculas, números y guion bajo (ej. SALARIO_MINIMO)',
  })
  key: string;

  @ApiProperty({ description: 'Valor numérico', example: 130 })
  @IsNumber()
  value: number;

  @ApiPropertyOptional({
    description: 'Etiqueta legible; si se omite se conserva la existente o se usa la clave',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    description: 'Tipo del parámetro. PERCENT/PERCENTAGE se expresan como porcentaje entero',
    example: 'PERCENT',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Fecha de vigencia (ISO 8601). Por defecto, la fecha actual',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;
}

export class PayrollSettingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty({ example: 'SALARIO_MINIMO' })
  key: string;

  @ApiProperty({ example: 'Salario mínimo' })
  label: string;

  @ApiProperty({ example: 130 })
  value: number;

  @ApiProperty({ example: 'CURRENCY' })
  type: string;

  @ApiProperty({ nullable: true })
  branchId: string | null;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  effectiveFrom: string;

  @ApiProperty()
  isActive: boolean;
}

export class CreatePayrollConceptDto {
  @ApiProperty({ description: 'Código único del concepto', example: 'PRIMA_ANTIGUEDAD' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,29}$/, {
    message: 'El código debe empezar con letra y usar mayúsculas, números y guion bajo',
  })
  code: string;

  @ApiProperty({ description: 'Nombre visible en el recibo', example: 'Prima de antigüedad' })
  @IsString()
  name: string;

  @ApiProperty({ enum: PayrollConceptCategory })
  @IsEnum(PayrollConceptCategory)
  category: PayrollConceptCategory;

  @ApiPropertyOptional({ enum: PayrollConceptKind, default: PayrollConceptKind.FIXED })
  @IsOptional()
  @IsEnum(PayrollConceptKind)
  kind?: PayrollConceptKind;

  @ApiPropertyOptional({
    description: 'Fórmula declarativa. Obligatoria cuando kind = FORMULA',
    example: 'SALARY_NORMAL * 0.05',
  })
  @IsOptional()
  @IsString()
  expression?: string;

  @ApiPropertyOptional({
    description: 'Si el concepto entra en el salario integral (LOTTT Art. 105)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  affectsIntegralSalary?: boolean;

  @ApiPropertyOptional({
    description: 'Si el concepto es salarial. El cestaticket no lo es (Ley de Alimentación)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isSalarial?: boolean;

  @ApiPropertyOptional({
    description:
      'Si el importe del concepto reduce la base de ISLR antes de aplicar la tarifa (P-30). ' +
      'Sólo tiene efecto en conceptos de categoría DEDUCTION',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  reducesIncomeTaxBase?: boolean;
}

export class UpdatePayrollConceptDto {
  @ApiPropertyOptional({ example: 'Prima de antigüedad' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: PayrollConceptCategory })
  @IsOptional()
  @IsEnum(PayrollConceptCategory)
  category?: PayrollConceptCategory;

  @ApiPropertyOptional({ enum: PayrollConceptKind })
  @IsOptional()
  @IsEnum(PayrollConceptKind)
  kind?: PayrollConceptKind;

  @ApiPropertyOptional({ example: 'SALARY_NORMAL * 0.05' })
  @IsOptional()
  @IsString()
  expression?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  affectsIntegralSalary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSalarial?: boolean;

  @ApiPropertyOptional({ description: 'Si su importe resta de la base de ISLR (P-30)' })
  @IsOptional()
  @IsBoolean()
  reducesIncomeTaxBase?: boolean;
}

export class PayrollConceptResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'PRIMA_ANTIGUEDAD' })
  code: string;

  @ApiProperty({ example: 'Prima de antigüedad' })
  name: string;

  @ApiProperty({ enum: PayrollConceptCategory })
  category: string;

  @ApiProperty({ enum: PayrollConceptKind })
  kind: string;

  @ApiProperty({ nullable: true, example: 'SALARY_NORMAL * 0.05' })
  expression: string | null;

  @ApiProperty()
  affectsIntegralSalary: boolean;

  @ApiProperty()
  isSalarial: boolean;

  @ApiProperty({ description: 'Si su importe resta de la base de ISLR (P-30)' })
  reducesIncomeTaxBase: boolean;

  @ApiProperty()
  isSystem: boolean;

  @ApiProperty({ nullable: true })
  branchId: string | null;
}

export class VacationSummaryDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty({ description: 'Años de servicio cumplidos', example: 3 })
  years: number;

  @ApiProperty({ description: 'Días de vacaciones que corresponden', example: 17 })
  vacationDays: number;

  @ApiProperty({ description: 'Días de bono vacacional que corresponden', example: 9 })
  bonusDays: number;

  @ApiProperty({ example: 0 })
  daysTaken: number;

  @ApiProperty({ example: 17 })
  daysPending: number;

  @ApiProperty({ description: 'Salario normal diario', example: 333.33 })
  normalDaily: number;
}

export class BenefitsSummaryDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty({ example: 5 })
  years: number;

  @ApiProperty({ description: 'Salario integral diario', example: 367.59 })
  integralDaily: number;

  @ApiProperty({ description: 'Trimestres depositados', example: 20 })
  quartersDeposited: number;

  @ApiProperty({ example: 113218.52 })
  guaranteeAccumulated: number;

  @ApiProperty({ example: 55138.89 })
  retroactive: number;

  @ApiProperty({ description: 'Monto que se paga: la modalidad mayor (RN-11)', example: 113218.52 })
  payable: number;

  @ApiProperty({ enum: ['GUARANTEE', 'RETROACTIVE'] })
  modality: 'GUARANTEE' | 'RETROACTIVE';
}

export class RegisterVacationDto {
  @ApiProperty({ description: 'Año del período vacacional', example: 2026 })
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ description: 'Días de vacaciones a tomar', example: 15 })
  @IsInt()
  @Min(1)
  days: number;

  @ApiPropertyOptional({ example: '2026-11-02' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class DepositBenefitDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ description: 'Trimestre 1-4', example: 4 })
  @IsInt()
  @Min(1)
  @Max(4)
  quarter: number;

  @ApiPropertyOptional({
    description: 'Si en el trimestre se cumple el aniversario, se suman los días adicionales',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isAnniversaryQuarter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayPayrollRunDto {
  @ApiProperty({ description: 'Método de pago usado para pagar la nómina' })
  @IsUUID()
  methodId: string;

  @ApiPropertyOptional({ description: 'Cuenta bancaria de la que sale el dinero' })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional({
    description: 'Tasa manual a la moneda funcional. Sin ella se usa la tasa del período',
    example: 36.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0000001)
  exchangeRate?: number;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ example: 'Nómina octubre 2026' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class PayrollPaymentResponseDto {
  @ApiProperty()
  payrollRunId: string;

  @ApiProperty({ example: 'NOM-000001' })
  runCode: string;

  @ApiProperty({ example: 'PAID' })
  runStatus: string;

  @ApiProperty({ description: 'true si el run ya estaba pagado y se devuelve el pago existente' })
  alreadyPaid: boolean;

  @ApiProperty()
  paymentId: string;

  @ApiProperty({ example: 'PAY-00001' })
  paymentCode: string;

  @ApiProperty({ description: 'Monto en la moneda del run', example: 10910 })
  amount: number;

  @ApiProperty({ description: 'Monto en moneda funcional', example: 10910 })
  amountBase: number;

  @ApiProperty()
  currencyId: string;

  @ApiProperty({ example: 1 })
  exchangeRate: number;

  @ApiProperty({ example: '2026-11-01T00:00:00.000Z' })
  date: string;
}

export class SettleEmployeeDto {
  @ApiProperty({ description: 'Fecha de egreso (ISO)', example: '2026-10-31' })
  @IsISO8601()
  terminationDate: string;

  @ApiProperty({
    description: 'Causa legal del egreso. Sólo el despido injustificado indemniza (Art. 92)',
    enum: [
      'RENUNCIA',
      'DESPIDO_JUSTIFICADO',
      'DESPIDO_INJUSTIFICADO',
      'MUTUO_ACUERDO',
      'JUBILACION',
      'MUERTE',
      'INCAPACIDAD',
    ],
    example: 'RENUNCIA',
  })
  @IsString()
  cause: string;

  @ApiPropertyOptional({ description: 'Observaciones de la liquidación' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SettlementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty({ example: '2026-10-31T00:00:00.000Z' })
  terminationDate: string;

  @ApiProperty({ example: 'RENUNCIA' })
  cause: string;

  @ApiProperty({ example: 3 })
  years: number;

  @ApiProperty({ description: 'Salario integral diario', example: 367.59 })
  integralSalary: number;

  @ApiProperty({ description: 'Salario normal diario', example: 333.33 })
  normalSalary: number;

  @ApiProperty({ example: 5513.89 })
  guaranteeAccumulated: number;

  @ApiProperty({ example: 33083.33 })
  retroactive: number;

  @ApiProperty({ description: 'Prestaciones que se pagan: la modalidad mayor', example: 33083.33 })
  benefitsAmount: number;

  @ApiProperty({ enum: ['GUARANTEE', 'RETROACTIVE'] })
  benefitsModality: string;

  @ApiProperty({ example: 2 })
  vacationDays: number;

  @ApiProperty({ example: 666.67 })
  vacationAmount: number;

  @ApiProperty({ example: 9 })
  bonusDays: number;

  @ApiProperty({ example: 3000 })
  bonusAmount: number;

  @ApiProperty({ example: 10 })
  profitDays: number;

  @ApiProperty({ example: 3333.33 })
  profitAmount: number;

  @ApiProperty({ example: 0 })
  indemnificationDays: number;

  @ApiProperty({ example: 0 })
  indemnificationAmount: number;

  @ApiProperty({ example: 40083.33 })
  totalAmount: number;

  @ApiProperty({ example: 'CALCULATED' })
  status: string;
}

export class RegisterProfitSharingDto {
  @ApiProperty({ description: 'Ejercicio fiscal', example: 2025 })
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ description: 'Meses completos trabajados en el ejercicio', example: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  monthsWorked: number;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @IsISO8601()
  paymentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
