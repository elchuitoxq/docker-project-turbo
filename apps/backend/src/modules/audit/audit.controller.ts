import { Controller, Get, Header, Param, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService, AuditLogFilters } from './audit.service';
import { AuditFacetsDto, AuditLogPageDto, AuditLogResponseDto } from './dto/audit.dto';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

const CSV_COLUMNS = [
  ['fecha', (row: AuditLogResponseDto) => row.createdAt?.toISOString() ?? ''],
  ['modulo', (row: AuditLogResponseDto) => row.module ?? ''],
  ['accion', (row: AuditLogResponseDto) => row.actionLabel ?? row.action],
  ['tabla', (row: AuditLogResponseDto) => row.entityTable],
  ['documento', (row: AuditLogResponseDto) => row.documentCode ?? ''],
  ['estado_documento', (row: AuditLogResponseDto) => row.documentStatus ?? ''],
  ['usuario', (row: AuditLogResponseDto) => row.actorName ?? 'sistema'],
  ['correo', (row: AuditLogResponseDto) => row.actorEmail ?? ''],
  ['resultado', (row: AuditLogResponseDto) => row.result ?? ''],
  ['descripcion', (row: AuditLogResponseDto) => row.description ?? ''],
  ['ip', (row: AuditLogResponseDto) => row.ipAddress ?? ''],
] as const;

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function toCsv(rows: AuditLogResponseDto[]): string {
  const header = CSV_COLUMNS.map(([name]) => csvCell(name)).join(',');
  const body = rows.map(row => CSV_COLUMNS.map(([, read]) => csvCell(String(read(row)))).join(','));
  return [`\uFEFF${header}`, ...body].join('\r\n');
}

