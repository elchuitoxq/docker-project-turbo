import {
  Injectable,
  NotFoundException,
  ConflictException,
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

@Injectable()
export class CurrenciesService {
  async findAll(): Promise<CurrencyResponseDto[]> {
    const allCurrencies = await db.select().from(currencies);
    return allCurrencies.map(this.toResponseDto);
  }

  async findOne(id: string): Promise<CurrencyResponseDto> {
    const [currency] = await db
      .select()
      .from(currencies)
      .where(eq(currencies.id, id))
      .limit(1);

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

  async addRate(
    currencyId: string,
    createRateDto: CreateExchangeRateDto,
  ): Promise<ExchangeRateResponseDto> {
    const [currency] = await db
      .select()
      .from(currencies)
      .where(eq(currencies.id, currencyId))
      .limit(1);

    if (!currency) {
      throw new NotFoundException(`Currency with ID ${currencyId} not found`);
    }

    const [newRate] = await db
      .insert(exchangeRates)
      .values({
        currencyId: currencyId,
        rate: createRateDto.rate.toString(),
        source: createRateDto.source || 'MANUAL',
      })
      .returning();

    return {
      id: newRate.id,
      currencyId: newRate.currencyId,
      rate: Number(newRate.rate),
      date: newRate.date,
      source: newRate.source || 'MANUAL',
    };
  }

  private toResponseDto(
    currency: typeof currencies.$inferSelect,
  ): CurrencyResponseDto {
    return {
      id: currency.id,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      isBase: currency.isBase || false,
    };
  }
}
