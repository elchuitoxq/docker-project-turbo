import { Injectable } from '@nestjs/common';
import { db } from '../../database';
import { auditLogs } from '../../schema';
import { eq, and, gte, lte, desc, like, sql } from 'drizzle-orm';

export interface AuditLogResponseDto {
  id: string;
  entityTable: string;
  entityId: string;
  action: string;
  changes: unknown;
  branchId: string | null;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  documentCode: string | null;
  documentStatus: string | null;
  description: string | null;
  createdAt: Date | null;
}

export interface AuditLogFilters {
  userId?: string;
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

export interface AuditRecordInput {
  entityTable: string;
  entityId: string;
  action: string;
  branchId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  changes?: unknown;
  description?: string | null;
}

@Injectable()
export class AuditService {
  /** Escritura append-only desde el interceptor de cambios sensibles (`S-00`, regla R3 de auditoría). */
  async record(input: AuditRecordInput): Promise<void> {
    await db.insert(auditLogs).values({
      entityTable: input.entityTable,
      entityId: input.entityId,
      action: input.action,
      branchId: input.branchId ?? null,
      userId: input.userId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      changes: (input.changes ?? null) as never,
      description: input.description ?? null,
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
   * Consulta paginada del visor de auditoría (`T-07-01`).
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

  /** Tablas auditadas, para poblar el filtro del visor. */
  async listEntityTables(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ entityTable: auditLogs.entityTable })
      .from(auditLogs)
      .orderBy(auditLogs.entityTable);

    return rows.map(row => row.entityTable);
  }

  private buildWhere(filters: AuditLogFilters) {
    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
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
      conditions.push(like(auditLogs.documentCode, `%${filters.documentCode}%`));
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

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private toResponseDto(log: typeof auditLogs.$inferSelect): AuditLogResponseDto {
    return {
      id: log.id,
      entityTable: log.entityTable,
      entityId: log.entityId,
      action: log.action,
      changes: log.changes,
      branchId: log.branchId,
      userId: log.userId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      documentCode: log.documentCode,
      documentStatus: log.documentStatus,
      description: log.description,
      createdAt: log.createdAt,
    };
  }
}
