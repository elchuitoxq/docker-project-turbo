import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import {
  CreateCurrencyDto,
  CurrencyResponseDto,
  CreateExchangeRateDto,
  ExchangeRateResponseDto,
  LatestRatesResponseDto,
} from './dto/currencies.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SkipBranch } from '../../../common/decorators/skip-branch.decorator';

@ApiTags('settings-currencies')
@Controller('v1/settings/currencies')
// Monedas y tasas son maestros compartidos: se consultan antes de elegir sucursal (regla R5).
@SkipBranch()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all currencies',
    description: 'Retrieves a list of all currencies',
  })
  @ApiResponse({
    status: 200,
    description: 'List of currencies',
    type: [CurrencyResponseDto],
  })
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
  @ApiResponse({
    status: 409,
    description: 'Currency with this code already exists',
  })
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

  @Post('rates')
  @ApiOperation({
    summary: 'Add a new exchange rate',
    description: 'Adds a new exchange rate for a currency',
  })
  @ApiResponse({
    status: 201,
    description: 'Exchange rate added successfully',
    type: ExchangeRateResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Currency not found',
  })
  async addRate(@Body() createRateDto: CreateExchangeRateDto): Promise<ExchangeRateResponseDto> {
    return this.currenciesService.addRate(createRateDto.currencyId, createRateDto);
  }
}
