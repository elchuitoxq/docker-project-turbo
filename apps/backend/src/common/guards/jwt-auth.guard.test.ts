import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const mockContext = {} as ExecutionContext;

  it('returns true when super.canActivate returns true', () => {
    const guard = new JwtAuthGuard();
    const spy = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true as any);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
    spy.mockRestore();
  });

  it('propagates UnauthorizedException from super', () => {
    const guard = new JwtAuthGuard();
    const spy = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockImplementation(() => {
        throw new UnauthorizedException('Invalid token');
      });

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    spy.mockRestore();
  });

  it('propagates any error from super', () => {
    const guard = new JwtAuthGuard();
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
