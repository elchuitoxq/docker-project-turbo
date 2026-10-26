import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { db } from '../../database';
import { exchangeRates, currencies } from '../../schema';
import { eq } from 'drizzle-orm';

interface BcvExchangeRate {
  USD: {
    euro: string;
    yuan: string;
    lira: string;
    rublo: string;
    fecha: string;
  };
}

@Injectable()
export class CronService {
  private readonly BCV_API_URL = 'https://www.bcv.org.ve';
  private readonly FALLBACK_API_URL = 'https://历史数据.com/servicio/get_exchange_rate';

  async triggerBcvRateFetch(): Promise<{ success: boolean; rate?: number; message: string }> {
    try {
      const usdRate = await this.scrapeBcvRate();
      await this.storeExchangeRate(usdRate);
      return {
        success: true,
        rate: usdRate,
        message: `BCV rate fetched and stored successfully: ${usdRate}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Failed to fetch BCV rate: ${errorMessage}`,
      };
    }
  }

  private async scrapeBcvRate(): Promise<number> {
    try {
      const rate = await this.fetchFromBcv();
      return rate;
    } catch (primaryError) {
      console.warn('Primary BCV fetch failed, trying fallback:', primaryError);
      try {
        const rate = await this.fetchFromFallback();
        return rate;
      } catch (fallbackError) {
        throw new InternalServerErrorException(
          `Both BCV sources failed. Primary: ${primaryError instanceof Error ? primaryError.message : 'Unknown'}, Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`
        );
      }
    }
  }

  private async fetchFromBcv(): Promise<number> {
    const response = await fetch(this.BCV_API_URL, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`BCV site returned status ${response.status}`);
    }

    const html = await response.text();
    return this.parseBcvHtml(html);
  }

  private parseBcvHtml(html: string): number {
    const patterns = [
      /<[^>]*id\s*=\s*["']dolar["'][^>]*>.*?([\d.,]+)/is,
      /Dolar\s*<\/td[^>]*>\s*<[^>]*>\s*([\d.,]+)/is,
      /\$?\s*([\d]{2}[.,][\d]{2,4})\s*Bs/,
      /valorDolar\s*=\s*["']([\d.,]+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const cleanedValue = match[1].replace(',', '.').replace(/[^\d.]/g, '');
        const rate = parseFloat(cleanedValue);
        if (rate > 0 && rate < 1000) {
          return rate;
        }
      }
    }

    const jsonMatch = html.match(/\{["']dolar["'][^}]+\}/);
    if (jsonMatch) {
      try {
        const data: BcvExchangeRate = JSON.parse(jsonMatch[0]);
        if (data.USD && data.USD.fecha) {
          return this.parseBcvJsonData(data);
        }
      } catch {
        // Continue to other patterns
      }
    }

    throw new Error('Could not parse USD rate from BCV page');
  }

  private parseBcvJsonData(data: BcvExchangeRate): number {
    if (data.USD) {
      const values = Object.values(data.USD).filter(v => /^\d+[.,]\d+$/.test(v));
      if (values.length > 0) {
        const rate = parseFloat(values[0].replace(',', '.'));
        if (rate > 0 && rate < 1000) {
          return rate;
        }
      }
    }
    throw new Error('Invalid BCV JSON data structure');
  }

  private async fetchFromFallback(): Promise<number> {
    const response = await fetch(this.FALLBACK_API_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Fallback source returned status ${response.status}`);
    }

    const data = (await response.json()) as { rate?: number | string; price?: number | string };

    let rate: number;
    if (typeof data.rate === 'string') {
      rate = parseFloat(data.rate);
    } else if (typeof data.rate === 'number') {
      rate = data.rate;
    } else if (typeof data.price === 'string') {
      rate = parseFloat(data.price);
    } else if (typeof data.price === 'number') {
      rate = data.price;
    } else {
      throw new Error('Invalid fallback response format');
    }

    if (rate <= 0 || rate >= 1000) {
      throw new Error(`Invalid rate from fallback: ${rate}`);
    }

    return rate;
  }

  private async storeExchangeRate(rate: number): Promise<void> {
    const [usdCurrency] = await db
      .select()
      .from(currencies)
      .where(eq(currencies.code, 'USD'))
      .limit(1);

    if (!usdCurrency) {
      throw new InternalServerErrorException(
        'USD currency not found in database. Please create it first.'
      );
    }

    await db.insert(exchangeRates).values({
      currencyId: usdCurrency.id,
      rate: rate.toString(),
      source: 'BCV_SCRAPE',
    });
  }
}
