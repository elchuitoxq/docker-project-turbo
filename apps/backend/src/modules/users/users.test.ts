import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { db } from '../../database';
import { users, usersBranches, usersRoles } from '../../schema';
import * as bcrypt from 'bcryptjs';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../../database', () => ({ db: mockDb }));
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}));

const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashedPassword123',
  refreshToken: null,
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
  updatedAt: new Date('2026-06-01T12:00:00.000Z'),
};
const roleId = '660e8400-e29b-41d4-a716-446655440001';
const branchId = '770e8400-e29b-41d4-a716-446655440002';

function query(data: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(data).then(resolve, reject),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

describe('UsersService', () => {
  let service: UsersService;
  let transaction: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let insertedBranchAssignments: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue('hashedPassword123' as never);
    insertedBranchAssignments = undefined;
    transaction = {
      select: vi.fn(() => query([])),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: unknown) => {
          if (table === usersBranches) insertedBranchAssignments = values;
          return table === users
            ? { returning: vi.fn().mockResolvedValue([mockUser]) }
            : Promise.resolve(undefined);
        }),
      })),
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
    };
    mockDb.transaction.mockImplementation((callback: (tx: typeof transaction) => unknown) =>
      callback(transaction)
    );
    service = new UsersService();
  });

  it('returns a not-found error for an unknown user', async () => {
    mockDb.select.mockReturnValueOnce(query([]));
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('rejects duplicate email addresses', async () => {
    mockDb.select.mockReturnValueOnce(query([mockUser]));
    await expect(
      service.create({ name: 'New', email: mockUser.email, password: 'password123' })
    ).rejects.toThrow(ConflictException);
  });

  it('creates users with a hashed password in a transaction', async () => {
    mockDb.select
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([mockUser]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]));

    const result = await service.create({
      name: mockUser.name,
      email: mockUser.email,
      password: 'password123',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(result.email).toBe(mockUser.email);
  });

  it('assigns several branches with exactly the requested default', async () => {
    transaction.select.mockReturnValueOnce(query([{ id: branchId }]));
    mockDb.select
      .mockReturnValueOnce(query([{ id: mockUser.id }]))
      .mockReturnValueOnce(query([mockUser]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]));

    await service.assignBranches(mockUser.id, [branchId], branchId);

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(transaction.delete).toHaveBeenCalledWith(usersBranches);
    expect(insertedBranchAssignments).toEqual([{ userId: mockUser.id, branchId, isDefault: true }]);
  });

  it('rejects a default branch that is not among the assigned branches', async () => {
    mockDb.select.mockReturnValueOnce(query([{ id: mockUser.id }]));

    await expect(
      service.assignBranches(mockUser.id, [branchId], '880e8400-e29b-41d4-a716-446655440003')
    ).rejects.toThrow(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('validates role IDs before replacing user role assignments', async () => {
    transaction.select.mockReturnValueOnce(query([{ id: roleId }]));
    mockDb.select
      .mockReturnValueOnce(query([{ id: mockUser.id }]))
      .mockReturnValueOnce(query([mockUser]))
      .mockReturnValueOnce(query([{ name: 'ADMIN' }]))
      .mockReturnValueOnce(query([]));

    await service.assignRoles(mockUser.id, [roleId]);

    expect(transaction.delete).toHaveBeenCalledWith(usersRoles);
    expect(transaction.insert).toHaveBeenCalledWith(usersRoles);
  });
});
