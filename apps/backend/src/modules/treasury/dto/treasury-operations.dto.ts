import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** `T-05-01`: los métodos de pago se administran desde ajustes, no se siembran a mano. */
export class UpdatePaymentMethodDto {
  @ApiPropertyOptional({ example: 'Efectivo USD' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Cobra IGTF (3 %) al pagarse en divisa' })
  @IsOptional()
  @IsBoolean()
  appliesIgtf?: boolean;

  @ApiPropertyOptional({ description: 'Exige número de referencia' })
  @IsOptional()
  @IsBoolean()
  requiresReference?: boolean;

  @ApiPropertyOptional({ description: 'Es efectivo' })
  @IsOptional()
  @IsBoolean()
  isCash?: boolean;

  @ApiPropertyOptional({ description: 'Un método desactivado no aparece al cobrar' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Moneda del método' })
  @IsOptional()
  @IsUUID()
  currencyId?: string;
}

/** `T-05-02`: alta y edición de cuentas bancarias por sucursal. */
export class UpdateBankAccountDto {
  @ApiPropertyOptional({ example: 'Banesco Principal' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '0134-0000-00-0000000000' })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'CHECKING' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Banco (catálogo `banks`)' })
  @IsOptional()
  @IsUUID()
  bankId?: string;

  @ApiPropertyOptional({ example: 0, description: 'Saldo inicial de apertura' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Cuenta operativa' })
  @IsOptional()
  @IsString()
  notes?: string;
}

/** `T-05-03`: snapshot del cierre diario por sucursal y fecha. */
export class DailyCloseDetailDto {
  @ApiProperty({ example: '2026-10-27' })
  date: string;

  @ApiProperty({ enum: ['OPEN', 'CLOSED'], example: 'OPEN' })
  status: 'OPEN' | 'CLOSED';

  @ApiProperty({ example: 1500 })
  totalIncome: number;

  @ApiProperty({ example: 500 })
  totalExpense: number;

  @ApiProperty({ example: 1000 })
  netBalance: number;

  @ApiPropertyOptional({ example: 1500, description: 'Efectivo contado declarado al cerrar' })
  cashCount?: number | null;

  @ApiPropertyOptional({ example: 0, description: 'Efectivo con el que abrió la caja' })
  openingCash?: number | null;

  @ApiPropertyOptional({
    example: 1500,
    description: 'Efectivo esperado = apertura + neto de efectivo del día',
  })
  expectedCash?: number | null;

  @ApiPropertyOptional({ example: 0, description: 'cashCount − expectedCash' })
  difference?: number | null;

  @ApiProperty({ type: [Object] })
  byPaymentMethod: { methodName: string; income: number; expense: number }[];

  @ApiProperty({ type: [Object] })
  byCurrency: { currencyCode: string; income: number; expense: number }[];

  @ApiProperty({ example: 3, description: 'Pagos considerados en el snapshot' })
  paymentsCount: number;

  @ApiPropertyOptional({ example: '2026-10-27T20:10:00.000Z' })
  closedAt?: Date | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  closedBy?: string | null;

  @ApiPropertyOptional({ example: '2026-10-27T21:00:00.000Z' })
  reopenedAt?: Date | null;

  @ApiPropertyOptional({ example: 'Faltó un pago' })
  reopenReason?: string | null;

  @ApiPropertyOptional({ example: 'Cierre con diferencia de caja' })
  notes?: string | null;
}

export class CloseDailyCloseDto {
  @ApiPropertyOptional({ example: 'Cierre con diferencia de caja' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 1450, description: 'Efectivo contado (opcional)' })
  @IsOptional()
  @IsNumber()
  cashCount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Efectivo con el que abrió la caja' })
  @IsOptional()
  @IsNumber()
  openingCash?: number;
}

export class ReopenDailyCloseDto {
  @ApiProperty({ example: 'Se registró un pago después del cierre' })
  @IsString()
  reason: string;
}

/** `T-05-04`: importación de extracto en CSV. */
export class ImportStatementDto {
  @ApiProperty({ description: 'Cuenta bancaria del extracto' })
  @IsUUID()
  bankAccountId: string;

  @ApiPropertyOptional({ example: 'extracto-octubre.csv' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({
    description: 'Contenido CSV: fecha,monto,referencia,descripción (monto negativo = egreso)',
    example: '2026-10-24,500.00,TRF-001,Pago cliente\n2026-10-24,-120.00,CHQ-9,Proveedor',
  })
  @IsString()
  content: string;
}

export class MatchStatementLineDto {
  @ApiProperty({ description: 'Pago o cobro con el que se concilia la línea' })
  @IsUUID()
  paymentId: string;
}

export class StatementLineDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '2026-10-24' })
  date: string;

  @ApiProperty({ example: 500 })
  amount: number;

  @ApiProperty({ enum: ['IN', 'OUT'] })
  direction: 'IN' | 'OUT';

  @ApiPropertyOptional()
  reference?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional()
  matchedPaymentId?: string | null;

  @ApiProperty({ example: false })
  matched: boolean;

  @ApiPropertyOptional({ type: [Object], description: 'Pagos candidatos por monto y fecha' })
  suggestions?: { paymentId: string; code: string; amount: number; date: string }[];
}

export class ReconciliationReportDto {
  @ApiProperty()
  bankAccountId: string;

  @ApiProperty({ example: 3 })
  totalLines: number;

  @ApiProperty({ example: 2 })
  matchedLines: number;

  @ApiProperty({ type: [StatementLineDto] })
  lines: StatementLineDto[];

  @ApiProperty({ type: [Object], description: 'Pagos del período sin línea conciliada' })
  unmatchedPayments: { paymentId: string; code: string; amount: number; date: string }[];
}

/** `T-05-07`: caja chica. */
export class CreatePettyCashFundDto {
  @ApiProperty({ example: 'Caja chica administración' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Moneda del fondo' })
  @IsUUID()
  currencyId: string;

  @ApiProperty({ example: 200, description: 'Monto del fondo fijo' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Responsable del fondo' })
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;
}

export class CreatePettyCashMovementDto {
  @ApiProperty({ example: '2026-10-27' })
  @IsString()
  date: string;

  @ApiProperty({ enum: ['EXPENSE', 'REPLENISHMENT'], example: 'EXPENSE' })
  @IsEnum(['EXPENSE', 'REPLENISHMENT'])
  type: 'EXPENSE' | 'REPLENISHMENT';

  @ApiProperty({ example: 25.5 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Taxi a banco' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'REC-0001' })
  @IsOptional()
  @IsString()
  receiptNumber?: string;
}

export class PettyCashFundResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Caja chica administración' })
  name: string;

  @ApiProperty()
  currencyId: string;

  @ApiProperty({ example: 200 })
  amount: number;

  @ApiProperty({ example: 150 })
  balance: number;

  @ApiProperty({ enum: ['OPEN', 'CLOSED'] })
  status: 'OPEN' | 'CLOSED';

  @ApiPropertyOptional()
  responsibleUserId?: string | null;

  @ApiProperty({ type: [Object] })
  movements: {
    id: string;
    date: string;
    type: 'EXPENSE' | 'REPLENISHMENT';
    amount: number;
    description?: string | null;
    receiptNumber?: string | null;
  }[];

  @ApiProperty({ example: 50, description: 'Gastado desde la última reposición' })
  spentSinceReplenishment: number;

  @ApiPropertyOptional({ example: 2, description: 'Veces que se repuso el fondo' })
  replenishments?: number;
}

export class ClosePettyCashFundDto {
  @ApiPropertyOptional({ example: 0, description: 'Saldo devuelto al cerrar el fondo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  returnedAmount?: number;

  @ApiPropertyOptional({ example: 'Se cierra al cambiar de responsable' })
  @IsOptional()
  @IsString()
  notes?: string;
}

/** Filtro de rango compartido por estado de cuenta y conciliación. */
export class DateRangeDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Días del extracto a considerar', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;
}
