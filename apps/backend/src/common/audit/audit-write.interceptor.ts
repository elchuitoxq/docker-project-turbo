import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, from, mergeMap, tap, throwError } from 'rxjs';
import { sql } from 'drizzle-orm';
import { db } from '../../database';
import { AuditService } from '../../modules/audit/audit.service';
import { AUDIT_TARGETS, type AuditTarget, actionVerb } from './audit-catalog';
import { type AuditDiff, describeAuditEvent, diffSnapshot, redactSecrets } from './audit-diff';

interface AuditedUser {
  id?: string;
  email?: string;
  name?: string;
  roles?: string[];
  branchId?: string | null;
}

interface AuditedRequest {
  method: string;
  url: string;
  body?: unknown;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: AuditedUser;
  branchId?: string | null;
}

interface ResolvedTarget extends AuditTarget {
  resource: string;
  action: string;
  entityId: string | null;
}

interface PersistInput {
  request: AuditedRequest;
  target: ResolvedTarget;
  before: Record<string, unknown> | null;
  result: unknown;
  startedAt: number;
  resultKind: 'SUCCESS' | 'ERROR';
}

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHOD_ACTIONS: Record<string, string> = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  PUT: 'UPDATE',
  DELETE: 'DELETE',
};

/**
 * Deja rastro en `audit_logs` de toda escritura sobre los recursos del catálogo.
 *
 * A diferencia de la versión anterior, el `before` se lee de la tabla antes de ejecutar el handler y
 * el `after` después: el visor muestra qué campo cambió y no sólo el cuerpo del request. También
 * audita las altas (el `id` se toma de la respuesta) y los fallos (`result = 'ERROR'`).
 *
 * Nunca interrumpe la petición: si la auditoría falla, se registra el error y se continúa.
 */
@Injectable()
export class AuditWriteInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditWriteInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    if (!MUTATION_METHODS.has(request.method)) return next.handle();

    const target = this.resolveTarget(request);
    if (!target) return next.handle();

    const startedAt = Date.now();

    return from(this.readRow(target.table, target.entityId)).pipe(
      mergeMap(before =>
        next.handle().pipe(
          tap(result => {
            void this.persist({
              request,
              target,
              before,
              result,
              startedAt,
              resultKind: 'SUCCESS',
            });
          }),
          catchError(error => {
            void this.persist({
              request,
              target,
              before,
              result: null,
              startedAt,
              resultKind: 'ERROR',
            });
            return throwError(() => error);
          })
        )
      )
    );
  }

  /** Lee la fila completa por `id`; cualquier fallo (tabla sin `id`, error de conexión) es `null`. */
  private async readRow(
    table: string,
    entityId: string | null
  ): Promise<Record<string, unknown> | null> {
    if (!entityId) return null;

    try {
      const rows = await db.execute(
        sql`select * from ${sql.identifier(table)} where "id" = ${entityId} limit 1`
      );
      const [row] = rows as unknown as Array<Record<string, unknown>>;
      return row ?? null;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer ${table} para el diff de auditoría: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  private async persist(input: PersistInput): Promise<void> {
    const { request, target, before, result, startedAt, resultKind } = input;

    try {
      const entityId = target.entityId ?? this.idFromResult(result);
      if (!entityId && !before) return;

      const after = resultKind === 'ERROR' ? null : await this.readRow(target.table, entityId);
      const rowDiff = diffSnapshot(before, after);

      // En un alta la fila recién creada trae todos los defaults; lo que el usuario hizo es el
      // cuerpo de la petición. Se usa la fila sólo para el código y el estado del documento.
      const body = this.bodySnapshot(request.body);
      const diff: AuditDiff | null =
        !before && after && body
          ? { before: {}, after: body, changedFields: Object.keys(body) }
          : rowDiff;

      // Un PATCH que no cambió nada no es un hecho auditable; un alta o un borrado sí.
      const isDelete = target.action === 'DELETE';
      if (!diff && !isDelete && before && after) return;

      const row = after ?? before;
      const documentCode = this.textField(row, 'code') ?? this.textField(row, 'documentCode');
      const documentStatus = this.textField(row, 'status');
      const actor = this.actorOf(request);
      const verb = actionVerb(target.action);

      const changes =
        diff ??
        ({
          before: null,
          after: redactSecrets(request.body),
        } as unknown);

      const description =
        resultKind === 'ERROR'
          ? `${verb} ${target.label}${documentCode ? ` ${documentCode}` : ''} y la operación falló`
          : describeAuditEvent({
              verb,
              entityLabel: target.label,
              documentCode,
              diff,
              fallback: `${verb} ${target.label}`,
            });

      await this.auditService.record({
        entityTable: target.table,
        entityId,
        action: target.action,
        actionLabel: verb,
        entityLabel: target.label,
        module: target.module,
        branchId: request.branchId ?? request.user?.branchId ?? null,
        userId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRoles: actor.roles,
        ipAddress: request.ip ?? null,
        userAgent: this.header(request, 'user-agent'),
        httpMethod: request.method,
        route: this.pathOf(request.url),
        result: resultKind,
        durationMs: Date.now() - startedAt,
        changes,
        description,
        documentCode,
        documentStatus,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la auditoría de ${target.table}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private resolveTarget(request: AuditedRequest): ResolvedTarget | null {
    const segments = this.pathOf(request.url).split('/').filter(Boolean);

    const resource = segments.find(segment => Object.hasOwn(AUDIT_TARGETS, segment));
    if (!resource) return null;

    const target = AUDIT_TARGETS[resource];
    const entityId = segments.find(segment => UUID_SEGMENT.test(segment)) ?? null;
    const lastSegment = segments.at(-1) ?? '';

    const action =
      lastSegment === resource || UUID_SEGMENT.test(lastSegment)
        ? (METHOD_ACTIONS[request.method] ?? request.method)
        : lastSegment.toUpperCase();

    return { ...target, resource, action, entityId };
  }

  private pathOf(url: string): string {
    return url.split('?')[0];
  }

  private idFromResult(result: unknown): string | null {
    if (!result || typeof result !== 'object') return null;
    const candidate = (result as { id?: unknown }).id;
    return typeof candidate === 'string' && UUID_SEGMENT.test(candidate) ? candidate : null;
  }

  private textField(row: Record<string, unknown> | null, field: string): string | null {
    const value = row?.[field];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  /** Cuerpo de la petición saneado, o `null` cuando no hay campos que contar. */
  private bodySnapshot(body: unknown): Record<string, unknown> | null {
    const sanitized = redactSecrets(body);
    if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return null;

    return Object.keys(sanitized as Record<string, unknown>).length
      ? (sanitized as Record<string, unknown>)
      : null;
  }

  private actorOf(request: AuditedRequest): {
    id: string | null;
    name: string | null;
    email: string | null;
    roles: string[] | null;
  } {
    const user = request.user;
    return {
      id: user?.id ?? null,
      name: user?.name ?? null,
      email: user?.email ?? null,
      roles: user?.roles?.length ? user.roles : null,
    };
  }

  private header(request: AuditedRequest, name: string): string | null {
    const value = request.headers?.[name];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  }
}
