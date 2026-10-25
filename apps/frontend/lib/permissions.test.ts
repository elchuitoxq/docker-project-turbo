import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from './permissions';

describe('PERMISSIONS', () => {
  it('exposes canonical module permissions', () => {
    expect(PERMISSIONS.DASHBOARD.VIEW).toBe('dashboard:view');
    expect(PERMISSIONS.OPERATIONS.PARTNERS.VIEW).toBe('operations:partners:view');
    expect(PERMISSIONS.FINANCE.INVOICES.POST).toBe('finance:invoices:post');
    expect(PERMISSIONS.HR.PAYROLL.PROCESS).toBe('hr:payroll:process');
    expect(PERMISSIONS.SETTINGS.USERS.MANAGE).toBe('settings:users:manage');
  });

  it('uses module:[submodule:]action format', () => {
    const all = [
      PERMISSIONS.DASHBOARD.VIEW,
      PERMISSIONS.OPERATIONS.PARTNERS.CREATE,
      PERMISSIONS.INVENTORY.MOVES.APPROVE,
      PERMISSIONS.FINANCE.PAYMENTS.VOID,
    ];
    for (const code of all) {
      expect(code).toMatch(/^[a-z]+(:[a-z_]+){1,2}$/);
    }
  });
});
