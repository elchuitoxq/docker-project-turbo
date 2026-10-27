import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { db } from '../../database';
import * as bcrypt from 'bcryptjs';

// Mock de la DB
vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  },
}));

// Mock de bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(() => Promise.resolve('hashed-password')),
    hashSync: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(() => Promise.resolve('hashed-password')),
  hashSync: vi.fn(),
}));

// Mock de JwtService
const mockJwtService = {
  sign: vi.fn(() => 'jwt.token'),
};

const mockConfigService = {
  get: vi.fn((key: string) => (key === 'JWT_EXPIRES_IN' ? '7d' : undefined)),
};

const mockNotifier = {
  send: vi.fn(() => Promise.resolve('http://localhost:3000/reset-password?token=abc123')),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockJwtService as any, mockConfigService as any, mockNotifier as any);
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
      const userBranches = [{ id: 'branch-1', name: 'Main', taxId: 'J-1', isDefault: true }];

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
          branches: [{ id: 'branch-1', name: 'Main', taxId: 'J-1' }],
          defaultBranchId: 'branch-1',
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
    it('returns generic message and creates no token for unknown user', async () => {
      (db.select as any).mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => [] }) }),
      });

      const result = await service.forgotPassword('nobody@test.local');

      expect(result.message).toContain('If an account exists');
      expect(result.mockUrl).toBeUndefined();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('crea un token hasheado y devuelve el enlace solo en desarrollo', async () => {
      const mockUser = { id: 'u1', email: 'a@b.c' };
      (db.select as any).mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => [mockUser] }) }),
      });

      const result = await service.forgotPassword('a@b.c');

      expect(result.message).toContain('If an account exists');
      expect(result.mockUrl).toBe('http://localhost:3000/reset-password?token=abc123');
      expect(db.delete).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
      expect(mockNotifier.send).toHaveBeenCalledWith(
        'a@b.c',
        expect.stringMatching(/^[a-f0-9]{64}$/)
      );
      // El token crudo nunca se persiste.
      const insertedValues = (db.insert as any).mock.results[0].value.values.mock.calls[0][0];
      expect(insertedValues.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(insertedValues.tokenHash).not.toBe('abc123');
    });
  });

  describe('resetPassword', () => {
    it('throws for invalid or expired token', async () => {
      (db.select as any).mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => [] }) }),
      });

      await expect(service.resetPassword('invalid-token', 'newpass123')).rejects.toThrow(
        UnauthorizedException
      );
      expect(db.update).not.toHaveBeenCalled();
    });

    it('updates the password and marks the token as used', async () => {
      (db.select as any).mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => [{ id: 't1', userId: 'u1' }] }) }),
      });

      const result = await service.resetPassword('valid-token', 'newpass123');

      expect(result.message).toBe('Password has been reset successfully.');
      expect(db.update).toHaveBeenCalledTimes(2);
    });
  });
});
