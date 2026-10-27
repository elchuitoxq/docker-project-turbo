import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { FinancialReportsService } from './financial-reports.service';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

/**
 * Estados financieros (`T-04-05` … `T-04-07`). Vive bajo `/v1/reports` para separarlo de los
 * reportes fiscales (`/v1/reports/fiscal`), que tienen otro consumidor y otro formato.
 */
@ApiTags('reports')
@Controller('v1/reports')
export class FinancialReportsController {
  constructor(private readonly reports: FinancialReportsService) {}

  @Get('trial-balance')
  @RequirePermissions('finance:reports:view')
  @ApiOperation({
    summary: 'Balance de comprobación',
    description: 'Sumas y saldos por cuenta de los asientos posteados de la sucursal',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-10-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-10-31' })
  @ApiResponse({ status: 200, description: 'Balance de comprobación' })
  async trialBalance(
    @CurrentBranch() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.reports.trialBalance(branchId, from, to);
  }

  @Get('balance-sheet')
  @RequirePermissions('finance:reports:view')
  @ApiOperation({
    summary: 'Balance general al corte',
    description: 'Activo, pasivo, patrimonio y resultado acumulado hasta la fecha',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-10-31' })
  @ApiResponse({ status: 200, description: 'Balance general' })
  async balanceSheet(@CurrentBranch() branchId: string, @Query('date') date?: string) {
    return this.reports.balanceSheet(branchId, date);
  }

  @Get('income-statement')
  @RequirePermissions('finance:reports:view')
  @ApiOperation({
    summary: 'Estado de resultados',
    description: 'Ingresos, costos y gastos del rango; resultado = ingresos − costos − gastos',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-10-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-10-31' })
  @ApiResponse({ status: 200, description: 'Estado de resultados' })
  async incomeStatement(
    @CurrentBranch() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.reports.incomeStatement(branchId, from, to);
  }
}
