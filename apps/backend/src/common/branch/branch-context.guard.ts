import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { branches, usersBranches } from '../../schema';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  BRANCH_ID_HEADER,
  CORE_BRANCH_ALL,
  SKIP_BRANCH_KEY,
  isUuid,
} from './branch-context.constants';

interface BranchRequest {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  user?: { id?: string; permissions?: string[]; branchId?: string | null };
  branchId?: string | null;
}

interface CachedAssignments {
  branchIds: Set<string>;
  expiresAt: number;
}

/**
 * Resuelve y valida la sucursal activa de cada request (reglas R1-R4 de `S-00`).
 *
 * - `x-branch-id` es la fuente de verdad; `branchId` en query/body se acepta como
 *   compatibilidad y deja un warning en el log.
 * - Sin cabecera, un usuario con una única sucursal asignada la usa por defecto;
 *   con varias, la cabecera es obligatoria (`400`).
 * - Sucursal no asignada -> `403`, salvo permiso `core:branch:all`.
 */
@Injectable()
export class BranchContextGuard implements CanActivate {
  private static readonly CACHE_TTL_MS = 30_000;

  private readonly logger = new Logger(BranchContextGuard.name);
  private readonly cache = new Map<string, CachedAssignments>();

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skipBranch = this.reflector.getAllAndOverride<boolean>(SKIP_BRANCH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipBranch) return true;

    const request = context.switchToHttp().getRequest<BranchRequest>();
    const userId = request.user?.id;
    if (!userId) throw new ForbiddenException('Authenticated user context is missing');

    const explicitBranchId = this.readExplicitBranchId(request);
    const assigned = await this.getAssignedBranchIds(userId);
    const hasGlobalAccess = (request.user?.permissions ?? []).includes(CORE_BRANCH_ALL);

    const branchId = explicitBranchId ?? this.resolveDefault(assigned);

    if (!hasGlobalAccess && !assigned.has(branchId)) {
      throw new ForbiddenException('You do not have access to this branch');
    }
    if (hasGlobalAccess && explicitBranchId && !(await this.branchExists(branchId))) {
      throw new ForbiddenException('Unknown branch');
    }

    request.branchId = branchId;
    if (request.user) request.user.branchId = branchId;
    return true;
  }

  /** Permite invalidar el cache tras cambiar las asignaciones de un usuario. */
  invalidate(userId?: string): void {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }

  private readExplicitBranchId(request: BranchRequest): string | null {
    const rawHeader = request.headers[BRANCH_ID_HEADER];
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (header) return this.parseBranchId(header, BRANCH_ID_HEADER);

    const fromQuery = request.query?.branchId;
    const fromBody = request.body?.branchId;
    const fallback =
      typeof fromQuery === 'string' ? fromQuery : typeof fromBody === 'string' ? fromBody : null;

    if (fallback) {
      this.logger.warn(
        `Branch resolved from body/query instead of the ${BRANCH_ID_HEADER} header; this fallback is deprecated`
      );
      return this.parseBranchId(fallback, 'branchId');
    }

    return null;
  }

  private parseBranchId(value: string, source: string): string {
    if (!isUuid(value)) {
      throw new BadRequestException(`${source} must be a valid UUID`);
    }
    return value;
  }

  private resolveDefault(assigned: Set<string>): string {
    if (assigned.size === 1) {
      const [onlyBranch] = assigned;
      this.logger.debug('Branch auto-resolved to the only assignment of the user');
      return onlyBranch;
    }
    if (assigned.size === 0) {
      throw new ForbiddenException('This user has no branches assigned');
    }
    throw new BadRequestException(`The ${BRANCH_ID_HEADER} header is required`);
  }

  private async branchExists(branchId: string): Promise<boolean> {
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    return Boolean(branch);
  }

  private async getAssignedBranchIds(userId: string): Promise<Set<string>> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > now) return cached.branchIds;

    const rows = await db
      .select({ branchId: usersBranches.branchId })
      .from(usersBranches)
      .where(eq(usersBranches.userId, userId));

    const branchIds = new Set(rows.map(({ branchId }) => branchId));
    this.cache.set(userId, { branchIds, expiresAt: now + BranchContextGuard.CACHE_TTL_MS });
    return branchIds;
  }
}
