import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';

interface AuditedRequest {
  method: string;
  url: string;
  body?: unknown;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  user?: { id?: string };
  branchId?: string | null;
}

/** Recursos cuya escritura deja rastro en `audit_logs` (dinero y stock, `S-00` §5). */
const AUDITED_RESOURCES: Record<string, string> = {
  invoices: 'invoices',
  payments: 'payments',
  moves: 'inventory_moves',
  warehouses: 'warehouses',
  'credit-notes': 'credit_notes',
  payroll: 'payroll_runs',
  loans: 'loans',
  entries: 'accounting_entries',
  retentions: 'tax_retentions',
  partners: 'partners',
  products: 'products',
};

const SENSITIVE_FIELDS = new Set(['password', 'token', 'accessToken', 'secret', 'refreshToken']);
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registra en `audit_logs` toda escritura sobre recursos de dinero o stock.
 * Nunca interrumpe la petición: si la auditoría falla, se registra el error y se continúa.
 */
@Injectable()
export class AuditWriteInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditWriteInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) return next.handle();

    const target = this.resolveTarget(request);
    if (!target) return next.handle();

    return next.handle().pipe(
      tap(() => {
        void this.auditService
          .record({
            entityTable: target.entityTable,
            entityId: target.entityId,
            action: target.action,
            branchId: request.branchId ?? null,
            userId: request.user?.id ?? null,
            ipAddress: request.ip ?? null,
            userAgent: this.header(request, 'user-agent'),
            changes: this.sanitize(request.body),
            description: `${request.method} ${request.url}`,
          })
          .catch(error =>
            this.logger.error(
              `No se pudo registrar la auditoría de ${target.entityTable}: ${
                error instanceof Error ? error.message : String(error)
              }`
            )
          );
      })
    );
  }

  private resolveTarget(request: AuditedRequest): {
    entityTable: string;
    entityId: string;
    action: string;
  } | null {
    const [path] = request.url.split('?');
    const segments = path.split('/').filter(Boolean);

    const resource = segments.find(segment => Object.hasOwn(AUDITED_RESOURCES, segment));
    if (!resource) return null;

    const entityId = segments.find(segment => UUID_SEGMENT.test(segment));
    if (!entityId) return null;

    const lastSegment = segments.at(-1) ?? '';
    const methodActions: Record<string, string> = {
      POST: 'CREATE',
      PATCH: 'UPDATE',
      PUT: 'UPDATE',
      DELETE: 'DELETE',
    };
    const action =
      lastSegment === resource || UUID_SEGMENT.test(lastSegment)
        ? (methodActions[request.method] ?? request.method)
        : lastSegment.toUpperCase();

    return { entityTable: AUDITED_RESOURCES[resource], entityId, action };
  }

  private sanitize(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body ?? null;
    if (Array.isArray(body)) return body.map(item => this.sanitize(item));

    return Object.fromEntries(
      Object.entries(body as Record<string, unknown>).map(([key, value]) => [
        key,
        SENSITIVE_FIELDS.has(key) ? '[redacted]' : this.sanitize(value),
      ])
    );
  }

  private header(request: AuditedRequest, name: string): string | null {
    const value = request.headers?.[name];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  }
}
