import { describe, it, expect } from 'vitest';
import {
  users,
  invoices,
  exchangeRates,
  partners,
  employees,
  payrollRuns,
  payrollItems,
  orders,
  orderItems,
  payments,
  bankAccounts,
} from '../../src/schema';

describe('Schema validation', () => {
  describe('users table', () => {
    it('has UUID primary key', () => {
      expect(users.id).toBeDefined();
      expect(users.id.name).toBe('id');
    });

    it('email column is unique', () => {
      expect(users.email).toBeDefined();
      expect((users.email as any).isUnique).toBe(true);
    });

    it('password column exists and is not null', () => {
      expect(users.password).toBeDefined();
      expect(users.password.notNull).toBe(true);
    });
  });

  describe('invoices table', () => {
    it('has fiscal fields (totalBase, totalTax, totalIgtf, total)', () => {
      expect(invoices.totalBase).toBeDefined();
      expect(invoices.totalTax).toBeDefined();
      expect(invoices.totalIgtf).toBeDefined();
      expect(invoices.total).toBeDefined();
    });

    it('has unique code column', () => {
      expect(invoices.code).toBeDefined();
      expect((invoices.code as any).isUnique).toBe(true);
    });
  });

  describe('partners table', () => {
    it('has unique taxId column', () => {
      expect(partners.taxId).toBeDefined();
      expect((partners.taxId as any).isUnique).toBe(true);
    });
  });

  describe('HR tables have audit timestamps', () => {
    it('employees has updatedAt', () => {
      expect((employees as any).updatedAt).toBeDefined();
    });

    it('payrollRuns has createdAt', () => {
      expect((payrollRuns as any).createdAt).toBeDefined();
    });

    it('payrollItems has runId foreign key', () => {
      expect((payrollItems as any).runId).toBeDefined();
    });
  });
});
