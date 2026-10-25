import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiParam,
  getSchemaPath,
} from '@nestjs/swagger';
import { Type } from '@nestjs/common';
import { ApiErrorResponseDto, ApiPaginatedResponseDto } from '../dto/api-response.dto';

export function ApiAuthResponses() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - missing or invalid JWT token',
      type: ApiErrorResponseDto,
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - user does not have required permissions',
      type: ApiErrorResponseDto,
    }),
  );
}

export function ApiPaginationQuery() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (1-based)',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Items per page (max 100)',
      example: 20,
    }),
    ApiQuery({
      name: 'sort',
      required: false,
      type: String,
      description: 'Sort field (e.g. "createdAt:desc")',
    }),
  );
}

export function ApiIdParam(name: string = 'id', description: string = 'Resource ID') {
  return ApiParam({ name, type: String, description });
}

export function ApiCrudResponses(model: Type<unknown>, options?: { softDelete?: boolean }) {
  const decorators = [
    ApiResponse({ status: 200, description: 'Resource retrieved', type: model }),
    ApiResponse({ status: 201, description: 'Resource created', type: model }),
    ApiResponse({ status: 400, description: 'Invalid input', type: ApiErrorResponseDto }),
    ApiResponse({ status: 404, description: 'Resource not found', type: ApiErrorResponseDto }),
  ];
  if (options?.softDelete) {
    decorators.push(
      ApiResponse({ status: 409, description: 'Resource has related records', type: ApiErrorResponseDto }),
    );
  }
  return applyDecorators(...decorators);
}

export function ApiPaginatedResponse<T>(model: Type<T>) {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Paginated list',
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiPaginatedResponseDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
          },
        ],
      },
    }),
  );
}

export function ApiServerError() {
  return ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: ApiErrorResponseDto,
  });
}
