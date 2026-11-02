import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { permissions, rolesPermissions, usersRoles } from '../../schema';
import { REQUIRED_PERMISSIONS } from '../decorators/require-permissions.decorator';
import { AuditService } from '../../modules/audit/audit.service';

interface CachedGrants {
  codes: Set<string>;
  expiresAt: number;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  /**
   * Cache corta por usuario: evita una consulta de permisos en cada request.
   * Es un TTL, no un cache invalidado por evento, así que un cambio de rol
   * puede tardar hasta `CACHE_TTL_MS` en reflejarse.
   */
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly cache = new Map<string, CachedGrants>();

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService = new AuditService()
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { id?: string; name?: string; email?: string; roles?: string[] };
      method?: string;
      url?: string;
    }>();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException('Authenticated user context is missing');

    const granted = await this.getGrantedPermissions(userId);
    if (!required.every(permission => granted.has(permission))) {
      this.recordDenial(request, required);
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }

  /** Un `403` es parte del rastro: quién intentó qué y con qué permiso faltante. */
  private recordDenial(
    request: {
      user?: { id?: string; name?: string; email?: string; roles?: string[] };
      method?: string;
      url?: string;
    },
    required: string[]
  ): void {
    const route = (request.url ?? '').split('?')[0];

    void this.audit
      .record({
        entityTable: 'permissions',
        action: 'DENIED',
        actionLabel: 'Intentó una acción sin permiso',
        entityLabel: 'acción',
        module: 'auth',
        result: 'DENIED',
        userId: request.user?.id ?? null,
        actorName: request.user?.name ?? null,
        actorEmail: request.user?.email ?? null,
        actorRoles: request.user?.roles?.length ? request.user.roles : null,
        httpMethod: request.method ?? null,
        route,
        description: `Intentó ${request.method ?? ''} ${route} sin el permiso ${required.join(', ')}`,
      })
      .catch(() => undefined);
  }

  /** Permite invalidar el cache tras cambiar roles/permisos de un usuario. */
  invalidate(userId?: string): void {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }

  private async getGrantedPermissions(userId: string): Promise<Set<string>> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > now) return cached.codes;

    const grants = await db
      .selectDistinct({ code: permissions.code })
      .from(usersRoles)
      .innerJoin(rolesPermissions, eq(usersRoles.roleId, rolesPermissions.roleId))
      .innerJoin(permissions, eq(rolesPermissions.permissionId, permissions.id))
      .where(eq(usersRoles.userId, userId));

    const codes = new Set(grants.map(({ code }) => code));
    this.cache.set(userId, { codes, expiresAt: now + PermissionsGuard.CACHE_TTL_MS });
    return codes;
  }
}
