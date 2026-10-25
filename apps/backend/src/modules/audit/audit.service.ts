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
  from?: Date;
  to?: Date;
}

@Injectable()
export class AuditService {
  async findByEntity(entityTable: string, entityId: string): Promise<AuditLogResponseDto[]> {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityTable, entityTable),
          eq(auditLogs.entityId, entityId)
        )
      )
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
