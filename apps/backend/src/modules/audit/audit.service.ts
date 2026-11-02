import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../../database';
import { auditLogs } from '../../schema';
import { ACTION_LABELS, AUDIT_TARGETS, actionVerb } from '../../common/audit/audit-catalog';
import { describeAuditEvent, diffSnapshot } from '../../common/audit/audit-diff';

export interface AuditLogResponseDto {
  id: string;
  entityTable: string;
  entityId: string | null;
  action: string;
  actionLabel: string | null;
  entityLabel: string | null;
  module: string | null;
  changes: unknown;
  branchId: string | null;
  userId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRoles: string[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  httpMethod: string | null;
  route: string | null;
  result: string | null;
  durationMs: number | null;
  documentCode: string | null;
  documentStatus: string | null;
  description: string | null;
  createdAt: Date | null;
}

export interface AuditLogFilters {
  q?: string;
  userId?: string;
  module?: string;
  result?: string;
  entityTable?: string;
  entityId?: string;
  action?: string;
  documentCode?: string;
  branchId?: string;
  from?: Date;
  to?: Date;
}

export type AuditLogPage = {
  data: AuditLogResponseDto[];
  total: number;
  page: number;
  limit: number;
};

export type AuditFacet = { value: string; label: string; count: number };

export type AuditFacets = {
  actors: Array<{ userId: string | null; name: string; count: number }>;
  modules: AuditFacet[];
  actions: AuditFacet[];
  tables: AuditFacet[];
  results: AuditFacet[];
};

export interface AuditRecordInput {
  entityTable: string;
  entityId?: string | null;
  action: string;
  actionLabel?: string | null;
  entityLabel?: string | null;
  module?: string | null;
  branchId?: string | null;
  userId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRoles?: string[] | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  httpMethod?: string | null;
  route?: string | null;
  result?: 'SUCCESS' | 'DENIED' | 'ERROR';
  durationMs?: number | null;
  changes?: unknown;
  description?: string | null;
  documentCode?: string | null;
  documentStatus?: string | null;
}

/** Tabla -> módulo, con lo que el catálogo no cubre (`accounting_periods`, etc.). */
export function moduleForTable(table: string): string {
  const known = Object.values(AUDIT_TARGETS).find(target => target.table === table);
  if (known) return known.module;

  const prefix = table.split('_')[0];
  const byPrefix: Record<string, string> = {
    accounting: 'accounting',
    payroll: 'hr',
    employee: 'hr',
    inventory: 'inventory',
    bank: 'treasury',
    payment: 'treasury',
    product: 'inventory',
    warehouse: 'inventory',
    credit: 'billing',
    tax: 'billing',
    order: 'operations',
    partner: 'operations',
    loan: 'operations',
    user: 'settings',
    role: 'settings',
    branch: 'settings',
  };
  return byPrefix[prefix] ?? 'operations';
}

/** `%` y `_` son comodines de `ILIKE`: un documento con guion bajo no debe comportarse raro. */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, match => `\\${match}`);
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Escritura append-only del registro (`S-00`, regla R3).
   *
   * Nunca lanza: la auditoría no puede tumbar la operación de negocio que la origina.
   */
  async record(input: AuditRecordInput): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        entityTable: input.entityTable,
        entityId: input.entityId ?? null,
        action: input.action,
        actionLabel: input.actionLabel ?? actionVerb(input.action),
        entityLabel: input.entityLabel ?? null,
        module: input.module ?? moduleForTable(input.entityTable),
        branchId: input.branchId ?? null,
        userId: input.userId ?? null,
        actorName: input.actorName ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRoles: input.actorRoles ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        httpMethod: input.httpMethod ?? null,
        route: input.route ?? null,
        result: input.result ?? 'SUCCESS',
        durationMs: input.durationMs ?? null,
        changes: (input.changes ?? null) as never,
        description: input.description ?? null,
        documentCode: input.documentCode ?? null,
        documentStatus: input.documentStatus ?? null,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la auditoría de ${input.entityTable}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Registra un cambio con su antes/después real.
   *
   * Se usa desde los servicios que ya tienen las dos versiones a mano; el interceptor hace lo mismo
   * releyendo la fila.
   */
  async recordChange(
    input: Omit<AuditRecordInput, 'changes' | 'description'> & {
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
      createdDescription?: string;
      verb?: string;
    }
  ): Promise<void> {
    const diff = diffSnapshot(input.before, input.after);
    if (!diff) return;

    const verb = input.verb ?? ACTION_LABELS[input.action] ?? actionVerb(input.action);

    await this.record({
      ...input,
      actionLabel: verb,
      changes: diff as unknown,
      description:
        input.createdDescription ??
        describeAuditEvent({
          verb,
          entityLabel: input.entityLabel,
          documentCode: input.documentCode,
          diff,
        }),
    });
  }

  async findByEntity(entityTable: string, entityId: string): Promise<AuditLogResponseDto[]> {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityTable, entityTable), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt));

    return logs.map(this.toResponseDto);
  }

  async findAll(filters: AuditLogFilters): Promise<AuditLogResponseDto[]> {
    const whereClause = this.buildWhere(filters);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt));

    return logs.map(this.toResponseDto);
  }

  /**
   * Consulta paginada del visor (`T-07-01`).
   *
   * El `total` se cuenta con el mismo `where` para que el paginador no mienta cuando hay filtros.
   */
  async findPaginated(filters: AuditLogFilters, page = 1, limit = 50): Promise<AuditLogPage> {
    const whereClause = this.buildWhere(filters);
    const safePage = Math.max(1, Math.trunc(page));
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));

    const [rows, [counted]] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(safeLimit)
        .offset((safePage - 1) * safeLimit),
      db
        .select({ total: sql<string>`count(*)` })
        .from(auditLogs)
        .where(whereClause),
    ]);

    return {
      data: rows.map(this.toResponseDto),
      total: Number(counted?.total ?? 0),
      page: safePage,
      limit: safeLimit,
    };
  }

  /** Filas para exportar a CSV (tope duro para no volcar la tabla entera). */
  async exportRows(filters: AuditLogFilters, limit = 10_000): Promise<AuditLogResponseDto[]> {
    const rows = await db
      .select()
      .from(auditLogs)
      .where(this.buildWhere(filters))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return rows.map(this.toResponseDto);
  }

  /** Tablas auditadas, para poblar el filtro del visor. */
  async listEntityTables(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ entityTable: auditLogs.entityTable })
      .from(auditLogs)
      .orderBy(auditLogs.entityTable);

    return rows.map(row => row.entityTable);
  }

  /** Valores realmente presentes en la tabla, con conteo: los filtros muestran lo que existe. */
  async facets(filters: AuditLogFilters = {}): Promise<AuditFacets> {
    const whereClause = this.buildWhere({ ...filters, module: undefined, result: undefined });

    const actorRows = await db
      .select({
        userId: auditLogs.userId,
        name: auditLogs.actorName,
        count: sql<string>`count(*)`,
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.userId, auditLogs.actorName)
      .orderBy(desc(sql`count(*)`))
      .limit(100);

    const groupBy = async (column: PgColumn) => {
      const rows = await db
        .select({ value: sql<string | null>`${column}`, count: sql<string>`count(*)` })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(column)
        .orderBy(desc(sql`count(*)`))
        .limit(50);

      return rows
        .filter(row => row.value !== null && row.value !== undefined)
        .map(row => ({ value: String(row.value), count: Number(row.count) }));
    };

    const [modules, actions, tables, results] = await Promise.all([
      groupBy(auditLogs.module),
      groupBy(auditLogs.action),
      groupBy(auditLogs.entityTable),
      groupBy(auditLogs.result),
    ]);

    return {
      actors: actorRows.map(row => ({
        userId: row.userId,
        name: row.name ?? 'Sistema',
        count: Number(row.count),
      })),
      modules: modules.map(item => ({ ...item, label: item.value })),
      actions: actions.map(item => ({ ...item, label: actionVerb(item.value) })),
      tables: tables.map(item => ({ ...item, label: item.value })),
      results: results.map(item => ({ ...item, label: item.value })),
    };
  }

  private buildWhere(filters: AuditLogFilters) {
    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }

    if (filters.module) {
      conditions.push(eq(auditLogs.module, filters.module));
    }

    if (filters.result) {
      conditions.push(eq(auditLogs.result, filters.result));
    }

    if (filters.entityTable) {
      conditions.push(eq(auditLogs.entityTable, filters.entityTable));
    }

    if (filters.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }

    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }

    if (filters.documentCode) {
      conditions.push(ilike(auditLogs.documentCode, `%${escapeLike(filters.documentCode)}%`));
    }

    if (filters.branchId) {
      conditions.push(eq(auditLogs.branchId, filters.branchId));
    }

    if (filters.from) {
      conditions.push(gte(auditLogs.createdAt, filters.from));
    }

    if (filters.to) {
      conditions.push(lte(auditLogs.createdAt, filters.to));
    }

    const query = filters.q?.trim();
    if (query) {
      const pattern = `%${escapeLike(query)}%`;
      conditions.push(
        or(
          ilike(auditLogs.description, pattern),
          ilike(auditLogs.documentCode, pattern),
          ilike(auditLogs.actorName, pattern),
          ilike(auditLogs.actorEmail, pattern),
          ilike(auditLogs.actionLabel, pattern),
          ilike(auditLogs.entityTable, pattern),
          sql`${auditLogs.entityId}::text ILIKE ${pattern}`
        )
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private toResponseDto(log: typeof auditLogs.$inferSelect): AuditLogResponseDto {
    return {
      id: log.id,
      entityTable: log.entityTable,
      entityId: log.entityId,
      action: log.action,
      actionLabel: log.actionLabel,
      entityLabel: log.entityLabel,
      module: log.module,
      changes: log.changes,
      branchId: log.branchId,
      userId: log.userId,
      actorName: log.actorName,
      actorEmail: log.actorEmail,
      actorRoles: log.actorRoles,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      httpMethod: log.httpMethod,
      route: log.route,
      result: log.result,
      durationMs: log.durationMs,
      documentCode: log.documentCode,
      documentStatus: log.documentStatus,
      description: log.description,
      createdAt: log.createdAt,
    };
  }
}
