import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePartnerDto {
  @ApiProperty({
    description: 'Partner name',
    example: 'Acme Corporation',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Partner email address',
    example: 'contact@acme.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Tax identification number (unique)',
    example: 'J-12345678-9',
  })
  @IsString()
  taxId: string;

  @ApiPropertyOptional({
    description: 'Partner address',
    example: 'Av. Libertador, Caracas, Venezuela',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+58-212-555-1234',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Partner type',
    enum: ['CUSTOMER', 'VENDOR'],
    example: 'CUSTOMER',
  })
  @IsOptional()
  @IsEnum(['CUSTOMER', 'VENDOR'])
  type?: 'CUSTOMER' | 'VENDOR';

  @ApiPropertyOptional({
    description: 'Taxpayer type',
    enum: ['ORDINARY', 'SPECIAL', 'LEGAL'],
    example: 'ORDINARY',
  })
  @IsOptional()
  @IsEnum(['ORDINARY', 'SPECIAL', 'LEGAL'])
  taxpayerType?: 'ORDINARY' | 'SPECIAL' | 'LEGAL';

  @ApiPropertyOptional({
    description: 'Retention rate percentage (0-100)',
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  retentionRate?: number;

  @ApiPropertyOptional({
    description: 'Is special taxpayer',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isSpecialTaxpayer?: boolean;

  @ApiPropertyOptional({
    description: 'Credit limit',
    example: 10000.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({
    description: 'Días de crédito para calcular el vencimiento de compras (T-03-02)',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditDays?: number;

  @ApiPropertyOptional({
    description: 'ISLR concept ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  islrConceptId?: string;
}

export class UpdatePartnerDto {
  @ApiPropertyOptional({
    description: 'Partner name',
    example: 'Acme Corporation Updated',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Partner email address',
    example: 'newcontact@acme.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Tax identification number (unique)',
    example: 'J-87654321-9',
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Partner address',
    example: 'Av. Principal, Caracas, Venezuela',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+58-212-555-5678',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Partner type',
    enum: ['CUSTOMER', 'VENDOR'],
    example: 'VENDOR',
  })
  @IsOptional()
  @IsEnum(['CUSTOMER', 'VENDOR'])
  type?: 'CUSTOMER' | 'VENDOR';

  @ApiPropertyOptional({
    description: 'Taxpayer type',
    enum: ['ORDINARY', 'SPECIAL', 'LEGAL'],
    example: 'SPECIAL',
  })
  @IsOptional()
  @IsEnum(['ORDINARY', 'SPECIAL', 'LEGAL'])
  taxpayerType?: 'ORDINARY' | 'SPECIAL' | 'LEGAL';

  @ApiPropertyOptional({
    description: 'Retention rate percentage (0-100)',
    example: 100,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  retentionRate?: number;

  @ApiPropertyOptional({
    description: 'Is special taxpayer',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isSpecialTaxpayer?: boolean;

  @ApiPropertyOptional({
    description: 'Credit limit',
    example: 50000.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({
    description: 'Días de crédito para calcular el vencimiento de compras (T-03-02)',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditDays?: number;

  @ApiPropertyOptional({
    description: 'ISLR concept ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  islrConceptId?: string;
}

export class PartnerResponseDto {
  @ApiProperty({
    description: 'Partner ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Partner name',
    example: 'Acme Corporation',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Partner email address',
    example: 'contact@acme.com',
  })
  email: string | null;

  @ApiProperty({
    description: 'Tax identification number',
    example: 'J-12345678-9',
  })
  taxId: string;

  @ApiPropertyOptional({
    description: 'Partner address',
    example: 'Av. Libertador, Caracas, Venezuela',
  })
  address: string | null;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+58-212-555-1234',
  })
  phone: string | null;

  @ApiProperty({
    description: 'Partner type',
    enum: ['CUSTOMER', 'VENDOR'],
    example: 'CUSTOMER',
  })
  type: 'CUSTOMER' | 'VENDOR';

  @ApiProperty({
    description: 'Taxpayer type',
    enum: ['ORDINARY', 'SPECIAL', 'LEGAL'],
    example: 'ORDINARY',
  })
  taxpayerType: 'ORDINARY' | 'SPECIAL' | 'LEGAL';

  @ApiProperty({
    description: 'Retention rate percentage',
    example: 75,
  })
  retentionRate: number;

  @ApiProperty({
    description: 'Is special taxpayer',
    example: false,
  })
  isSpecialTaxpayer: boolean;

  @ApiProperty({
    description: 'Credit limit',
    example: 10000.0,
  })
  creditLimit: number;

  @ApiProperty({
    description: 'Días de crédito para el vencimiento de compras',
    example: 30,
  })
  creditDays: number;

  @ApiPropertyOptional({
    description: 'ISLR concept ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  islrConceptId: string | null;

  @ApiPropertyOptional({
    description: 'Partner creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;

  @ApiPropertyOptional({
    description: 'Partner last update timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  updatedAt: Date | null;
}

export class PartnerStatsResponseDto {
  @ApiProperty({
    description: 'Number of customer partners',
    example: 150,
  })
  customer: number;

  @ApiProperty({
    description: 'Number of vendor partners',
    example: 75,
  })
  vendor: number;

  @ApiProperty({
    description: 'Total number of partners',
    example: 225,
  })
  total: number;
}
