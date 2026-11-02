import { ApiProperty } from '@nestjs/swagger';

class CountAndSumDto {
  @ApiProperty({ example: 42 })
  count: number;

  @ApiProperty({ example: 12500.75 })
  sum: number;
}

class CountDto {
  @ApiProperty({ example: 12 })
  count: number;
}

export class KpiResultDto {
  @ApiProperty({ type: CountAndSumDto })
  totalInvoicesPosted: CountAndSumDto;

  @ApiProperty({ type: CountAndSumDto })
  totalPaymentsPosted: CountAndSumDto;

  @ApiProperty({ type: CountDto })
  totalEmployees: CountDto;

  @ApiProperty({ type: CountDto })
  pendingPayrollRuns: CountDto;

  @ApiProperty({ type: CountAndSumDto })
  totalCreditNotes: CountAndSumDto;
}

export class MonthlyDataDto {
  @ApiProperty({ example: 1, description: 'Mes (1-12)' })
  month: number;

  @ApiProperty({ example: 'Enero' })
  monthName: string;

  @ApiProperty({ example: 4500.5 })
  total: number;

  @ApiProperty({ example: 7 })
  count: number;
}

export class ChartResultDto {
  @ApiProperty({ type: [MonthlyDataDto] })
  monthlySales: MonthlyDataDto[];

  @ApiProperty({ type: [MonthlyDataDto] })
  monthlyPayments: MonthlyDataDto[];
}

class RecentDocumentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'FAC-000123' })
  code: string;

  @ApiProperty({ example: 'Distribuidora Caracas C.A.', nullable: true })
  partnerName: string | null;

  @ApiProperty({ example: 1200.4 })
  total: number;

  @ApiProperty({ example: 'POSTED', nullable: true })
  status: string | undefined;

  @ApiProperty({ example: '2026-10-31T14:30:00.000Z', nullable: true })
  date: Date | null;
}

class RecentPaymentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'PAG-000456' })
  code: string;

  @ApiProperty({ example: 'Distribuidora Caracas C.A.', nullable: true })
  partnerName: string | null;

  @ApiProperty({ example: 980.15 })
  amount: number;

  @ApiProperty({ example: 'POSTED', nullable: true })
  status: string | undefined;

  @ApiProperty({ example: '2026-10-31T14:30:00.000Z', nullable: true })
  date: Date | null;
}

export class ActivityResultDto {
  @ApiProperty({ type: [RecentDocumentDto] })
  recentInvoices: RecentDocumentDto[];

  @ApiProperty({ type: [RecentPaymentDto] })
  recentPayments: RecentPaymentDto[];

  @ApiProperty({ type: [RecentDocumentDto] })
  recentOrders: RecentDocumentDto[];
}
