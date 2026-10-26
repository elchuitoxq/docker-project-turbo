import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService, AuditLogResponseDto, AuditLogFilters } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('audit')
@Controller('v1/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all audit logs',
    description: 'Retrieves a list of all audit logs with optional filters',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'entityTable',
    required: false,
    description: 'Filter by entity table name',
    example: 'invoices',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Filter logs from this date (ISO 8601 format)',
    example: '2026-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Filter logs until this date (ISO 8601 format)',
    example: '2026-12-31T23:59:59Z',
  })
  @ApiResponse({
    status: 200,
    description: 'List of audit logs',
  })
  async findAll(
    @Query('userId') userId?: string,
    @Query('entityTable') entityTable?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ): Promise<AuditLogResponseDto[]> {
    const filters: AuditLogFilters = {};

    if (userId) filters.userId = userId;
    if (entityTable) filters.entityTable = entityTable;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);

    return this.auditService.findAll(filters);
  }

  @Get(':entityTable/:entityId')
  @ApiOperation({
    summary: 'Get audit history for an entity',
    description: 'Retrieves the audit history for a specific entity by table name and ID',
  })
  @ApiParam({
    name: 'entityTable',
    description: 'The name of the entity table',
    example: 'invoices',
  })
  @ApiParam({
    name: 'entityId',
    description: 'The UUID of the entity',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit history for the entity',
  })
  async findByEntity(
    @Param('entityTable') entityTable: string,
    @Param('entityId') entityId: string
  ): Promise<AuditLogResponseDto[]> {
    return this.auditService.findByEntity(entityTable, entityId);
  }
}
