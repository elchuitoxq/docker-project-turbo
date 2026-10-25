import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { db } from '../../database';
import { branches } from '../../schema';

vi.mock('../../database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

const companyId = '550e8400-e29b-41d4-a716-446655440100';
const branch = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  companyId,
  name: 'Main Branch',
  address: 'Av. Libertador, Caracas, Venezuela',
  phone: '+58-212-555-1234',
  email: 'main@company.com',
  isActive: true,
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
};

function query(data: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(data).then(resolve, reject),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

function returning(data: unknown) {
  return {
    values: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve(data)),
    })),
  };
}

describe('BranchesService', () => {
  let service: BranchesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BranchesService();
  });

  it('maps branch responses with their parent company tax ID', async () => {
    vi.mocked(db.select).mockReturnValue(query([{ branch, taxId: 'J-12345678-9' }]) as never);

    const result = await service.findAll();

    expect(result).toEqual([
      expect.objectContaining({
        id: branch.id,
        companyId,
        name: 'Main Branch',
        taxId: 'J-12345678-9',
      }),
    ]);
  });

  it('groups accessible branches by company ID rather than tax ID', async () => {
    const secondBranch = { ...branch, id: 'branch-2', name: 'Second Branch' };
    vi.mocked(db.select).mockReturnValue(
      query([
        { company: { id: companyId, name: 'Acme', taxId: null }, branch },
        { company: { id: companyId, name: 'Acme', taxId: null }, branch: secondBranch },
      ]) as never
    );

    const result = await service.findCompanies('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(companyId);
    expect(result[0].branchCount).toBe(2);
    expect(result[0].branches.map(({ id }) => id)).toEqual([branch.id, 'branch-2']);
  });

  it('rejects creation under a missing or inactive company', async () => {
    vi.mocked(db.select).mockReturnValue(query([]) as never);

    await expect(service.create({ companyId, name: 'New branch' })).rejects.toThrow(
      BadRequestException
    );
  });

  it('creates branches with an explicit company and maps the persisted company tax ID', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(query([{ id: companyId, isActive: true }]) as never)
      .mockReturnValueOnce(query([{ branch, taxId: 'J-12345678-9' }]) as never);
    vi.mocked(db.insert).mockReturnValue(returning([branch]) as never);

    const result = await service.create({ companyId, name: 'Main Branch' });

    expect(db.insert).toHaveBeenCalledWith(branches);
    expect(result.companyId).toBe(companyId);
    expect(result.taxId).toBe('J-12345678-9');
  });

  it('throws when updating a branch that does not exist', async () => {
    vi.mocked(db.select).mockReturnValue(query([]) as never);

    await expect(service.update(branch.id, { name: 'Updated' })).rejects.toThrow(NotFoundException);
  });
});
