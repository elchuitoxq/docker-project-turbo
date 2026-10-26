import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

const createGuard = (isPublic = false) => {
  const reflector = { getAllAndOverride: vi.fn(() => isPublic) };
  return { guard: new JwtAuthGuard(reflector as any), reflector };
};

describe('JwtAuthGuard', () => {
  const mockContext = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ExecutionContext;

  it('returns true without calling super when the route is @Public()', () => {
    const { guard } = createGuard(true);
    const spy = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(false as any);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns true when super.canActivate returns true', () => {
    const { guard } = createGuard();
    const spy = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true as any);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
    spy.mockRestore();
  });

  it('propagates UnauthorizedException from super', () => {
    const { guard } = createGuard();
    const spy = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockImplementation(() => {
        throw new UnauthorizedException('Invalid token');
      });

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    spy.mockRestore();
  });

  it('propagates any error from super', () => {
    const { guard } = createGuard();
    const customError = new Error('Custom error');
    const spy = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockImplementation(() => {
        throw customError;
      });

    expect(() => guard.canActivate(mockContext)).toThrow(customError);
    spy.mockRestore();
  });
});
