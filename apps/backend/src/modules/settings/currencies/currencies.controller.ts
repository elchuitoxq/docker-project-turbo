import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import { ExchangeRateService } from './exchange-rate.service';
import {
  CreateCurrencyDto,
  CreateExchangeRateDto,
  CurrencyResponseDto,
  ExchangeRateResponseDto,
  LatestRatesResponseDto,
  RateHistoryDto,
  RateWithFreshnessDto,
} from './dto/currencies.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SkipBranch } from '../../../common/decorators/skip-branch.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('settings-currencies')
@Controller('v1/settings/currencies')
// Monedas y tasas son maestros compartidos: se consultan antes de elegir sucursal (regla R5).
@SkipBranch()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CurrenciesController {
  constructor(
    private readonly currenciesService: CurrenciesService,
    private readonly exchangeRates: ExchangeRateService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all currencies',
    description: 'Retrieves a list of all currencies',
  })
  @ApiResponse({ status: 200, description: 'List of currencies', type: [CurrencyResponseDto] })
  async findAll(): Promise<CurrencyResponseDto[]> {
    return this.currenciesService.findAll();
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new currency',
    description: 'Creates a new currency with the provided data',
  })
  @ApiResponse({
    status: 201,
    description: 'Currency created successfully',
    type: CurrencyResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Currency with this code already exists' })
  async create(@Body() createCurrencyDto: CreateCurrencyDto): Promise<CurrencyResponseDto> {
    return this.currenciesService.create(createCurrencyDto);
  }

  @Get('rates/latest')
  @ApiOperation({
    summary: 'Get latest exchange rates',
    description: 'Retrieves the most recent exchange rate for each currency',
  })
  @ApiResponse({
    status: 200,
    description: 'Latest exchange rates',
    type: [LatestRatesResponseDto],
  })
  async getLatestRates(): Promise<LatestRatesResponseDto[]> {
    return this.currenciesService.getLatestRates();
  }

  @Get('rates/:code')
  @ApiOperation({
    summary: 'Get the rate of a currency',
    description:
      'Returns the most recent rate up to the given date (or today) together with its age and staleness flag',
  })
  @ApiParam({ name: 'code', example: 'USD' })
  @ApiQuery({ name: 'date', required: false, description: 'ISO date to look up' })
  @ApiResponse({ status: 200, description: 'Rate with freshness', type: RateWithFreshnessDto })
  @ApiResponse({ status: 404, description: 'Currency or rate not found' })
  async getRate(
    @Param('code') code: string,
    @Query('date') date?: string
  ): Promise<RateWithFreshnessDto> {
    return this.exchangeRates.getRateAt(code, date ? new Date(date) : new Date()) as never;
  }

  @Get('rates/:code/history')
  @ApiOperation({ summary: 'Get the rate history of a currency' })
  @ApiParam({ name: 'code', example: 'USD' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiResponse({ status: 200, description: 'Rate history', type: [RateHistoryDto] })
  async getHistory(
    @Param('code') code: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string
  ): Promise<RateHistoryDto[]> {
    const rows = await this.exchangeRates.history(
      code,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      limit ? Number(limit) : 50
    );

    return rows as never;
  }

  @Post('rates')
  @RequirePermissions('settings:currencies:manage')
  @ApiOperation({
    summary: 'Register a manual exchange rate',
    description:
      'Override of the day rate. Requires a reason and leaves the previous days untouched (M9)',
  })
  @ApiResponse({ status: 201, description: 'Rate stored', type: ExchangeRateResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid rate or missing reason' })
  async addRate(
    @Body() createRateDto: CreateExchangeRateDto,
    @CurrentUser('id') userId?: string
  ): Promise<ExchangeRateResponseDto> {
    return this.currenciesService.addRate(createRateDto, userId) as never;
  }

  @Post('refresh')
  @RequirePermissions('settings:currencies:manage')
  @ApiOperation({
    summary: 'Synchronise the USD rate from BCV',
    description: 'Replaces the retired GET /v1/cron/trigger-bcv with an authenticated POST',
  })
  @ApiResponse({ status: 201, description: 'Rate synchronised' })
  @ApiResponse({ status: 400, description: 'BCV unavailable or rate failed the sanity check' })
  async refresh(): Promise<RateWithFreshnessDto> {
    return this.exchangeRates.syncFromBcv() as never;
  }
}
