import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBankDto {
  @ApiProperty({
    description: 'Bank name',
    example: 'Banco de Venezuela',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Bank code',
    example: '0102',
  })
  @IsString()
  code: string;

  @ApiPropertyOptional({
    description: 'Is bank active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBankDto {
  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'Banco de Venezuela Actualizado',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Bank code',
    example: '0103',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Is bank active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BankResponseDto {
  @ApiProperty({
    description: 'Bank ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Bank name',
    example: 'Banco de Venezuela',
  })
  name: string;

  @ApiProperty({
    description: 'Bank code',
    example: '0102',
  })
  code: string;

  @ApiProperty({
    description: 'Is bank active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Bank creation timestamp',
    example: '2026-06-01T12:00:00.000Z',
  })
  createdAt: Date | null;
}
