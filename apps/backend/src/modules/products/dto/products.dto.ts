import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Electronics',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Electronic devices and accessories',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Parent category ID for hierarchical categories',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateProductCategoryDto {
  @ApiPropertyOptional({
    description: 'Category name',
    example: 'Electronics Updated',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Updated description for electronic devices',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Parent category ID for hierarchical categories',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class ProductCategoryResponseDto {
  @ApiProperty({
    description: 'Category ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Electronics',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Electronic devices and accessories',
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Parent category ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  parentId: string | null;
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Product SKU (unique)',
    example: 'ELEC-001',
  })
  @IsString()
  sku: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Laptop Pro 15',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'High-performance laptop with 16GB RAM',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Category ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Product cost',
    example: 500.00,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({
    description: 'Product price',
    example: 899.99,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: 'Is tax exempt',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isExempt?: boolean;

  @ApiPropertyOptional({
    description: 'Tax rate percentage',
    example: 16.00,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Product type',
    enum: ['PHYSICAL', 'DIGITAL', 'SERVICE'],
    example: 'PHYSICAL',
  })
  @IsOptional()
  @IsEnum(['PHYSICAL', 'DIGITAL', 'SERVICE'])
  type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

  @ApiPropertyOptional({
    description: 'Minimum stock level',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({
    description: 'Has batch tracking',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hasBatches?: boolean;

  @ApiPropertyOptional({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  currencyId?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Product SKU (unique)',
    example: 'ELEC-002',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Laptop Pro 15 Updated',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Updated description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Category ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Product cost',
    example: 550.00,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({
    description: 'Product price',
    example: 999.99,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: 'Is tax exempt',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isExempt?: boolean;

  @ApiPropertyOptional({
    description: 'Tax rate percentage',
    example: 16.00,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Product type',
    enum: ['PHYSICAL', 'DIGITAL', 'SERVICE'],
    example: 'PHYSICAL',
  })
  @IsOptional()
  @IsEnum(['PHYSICAL', 'DIGITAL', 'SERVICE'])
  type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

  @ApiPropertyOptional({
    description: 'Minimum stock level',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({
    description: 'Has batch tracking',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  hasBatches?: boolean;

  @ApiPropertyOptional({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  currencyId?: string;
}

export class ProductResponseDto {
  @ApiProperty({
    description: 'Product ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Product SKU',
    example: 'ELEC-001',
  })
  sku: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Laptop Pro 15',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'High-performance laptop with 16GB RAM',
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Category ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  categoryId: string | null;

  @ApiProperty({
    description: 'Product cost',
    example: 500.00,
  })
  cost: number;

  @ApiProperty({
    description: 'Product price',
    example: 899.99,
  })
  price: number;

  @ApiProperty({
    description: 'Is tax exempt',
    example: false,
  })
  isExempt: boolean;

  @ApiProperty({
    description: 'Tax rate percentage',
    example: 16.00,
  })
  taxRate: number;

  @ApiProperty({
    description: 'Product type',
    enum: ['PHYSICAL', 'DIGITAL', 'SERVICE'],
    example: 'PHYSICAL',
  })
  type: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

  @ApiProperty({
    description: 'Minimum stock level',
    example: 10,
  })
  minStock: number;

  @ApiProperty({
    description: 'Has batch tracking',
    example: true,
  })
  hasBatches: boolean;

  @ApiPropertyOptional({
    description: 'Currency ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  currencyId: string | null;

  @ApiPropertyOptional({
    description: 'Category',
  })
  category?: ProductCategoryResponseDto | null;

  @ApiPropertyOptional({
    description: 'Product creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;

  @ApiPropertyOptional({
    description: 'Product last update timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  updatedAt: Date | null;
}
