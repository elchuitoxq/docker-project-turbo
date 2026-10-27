import { IsString, IsBoolean, IsOptional, IsUUID, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCurrencyDto {
  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Currency name',
    example: 'US Dollar',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Currency symbol',
    example: '$',
  })
  @IsString()
  symbol: string;

  @ApiPropertyOptional({
    description: 'Is this the base currency',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isBase?: boolean;
}

export class CurrencyResponseDto {
  @ApiProperty({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  code: string;

  @ApiProperty({
    description: 'Currency name',
    example: 'US Dollar',
  })
  name: string;

  @ApiProperty({
    description: 'Currency symbol',
    example: '$',
  })
  symbol: string;

  @ApiProperty({
    description: 'Is base currency',
    example: false,
  })
  isBase: boolean;
}

export class CreateExchangeRateDto {
  @ApiPropertyOptional({
    description: 'Currency ID (alternativa a currencyCode)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional({
    description: 'Currency code (preferido sobre currencyId)',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({
    description: 'Motivo del override manual (obligatorio si source=MANUAL)',
    example: 'BCV no publicó tasa por feriado bancario',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Fecha de vigencia (ISO). Por defecto, hoy',
    example: '2026-10-26',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({
    description: 'Exchange rate value',
    example: 1.2345,
  })
  @IsNumber()
  rate: number;

  @ApiPropertyOptional({
    description: 'Rate source',
    example: 'MANUAL',
  })
  @IsOptional()
  @IsString()
  source?: string;
}

export class ExchangeRateResponseDto {
  @ApiProperty({
    description: 'Exchange rate ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  currencyId: string;

  @ApiProperty({
    description: 'Exchange rate value',
    example: 1.2345,
  })
  rate: number;

  @ApiProperty({
    description: 'Rate date',
    example: '2026-06-01T12:00:00.000Z',
  })
  date: Date | null;

  @ApiProperty({
    description: 'Rate source',
    example: 'MANUAL',
  })
  source: string;
}

export class LatestRatesResponseDto {
  @ApiProperty({
    description: 'Exchange rate ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id: string;

  @ApiProperty({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  currencyId: string;

  @ApiProperty({
    description: 'Exchange rate value',
    example: 1.2345,
  })
  rate: number;

  @ApiProperty({
    description: 'Rate date',
    example: '2026-06-01T12:00:00.000Z',
  })
  date: Date | null;

  @ApiProperty({
    description: 'Rate source',
    example: 'MANUAL',
  })
  source: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'EUR',
  })
  currencyCode: string;

  @ApiProperty({
    description: 'Currency name',
    example: 'Euro',
  })
  currencyName: string;

  @ApiProperty({
    description: 'Currency symbol',
    example: '€',
  })
  currencySymbol: string;
}

export class RateHistoryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id: string;

  @ApiProperty({ example: 'USD' })
  currencyCode: string;

  @ApiProperty({ example: 36.5 })
  rate: number;

  @ApiProperty({ example: '2026-10-26T00:00:00.000Z' })
  date: Date;

  @ApiProperty({ example: 'BCV' })
  source: string;

  @ApiProperty({ example: 'BCV no publicó tasa', nullable: true })
  reason: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  createdBy: string | null;
}

export class RateWithFreshnessDto extends RateHistoryDto {
  @ApiProperty({ description: 'Horas desde la publicación de la tasa', example: 2.5 })
  ageHours: number;

  @ApiProperty({ description: 'true si supera el umbral de antigüedad', example: false })
  isStale: boolean;
}
