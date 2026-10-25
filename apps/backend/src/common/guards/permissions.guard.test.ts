import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../database';
import { PermissionsGuard } from './permissions.guard';
import { REQUIRED_PERMISSIONS } from '../decorators/require-permissions.decorator';

vi.mock('../../database', () => ({
  db: { selectDistinct: vi.fn() },
}));

function query(data: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(data).then(resolve, reject),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

describe('PermissionsGuard', () => {
  const handler = () => undefined;
  let guard: PermissionsGuard;
  let context: {
    getHandler: () => () => undefined;
    getClass: () => typeof PermissionsGuard;
    switchToHttp: () => { getRequest: () => { user: { id: string } } };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.defineMetadata(REQUIRED_PERMISSIONS, ['settings:users:view'], handler);
    guard = new PermissionsGuard(new Reflector());
    context = {
      getHandler: () => handler,
      getClass: () => PermissionsGuard,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1' } }) }),
    };
  });

  it('queries live grants and allows a matching permission', async () => {
    vi.mocked(db.selectDistinct).mockReturnValue(query([{ code: 'settings:users:view' }]) as never);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it('rejects requests when the user lacks a required permission', async () => {
    vi.mocked(db.selectDistinct).mockReturnValue(query([]) as never);

    await expect(guard.canActivate(context as never)).rejects.toThrow(ForbiddenException);
  });
});
