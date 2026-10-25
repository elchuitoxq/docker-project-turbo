import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ description: 'Company UUID' })
  @IsUUID('4')
  companyId: string;

  @ApiProperty({
    description: 'Branch name',
    example: 'Main Branch',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Branch address',
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
    description: 'Email address',
    example: 'branch@company.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ description: 'Company UUID' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Branch name',
    example: 'Main Branch Updated',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Branch address',
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
    description: 'Email address',
    example: 'newbranch@company.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class BranchResponseDto {
  @ApiProperty({
    description: 'Branch ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ description: 'Company UUID' })
  companyId: string;

  @ApiProperty({
    description: 'Branch name',
    example: 'Main Branch',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Branch address',
    example: 'Av. Libertador, Caracas, Venezuela',
  })
  address: string | null;

  @ApiPropertyOptional({
    description: 'Tax identification number',
    example: 'J-12345678-9',
  })
  taxId: string | null;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+58-212-555-1234',
  })
  phone: string | null;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'branch@company.com',
  })
  email: string | null;

  @ApiProperty({
    description: 'Is branch active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Branch creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;
}

export class CompanyResponseDto {
  @ApiProperty({ description: 'Company UUID' })
  id: string;

  @ApiProperty({
    description: 'Company tax identification number',
    example: 'J-12345678-9',
  })
  taxId: string | null;

  @ApiProperty({
    description: 'Company legal name',
    example: 'Acme Holdings C.A.',
  })
  name: string;

  @ApiPropertyOptional({ example: 'Av. Libertador, Caracas' })
  address: string | null;

  @ApiPropertyOptional({ example: '+58-212-555-1234' })
  phone: string | null;

  @ApiPropertyOptional({ example: 'info@acme.com' })
  email: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Number of branches belonging to this company', example: 3 })
  branchCount: number;

  @ApiProperty({ type: [BranchResponseDto] })
  branches: BranchResponseDto[];
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Holdings C.A.' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'J-12345678-9' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ example: 'Av. Libertador, Caracas' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+58-212-555-1234' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'Acme Holdings C.A.' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'J-12345678-9' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ example: 'Av. Libertador, Caracas' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+58-212-555-1234' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
