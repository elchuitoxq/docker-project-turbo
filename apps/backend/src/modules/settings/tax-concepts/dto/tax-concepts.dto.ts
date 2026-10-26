import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaxConceptDto {
  @ApiProperty({
    description: 'Tax concept code (unique)',
    example: 'ISLR-001',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Tax concept name',
    example: 'Honorarios Profesionales',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Retention percentage (0-100)',
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  retentionPercentage: number;

  @ApiPropertyOptional({
    description: 'Minimum base amount',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseMin?: number;

  @ApiPropertyOptional({
    description: 'Subtrahend amount',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  sustraendo?: number;

  @ApiPropertyOptional({
    description: 'Is concept enabled',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateTaxConceptDto {
  @ApiPropertyOptional({
    description: 'Tax concept code (unique)',
    example: 'ISLR-002',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Tax concept name',
    example: 'Honorarios Profesionales Actualizado',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Retention percentage (0-100)',
    example: 80,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  retentionPercentage?: number;

  @ApiPropertyOptional({
    description: 'Minimum base amount',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseMin?: number;

  @ApiPropertyOptional({
    description: 'Subtrahend amount',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  sustraendo?: number;

  @ApiPropertyOptional({
    description: 'Is concept enabled',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class TaxConceptResponseDto {
  @ApiProperty({
    description: 'Tax concept ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Tax concept code',
    example: 'ISLR-001',
  })
  code: string;

  @ApiProperty({
    description: 'Tax concept name',
    example: 'Honorarios Profesionales',
  })
  name: string;

  @ApiProperty({
    description: 'Retention percentage',
    example: 75,
  })
  retentionPercentage: number;

  @ApiProperty({
    description: 'Minimum base amount',
    example: 0,
  })
  baseMin: number;

  @ApiProperty({
    description: 'Subtrahend amount',
    example: 0,
  })
  sustraendo: number;

  @ApiProperty({
    description: 'Is concept enabled',
    example: true,
  })
  isEnabled: boolean;
}
