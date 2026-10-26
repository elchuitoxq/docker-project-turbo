import { IsString, IsEmail, IsOptional, IsArray, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User full name',
    example: 'Juan Pérez',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'juan@empresa.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password (min 6 characters)',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User full name',
    example: 'Juan Pérez Actualizado',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'juan.nuevo@empresa.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'User password (min 6 characters)',
    example: 'newpassword123',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User full name',
    example: 'Juan Pérez',
  })
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'juan@empresa.com',
  })
  email: string;

  @ApiPropertyOptional({
    description: 'User creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt?: Date | null;

  @ApiPropertyOptional({
    description: 'User last update timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  updatedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'User roles',
    type: [String],
    example: ['ADMIN', 'MANAGER'],
  })
  roles?: string[];

  @ApiPropertyOptional({
    description: 'Branches assigned to the user, including the selected default branch',
    type: [Object],
  })
  branches?: { id: string; name: string; companyId: string; isDefault: boolean }[];
}

export class AssignRolesDto {
  @ApiProperty({
    description: 'Role IDs to assign',
    example: ['550e8400-e29b-41d4-a716-446655440001'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds: string[];
}

export class AssignBranchesDto {
  @ApiProperty({ description: 'Branch IDs to assign', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds: string[];

  @ApiPropertyOptional({ description: 'Default branch ID; required when branchIds is non-empty' })
  @IsOptional()
  @IsUUID('4')
  defaultBranchId?: string;
}
