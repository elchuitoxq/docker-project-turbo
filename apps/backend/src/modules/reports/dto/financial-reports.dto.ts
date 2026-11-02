import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrialBalanceRowDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  accountId: string;

  @ApiProperty({ example: '1.1.01' })
  code: string;

  @ApiProperty({ example: 'Caja' })
  name: string;

  @ApiProperty({ example: 'ASSET' })
  type: string;

  @ApiProperty({ example: 15000.5 })
  debit: number;

  @ApiProperty({ example: 2000 })
  credit: number;

  @ApiProperty({ example: 13000.5 })
  balance: number;
}

export class TrialBalanceTotalsDto {
  @ApiProperty({ example: 15000.5 })
  debit: number;

  @ApiProperty({ example: 15000.5 })
  credit: number;

  @ApiProperty({ example: 0 })
  difference: number;
}

export class TrialBalanceReportDto {
  @ApiPropertyOptional({ example: '2026-10-01', nullable: true })
  from: string | null;

  @ApiPropertyOptional({ example: '2026-10-31', nullable: true })
  to: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  branchId: string | null;

  @ApiProperty({ type: [TrialBalanceRowDto] })
  rows: TrialBalanceRowDto[];

  @ApiProperty({ type: TrialBalanceTotalsDto })
  totals: TrialBalanceTotalsDto;

  @ApiProperty({ example: true })
  balanced: boolean;
}

export class StatementLineDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  accountId: string;

  @ApiProperty({ example: '1.1.01' })
  code: string;

  @ApiProperty({ example: 'Caja' })
  name: string;

  @ApiProperty({ example: 13000.5 })
  balance: number;
}

export class BalanceSheetTotalsDto {
  @ApiProperty({ example: 50000 })
  assets: number;

  @ApiProperty({ example: 20000 })
  liabilities: number;

  @ApiProperty({ example: 25000 })
  equity: number;

  @ApiProperty({ example: 5000 })
  result: number;

  @ApiProperty({ example: 50000 })
  liabilitiesAndEquity: number;

  @ApiProperty({ example: 0 })
  difference: number;
}

export class BalanceSheetReportDto {
  @ApiProperty({ example: '2026-10-31' })
  date: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  branchId: string | null;

  @ApiProperty({ type: [StatementLineDto] })
  assets: StatementLineDto[];

  @ApiProperty({ type: [StatementLineDto] })
  liabilities: StatementLineDto[];

  @ApiProperty({ type: [StatementLineDto] })
  equity: StatementLineDto[];

  @ApiProperty({ type: BalanceSheetTotalsDto })
  totals: BalanceSheetTotalsDto;

  @ApiProperty({ example: true })
  balanced: boolean;
}

export class IncomeStatementTotalsDto {
  @ApiProperty({ example: 80000 })
  revenue: number;

  @ApiProperty({ example: 30000 })
  costs: number;

  @ApiProperty({ example: 50000 })
  grossProfit: number;

  @ApiProperty({ example: 20000 })
  expenses: number;

  @ApiProperty({ example: 30000 })
  result: number;
}

export class IncomeStatementReportDto {
  @ApiPropertyOptional({ example: '2026-10-01', nullable: true })
  from: string | null;

  @ApiPropertyOptional({ example: '2026-10-31', nullable: true })
  to: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  branchId: string | null;

  @ApiProperty({ type: [StatementLineDto] })
  revenue: StatementLineDto[];

  @ApiProperty({ type: [StatementLineDto] })
  costs: StatementLineDto[];

  @ApiProperty({ type: [StatementLineDto] })
  expenses: StatementLineDto[];

  @ApiProperty({ type: IncomeStatementTotalsDto })
  totals: IncomeStatementTotalsDto;
}
