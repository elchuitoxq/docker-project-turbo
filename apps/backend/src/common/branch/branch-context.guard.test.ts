import {
  BadRequestException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../database';
import { BranchContextGuard } from './branch-context.guard';
import { CORE_BRANCH_ALL, SKIP_BRANCH_KEY } from './branch-context.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

vi.mock('../../database', () => ({
  db: { select: vi.fn() },
}));

const BRANCH_A = '11111111-1111-4111-8111-111111111111';
const BRANCH_B = '22222222-2222-4222-8222-222222222222';

function query(data: unknown) {
  const builder: Record<string, unknown> = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(data).then(resolve, reject),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

interface FakeRequest {
  headers: Record<string, string | undefined>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  user: { id: string; permissions: string[]; branchId?: string | null };
  branchId?: string | null;
}

describe('BranchContextGuard', () => {
  const handler = () => undefined;
  let guard: BranchContextGuard;
  let request: FakeRequest;

  function contextFor(): never {
    return {
      getHandler: () => handler,
      getClass: () => BranchContextGuard,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
  }

  /** Asigna consecutivamente respuestas a `db.select` para cada consulta del guard. */
  function mockSelects(...responses: unknown[]): void {
    let call = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const data = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return query(data) as never;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    guard = new BranchContextGuard(new Reflector());
    request = { headers: {}, user: { id: 'user-1', permissions: [] } };
  });

  it('uses the x-branch-id header when the branch is assigned', async () => {
    mockSelects([{ branchId: BRANCH_A }]);
    request.headers['x-branch-id'] = BRANCH_A;

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
    expect(request.branchId).toBe(BRANCH_A);
    expect(request.user.branchId).toBe(BRANCH_A);
  });

  it('rejects a branch that is not assigned to the user with 403', async () => {
    mockSelects([{ branchId: BRANCH_A }]);
    request.headers['x-branch-id'] = BRANCH_B;

    await expect(guard.canActivate(contextFor())).rejects.toThrow(ForbiddenException);
  });

  it('rejects a malformed branch id with 400', async () => {
    mockSelects([{ branchId: BRANCH_A }]);
    request.headers['x-branch-id'] = 'not-a-uuid';

    await expect(guard.canActivate(contextFor())).rejects.toThrow(BadRequestException);
  });

  it('auto-resolves the branch when the user has exactly one assignment', async () => {
    mockSelects([{ branchId: BRANCH_A }]);

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
    expect(request.branchId).toBe(BRANCH_A);
  });

  it('requires the header when the user has several assignments', async () => {
    mockSelects([{ branchId: BRANCH_A }, { branchId: BRANCH_B }]);

    await expect(guard.canActivate(contextFor())).rejects.toThrow(BadRequestException);
  });

  it('rejects users without any branch assignment', async () => {
    mockSelects([]);

    await expect(guard.canActivate(contextFor())).rejects.toThrow(ForbiddenException);
  });

  it('accepts branchId from the body as a deprecated fallback', async () => {
    mockSelects([{ branchId: BRANCH_A }]);
    request.body = { branchId: BRANCH_A };

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  it('lets core:branch:all operate on a branch that exists but is not assigned', async () => {
    mockSelects([{ branchId: BRANCH_A }], [{ id: BRANCH_B }]);
    request.user.permissions = [CORE_BRANCH_ALL];
    request.headers['x-branch-id'] = BRANCH_B;

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
    expect(request.branchId).toBe(BRANCH_B);
  });

  it('rejects core:branch:all when the branch does not exist', async () => {
    mockSelects([{ branchId: BRANCH_A }], []);
    request.user.permissions = [CORE_BRANCH_ALL];
    request.headers['x-branch-id'] = BRANCH_B;

    await expect(guard.canActivate(contextFor())).rejects.toThrow(ForbiddenException);
  });

  it('skips endpoints marked with @SkipBranch or @Public', async () => {
    Reflect.defineMetadata(SKIP_BRANCH_KEY, true, handler);
    await expect(guard.canActivate(contextFor())).resolves.toBe(true);

    Reflect.defineMetadata(SKIP_BRANCH_KEY, false, handler);
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    await expect(guard.canActivate(contextFor())).resolves.toBe(true);

    Reflect.deleteMetadata(IS_PUBLIC_KEY, handler);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('caches the assignments per user within the TTL', async () => {
    mockSelects([{ branchId: BRANCH_A }]);
    request.headers['x-branch-id'] = BRANCH_A;

    await guard.canActivate(contextFor());
    await guard.canActivate(contextFor());

    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('rejects requests without an authenticated user context', async () => {
    request.user = undefined as never;

    await expect(guard.canActivate(contextFor())).rejects.toThrow(ForbiddenException);
    expect(UnauthorizedException).toBeDefined();
  });
});
