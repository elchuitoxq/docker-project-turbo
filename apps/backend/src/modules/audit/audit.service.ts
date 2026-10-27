import { Injectable } from '@nestjs/common';
import { db } from '../../database';
import { auditLogs } from '../../schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

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
  branchId?: string;
  from?: Date;
  to?: Date;
}

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
    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }

    if (filters.entityTable) {
      conditions.push(eq(auditLogs.entityTable, filters.entityTable));
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt));

    return logs.map(this.toResponseDto);
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
