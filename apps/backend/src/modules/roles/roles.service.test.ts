import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesService } from './roles.service';
import { db } from '../../database';

vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

const systemRole = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'ADMIN',
  description: 'System role',
  isSystem: true,
};

function query(data: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(data).then(resolve, reject),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RolesService();
  });

  it('rejects edits to system roles', async () => {
    vi.mocked(db.select).mockReturnValue(query([systemRole]) as never);

    await expect(service.update(systemRole.id, { name: 'CUSTOM_ADMIN' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects deletion of system roles', async () => {
    vi.mocked(db.select).mockReturnValue(query([systemRole]) as never);

    await expect(service.remove(systemRole.id)).rejects.toThrow(BadRequestException);
  });

  it('keeps assigned custom roles instead of deleting them', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(query([{ ...systemRole, name: 'CUSTOM_ROLE', isSystem: false }]) as never)
      .mockReturnValueOnce(query([{ userId: 'user-1' }]) as never);

    await expect(service.remove(systemRole.id)).rejects.toThrow(ConflictException);
    expect(db.delete).not.toHaveBeenCalled();
  });
});
