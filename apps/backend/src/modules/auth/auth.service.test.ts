import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { db } from '../../database';
import * as bcrypt from 'bcryptjs';

// Mock de la DB
vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock de bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hashSync: vi.fn(),
  },
  compare: vi.fn(),
  hashSync: vi.fn(),
}));

// Mock de JwtService
const mockJwtService = {
  sign: vi.fn(() => 'jwt.token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockJwtService as any);
  });

  describe('login', () => {
    it('returns JWT for valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@test.local',
        name: 'Admin',
        password: 'hashed-password',
      };
      const userRoles = [{ roleId: 'role-1', roleName: 'ADMIN' }];
      const perms = [{ code: 'dashboard:view' }];
      const userBranches = [{ id: 'branch-1', name: 'Main', taxId: 'J-1' }];

      (db.select as any)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => [mockUser],
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => userRoles,
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => perms,
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => userBranches,
              }),
            }),
          }),
        });

      (bcrypt.compare as any) = vi.fn().mockResolvedValue(true);

      const result = await service.login({ email: 'admin@test.local', password: 'admin123' });

      expect(result).toEqual({
        accessToken: 'jwt.token',
        tokenType: 'Bearer',
        expiresIn: 604800,
        user: {
          id: 'user-1',
          email: 'admin@test.local',
          name: 'Admin',
          permissions: ['dashboard:view'],
          branches: userBranches,
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          email: 'admin@test.local',
          roles: ['ADMIN'],
          permissions: ['dashboard:view'],
        })
      );
    });

    it('throws UnauthorizedException for missing user', async () => {
      (db.select as any).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      });

      await expect(
        service.login({ email: 'nonexistent@test.local', password: 'any' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const mockUser = { id: 'u1', email: 'a@b.c', name: 'A', password: 'hashed' };
      (db.select as any).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => [mockUser],
          }),
        }),
      });
      (bcrypt.compare as any) = vi.fn().mockResolvedValue(false);

      await expect(service.login({ email: 'a@b.c', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('payload includes multiple roles and their permissions', async () => {
      const mockUser = { id: 'u1', email: 'a@b.c', name: 'A', password: 'h' };
      const userRoles = [
        { roleId: 'r1', roleName: 'ADMIN' },
        { roleId: 'r2', roleName: 'MANAGER' },
      ];
      const perms = [{ code: 'p1' }, { code: 'p2' }];
      const userBranches: { id: string; name: string; taxId: string | null }[] = [];

      (db.select as any)
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ limit: () => [mockUser] }) }),
        })
        .mockReturnValueOnce({
          from: () => ({ innerJoin: () => ({ where: () => userRoles }) }),
        })
        .mockReturnValueOnce({
          from: () => ({ innerJoin: () => ({ where: () => perms }) }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({ where: () => userBranches }),
            }),
          }),
        });

      (bcrypt.compare as any) = vi.fn().mockResolvedValue(true);

      await service.login({ email: 'a@b.c', password: 'p' });

      const payload = (mockJwtService.sign as any).mock.calls[0][0];
      expect(payload.roles).toEqual(['ADMIN', 'MANAGER']);
      expect(payload.permissions).toEqual(['p1', 'p2']);
    });

    it('payload permissions is empty when user has no roles', async () => {
      const mockUser = { id: 'u1', email: 'a@b.c', name: 'A', password: 'h' };
      (db.select as any)
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ limit: () => [mockUser] }) }),
        })
        .mockReturnValueOnce({
          from: () => ({ innerJoin: () => ({ where: () => [] }) }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({ where: () => [] }),
            }),
          }),
        });
      (bcrypt.compare as any) = vi.fn().mockResolvedValue(true);

      await service.login({ email: 'a@b.c', password: 'p' });

      const payload = (mockJwtService.sign as any).mock.calls[0][0];
      expect(payload.roles).toEqual([]);
      expect(payload.permissions).toEqual([]);
    });
  });

  describe('validateUser', () => {
    it('returns user by id', async () => {
      const mockUser = { id: 'u1', email: 'a@b.c', name: 'A' };
      (db.select as any).mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => [mockUser] }) }),
      });

      const result = await service.validateUser('u1');

      expect(result).toEqual(mockUser);
    });

    it('returns undefined for missing id', async () => {
      (db.select as any).mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => [] }) }),
      });

      const result = await service.validateUser('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('forgotPassword', () => {
    it('returns generic message for missing user', async () => {
      (db.select as any).mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => [] }) }),
      });

      const result = await service.forgotPassword('nobody@test.local');

      expect(result.message).toContain('If an account exists');
      expect(result.mockUrl).toBeUndefined();
    });

    it('returns mockUrl for existing user', async () => {
      const mockUser = { id: 'u1', email: 'a@b.c' };
      (db.select as any).mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => [mockUser] }) }),
      });

      const result = await service.forgotPassword('a@b.c');

      expect(result.message).toContain('If an account exists');
      expect(result.mockUrl).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=mock-token-/);
    });
  });

  describe('resetPassword', () => {
    it('throws for invalid token', async () => {
      await expect(service.resetPassword('invalid-token', 'newpass')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('returns success for valid token', async () => {
      const result = await service.resetPassword('mock-token-xyz', 'newpass');

      expect(result.message).toBe('Password has been reset successfully.');
    });
  });
});
