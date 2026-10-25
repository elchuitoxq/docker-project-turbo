import { describe, it, expect } from 'vitest';
import * as relationsModule from '../../src/schema';

const findRelation = (name: string) => {
  return (relationsModule as any)[name];
};

describe('Drizzle relations', () => {
  it('usersRelations is defined', () => {
    expect(findRelation('usersRelations')).toBeDefined();
  });

  it('invoicesRelations is defined', () => {
    expect(findRelation('invoicesRelations')).toBeDefined();
  });

  it('ordersRelations is defined', () => {
    expect(findRelation('ordersRelations')).toBeDefined();
  });

  it('employeesRelations is defined', () => {
    expect(findRelation('employeesRelations')).toBeDefined();
  });

  it('payrollRunsRelations is defined', () => {
    expect(findRelation('payrollRunsRelations')).toBeDefined();
  });

  it('paymentsRelations is defined', () => {
    expect(findRelation('paymentsRelations')).toBeDefined();
  });
});
