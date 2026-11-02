import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'SALES_LEAD' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Manages sales operations' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'SALES_LEAD' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'Manages sales operations' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

export class PermissionResponseDto {
  @ApiProperty({ example: '3f1c2b7e-7a4d-4f0e-9a51-2c8d6e1b0f3a' })
  id: string;

  @ApiProperty({ example: 'finance:invoices:view' })
  code: string;

  @ApiProperty({ example: 'Ver facturas', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'finance' })
  module: string;
}

export class RoleResponseDto {
  @ApiProperty({ example: '3f1c2b7e-7a4d-4f0e-9a51-2c8d6e1b0f3a' })
  id: string;

  @ApiProperty({ example: 'SALES_LEAD' })
  name: string;

  @ApiProperty({ example: 'Manages sales operations', nullable: true })
  description: string | null;

  @ApiProperty({ example: false })
  isSystem: boolean;

  @ApiProperty({ type: [PermissionResponseDto] })
  permissions: PermissionResponseDto[];
}
