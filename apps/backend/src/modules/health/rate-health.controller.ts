import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { and, eq } from 'drizzle-orm';
import { db } from '../../database';
import { currencies } from '../../schema';
import { Public } from '../../common/decorators/public.decorator';
import {
  ExchangeRateService,
  REFERENCE_CURRENCY_CODE,
} from '../settings/currencies/exchange-rate.service';

export interface RateHealthDto {
  /** Moneda funcional del sistema (VES): vale 1 contra sí misma. */
  baseCurrency: string;
  /** Moneda cuya tasa se informa (USD por defecto). */
  referenceCurrency: string | null;
  rate: number | null;
  date: string | null;
  source: string | null;
  ageHours: number | null;
  isStale: boolean;
}

/**
 * Estado de la tasa de la moneda de referencia contra la funcional (`S-08` §5).
 *
 * La moneda funcional **no tiene tasa** (vale 1 contra sí misma); lo que la UI necesita para
 * avisar "tasa vencida" es la del dólar. Reportar la fila de VES era el motivo del badge
 * "MANUAL · vencida · Bs 36.50" (`S-15` M-8).
 *
 * Vive aparte del health check porque este responde bajo el prefijo `v1` (el `/health` pelado lo
 * consume Docker) y porque se consulta antes de tener sucursal: `@SkipBranch` no aplica aquí al no
 * depender de contexto de sucursal.
 */
@ApiTags('health')
@Controller('v1/health')
export class RateHealthController {
  constructor(private readonly exchangeRates: ExchangeRateService) {}

  @Get('rates')
  @Public()
  @ApiOperation({
    summary: 'Estado y antigüedad de la tasa de la moneda de referencia',
    description:
      'Devuelve la tasa vigente del dólar contra la moneda funcional, su fuente (BCV o ajuste manual) y cuántas horas tiene. Público: la UI lo usa para avisar de una tasa vencida.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tasa vigente con su fuente y antigüedad',
    schema: {
      example: {
        baseCurrency: 'VES',
        referenceCurrency: 'USD',
        rate: 36.5,
        date: '2026-10-31T00:00:00.000Z',
        source: 'BCV',
        ageHours: 12,
        isStale: false,
      },
    },
  })
  async rates(): Promise<RateHealthDto> {
    const [base] = await db
      .select({ code: currencies.code })
      .from(currencies)
      .where(eq(currencies.isBase, true))
      .limit(1);

    const empty = {
      baseCurrency: base?.code ?? 'VES',
      referenceCurrency: null,
      rate: null,
      date: null,
      source: null,
      ageHours: null,
      isStale: true,
    };

    if (!base) return empty;

    const [reference] = await db
      .select({ code: currencies.code })
      .from(currencies)
      .where(and(eq(currencies.isBase, false), eq(currencies.code, REFERENCE_CURRENCY_CODE)))
      .limit(1);

    if (!reference) return empty;

    const latest = await this.exchangeRates.getLatestWithFreshness(reference.code);

    return {
      baseCurrency: base.code,
      referenceCurrency: reference.code,
      rate: latest?.rate ?? null,
      date: latest?.date ? new Date(latest.date).toISOString() : null,
      source: latest?.source ?? null,
      ageHours: latest?.ageHours ?? null,
      isStale: latest ? latest.isStale : true,
    };
  }
}