@ApiTags('audit')
@ApiBearerAuth()
@ApiExtraModels(AuditLogResponseDto, AuditLogPageDto, AuditFacetsDto)
@Controller('v1/audit')
@RequirePermissions('settings:audit:view')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('entities')
  @ApiOperation({
    summary: 'Tablas auditadas',
    description: 'Lista de `entityTable` presentes en el registro, para el filtro del visor',
  })
  @ApiResponse({ status: 200, description: 'Tablas auditadas', type: [String] })
  async listEntityTables(): Promise<string[]> {
    return this.auditService.listEntityTables();
  }

  @Get('facets')
  @ApiOperation({
    summary: 'Valores disponibles para filtrar',
    description:
      'Usuarios, módulos, acciones, tablas y resultados realmente presentes en el registro, con su conteo',
  })
  @ApiResponse({ status: 200, description: 'Facetas del registro', type: AuditFacetsDto })
  async facets(): Promise<AuditFacetsDto> {
    return this.auditService.facets();
  }

  @Get('export')
  @RequirePermissions('settings:audit:export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="auditoria.csv"')
  @ApiOperation({
    summary: 'Exporta a CSV',
    description: 'Aplica los mismos filtros del visor con un tope de 10.000 filas',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Búsqueda de texto libre' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'module', required: false, example: 'billing' })
  @ApiQuery({ name: 'result', required: false, enum: ['SUCCESS', 'DENIED', 'ERROR'] })
  @ApiQuery({ name: 'action', required: false, example: 'POST' })
  @ApiQuery({ name: 'documentCode', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200, description: 'CSV de la bitácora' })
  async export(
    @CurrentUser() user: CurrentUserData,
    @Req() request: Request,
    @Query('q') q?: string,
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('result') result?: string,
    @Query('action') action?: string,
    @Query('documentCode') documentCode?: string,
    @Query('entityTable') entityTable?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ): Promise<string> {
    const filters = this.buildFilters({
      q,
      userId,
      module,
      result,
      action,
      documentCode,
      entityTable,
      from,
      to,
    });
    const rows = await this.auditService.exportRows(filters);

    await this.auditService.record({
      entityTable: 'audit_logs',
      action: 'EXPORT',
      actionLabel: 'Exportó',
      entityLabel: 'bitácora',
      module: 'settings',
      userId: user?.id ?? null,
      actorName: user?.name ?? null,
      actorEmail: user?.email ?? null,
      actorRoles: user?.roles ?? null,
      ipAddress: request?.ip ?? null,
      httpMethod: 'GET',
      route: '/v1/audit/export',
      description: `Exportó ${rows.length} registro${rows.length === 1 ? '' : 's'} de auditoría`,
    });

    return toCsv(rows);
  }

  @Get()
  @ApiOperation({
    summary: 'Consulta la bitácora',
    description:
      'Con `paginated=true` devuelve `{ data, total, page, limit }`; sin el flag mantiene el arreglo plano. ' +
      '`q` busca en descripción, documento, usuario y acción.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Búsqueda libre: código de documento, usuario, correo o resumen',
    example: 'A-90006',
  })
  @ApiQuery({ name: 'module', required: false, description: 'billing, treasury, inventory…' })
  @ApiQuery({
    name: 'result',
    required: false,
    enum: ['SUCCESS', 'DENIED', 'ERROR'],
    description: 'Filtra por desenlace de la operación',
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
    name: 'entityId',
    required: false,
    description: 'Filter by entity ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({ name: 'action', required: false, description: 'CREATE, UPDATE, DELETE, VOID…' })
  @ApiQuery({
    name: 'documentCode',
    required: false,
    description: 'Búsqueda parcial por documento',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'paginated', required: false, description: '`true` para respuesta paginada' })
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
    description: 'Lista plana de registros o página `{ data, total, page, limit }`',
    content: {
      'application/json': {
        schema: {
          oneOf: [
            { type: 'array', items: { $ref: getSchemaPath(AuditLogResponseDto) } },
            { $ref: getSchemaPath(AuditLogPageDto) },
          ],
        },
      },
    },
  })
  async findAll(
    @Query('q') q?: string,
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('result') result?: string,
    @Query('entityTable') entityTable?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('documentCode') documentCode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('paginated') paginated?: string
  ): Promise<AuditLogResponseDto[] | AuditLogPageDto> {
    const filters = this.buildFilters({
      q,
      userId,
      module,
      result,
      action,
      documentCode,
      entityTable,
      entityId,
      from,
      to,
    });

    if (paginated === 'true') {
      return this.auditService.findPaginated(
        filters,
        page ? Number(page) : 1,
        limit ? Number(limit) : 50
      );
    }

    return this.auditService.findAll(filters);
  }

  @Get(':entityTable/:entityId')
  @ApiOperation({
    summary: 'Historial de una entidad',
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
    type: [AuditLogResponseDto],
  })
  async findByEntity(
    @Param('entityTable') entityTable: string,
    @Param('entityId') entityId: string
  ): Promise<AuditLogResponseDto[]> {
    return this.auditService.findByEntity(entityTable, entityId);
  }

  private buildFilters(raw: {
    q?: string;
    userId?: string;
    module?: string;
    result?: string;
    entityTable?: string;
    entityId?: string;
    action?: string;
    documentCode?: string;
    from?: string;
    to?: string;
  }): AuditLogFilters {
    const filters: AuditLogFilters = {};

    if (raw.q?.trim()) filters.q = raw.q.trim();
    if (raw.userId) filters.userId = raw.userId;
    if (raw.module) filters.module = raw.module;
    if (raw.result) filters.result = raw.result;
    if (raw.entityTable) filters.entityTable = raw.entityTable;
    if (raw.entityId) filters.entityId = raw.entityId;
    if (raw.action) filters.action = raw.action;
    if (raw.documentCode?.trim()) filters.documentCode = raw.documentCode.trim();
    // Un `from` de fecha suelta excluye el propio día si se compara contra medianoche: el visor
    // manda ISO completo, y aquí se acepta el 400 de una fecha inválida.
    if (raw.from) filters.from = new Date(raw.from);
    if (raw.to) filters.to = new Date(raw.to);

    return filters;
  }
}
