import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '../../../database';
import { currencies, exchangeRates } from '../../../schema';
import { eq, desc } from 'drizzle-orm';
import {
  CreateCurrencyDto,
  CurrencyResponseDto,
  CreateExchangeRateDto,
  ExchangeRateResponseDto,
  LatestRatesResponseDto,
} from './dto/currencies.dto';
import { ExchangeRateService } from './exchange-rate.service';

@Injectable()
export class CurrenciesService {
  constructor(private readonly exchangeRates: ExchangeRateService) {}

  async findAll(): Promise<CurrencyResponseDto[]> {
    const allCurrencies = await db.select().from(currencies);
    return allCurrencies.map(this.toResponseDto);
  }

  async findOne(id: string): Promise<CurrencyResponseDto> {
    const [currency] = await db.select().from(currencies).where(eq(currencies.id, id)).limit(1);

    if (!currency) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }

    return this.toResponseDto(currency);
  }

  async create(createCurrencyDto: CreateCurrencyDto): Promise<CurrencyResponseDto> {
    const [existing] = await db
      .select()
      .from(currencies)
      .where(eq(currencies.code, createCurrencyDto.code))
      .limit(1);

    if (existing) {
      throw new ConflictException('Currency with this code already exists');
    }

    const [newCurrency] = await db
      .insert(currencies)
      .values({
        code: createCurrencyDto.code,
        name: createCurrencyDto.name,
        symbol: createCurrencyDto.symbol,
        isBase: createCurrencyDto.isBase || false,
      })
      .returning();

    return this.toResponseDto(newCurrency);
  }

  async getLatestRates(): Promise<LatestRatesResponseDto[]> {
    const latestRates = await db
      .select({
        id: exchangeRates.id,
        currencyId: exchangeRates.currencyId,
        rate: exchangeRates.rate,
        date: exchangeRates.date,
        source: exchangeRates.source,
        currencyCode: currencies.code,
        currencyName: currencies.name,
        currencySymbol: currencies.symbol,
      })
      .from(exchangeRates)
      .innerJoin(currencies, eq(exchangeRates.currencyId, currencies.id))
      .orderBy(desc(exchangeRates.date));

    const latestByCurrency = new Map<string, LatestRatesResponseDto>();

    for (const rate of latestRates) {
      if (!latestByCurrency.has(rate.currencyId)) {
        latestByCurrency.set(rate.currencyId, {
          id: rate.id,
          currencyId: rate.currencyId,
          rate: Number(rate.rate),
          date: rate.date,
          source: rate.source || 'MANUAL',
          currencyCode: rate.currencyCode,
          currencyName: rate.currencyName,
          currencySymbol: rate.currencySymbol,
        });
      }
    }

    return Array.from(latestByCurrency.values());
  }

  /**
   * Override manual de la tasa del dia (regla M9 de `S-08`).
   * Acepta `currencyCode` (preferido) o `currencyId`, exige motivo y delega el
   * almacenamiento en `ExchangeRateService` para no duplicar la logica de tasas.
   */
  async addRate(
    createRateDto: CreateExchangeRateDto,
    userId?: string
  ): Promise<ExchangeRateResponseDto> {
    const currencyCode = await this.resolveCurrencyCode(createRateDto);

    const stored = await this.exchangeRates.store({
      currencyCode,
      rate: createRateDto.rate,
      source: 'MANUAL',
      date: createRateDto.date ? new Date(createRateDto.date) : undefined,
      createdBy: userId ?? null,
      reason: createRateDto.reason ?? null,
    });

    return {
      id: stored.id,
      currencyId: stored.currencyId,
      rate: stored.rate,
      date: stored.date,
      source: stored.source,
    };
  }

  private async resolveCurrencyCode(createRateDto: CreateExchangeRateDto): Promise<string> {
    if (createRateDto.currencyCode) return createRateDto.currencyCode;
    if (!createRateDto.currencyId) {
      throw new BadRequestException('currencyCode or currencyId is required');
    }

    const [currency] = await db
      .select({ code: currencies.code })
      .from(currencies)
      .where(eq(currencies.id, createRateDto.currencyId))
      .limit(1);

    if (!currency) {
      throw new NotFoundException(`Currency with ID ${createRateDto.currencyId} not found`);
    }

    return currency.code;
  }

  private toResponseDto(currency: typeof currencies.$inferSelect): CurrencyResponseDto {
    return {
      id: currency.id,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      isBase: currency.isBase || false,
    };
  }
}
