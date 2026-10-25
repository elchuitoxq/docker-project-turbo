import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ example: 'Validation failed' })
  message: string | string[];

  @ApiProperty({ example: '2026-06-03T14:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/v1/auth/login' })
  path: string;
}

export class ValidationErrorDto {
  @ApiProperty({ example: 'email' })
  field: string;

  @ApiProperty({ example: ['email must be an email'] })
  messages: string[];
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 137 })
  total: number;

  @ApiProperty({ example: 7 })
  totalPages: number;

  @ApiProperty({ example: false })
  hasNext: boolean;

  @ApiProperty({ example: false })
  hasPrev: boolean;
}

export class ApiPaginatedResponseDto<T> {
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class PaginationQueryDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 100 })
  limit?: number = 20;

  @ApiProperty({ required: false, description: 'Sort field with optional :asc/:desc' })
  sort?: string;
}
