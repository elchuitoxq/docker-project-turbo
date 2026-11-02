import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BiService, KpiResult, ChartResult, ActivityResult, MonthlyData } from './bi.service';
import { ActivityResultDto, KpiResultDto, MonthlyDataDto } from './dto/bi.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('bi')
@ApiBearerAuth()
@Controller('v1/bi')
@RequirePermissions('dashboard:view')
export class BiController {
  constructor(private readonly biService: BiService) {}

  @Get('kpis')
  @ApiOperation({
    summary: 'Get dashboard KPIs',
    description:
      'Retrieves key performance indicators including total invoices, payments, employees, and pending payroll runs',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard KPIs',
    type: KpiResultDto,
  })
  async getKpis(@CurrentBranch() branchId: string): Promise<KpiResult> {
    return this.biService.getKpis(branchId);
  }

  @Get('chart')
  @ApiOperation({
    summary: 'Get chart data',
    description: 'Retrieves monthly sales or payments data for charting purposes',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['sales', 'payments'],
    description: 'Type of chart data: sales or payments',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Year for the chart data (defaults to current year)',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly chart data',
    type: [MonthlyDataDto],
  })
  async getChartData(
    @CurrentBranch() branchId: string,
    @Query('type') type: 'sales' | 'payments',
    @Query('year') year?: string
  ): Promise<MonthlyData[]> {
    const selectedYear = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.biService.getChartData(type, selectedYear, branchId);
  }

  @Get('activity')
  @ApiOperation({
    summary: 'Get recent activity',
    description: 'Retrieves the most recent invoices, payments, and orders',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent activity data',
    type: ActivityResultDto,
  })
  async getActivity(@CurrentBranch() branchId: string): Promise<ActivityResult> {
    return this.biService.getActivity(branchId);
  }
}
