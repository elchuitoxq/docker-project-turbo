import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb, cleanDatabase, closeTestConnection } from '../../src/test/database';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, seedRbac } from '../../src/scripts/seed-rbac';
import { seedCoreData } from '../../src/scripts/seed-core';
import { seedTestData } from '../../src/scripts/seed-test';
import * as bcrypt from 'bcryptjs';
import {
  roles,
  users,
  usersRoles,
  usersBranches,
  rolesPermissions,
  currencies,
  companies,
  branches,
  banks,
  paymentMethods,
  partners,
  bankAccounts,
  payments,
  invoices,
  permissions,
} from '../../src/schema';

describe('Seed scripts', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeTestConnection();
  });

  describe('seedRbac idempotency', () => {
    it('produces 6 roles after 2 runs', async () => {
      await seedRbac();
      await seedRbac();
      const allRoles = await testDb.select().from(roles);
      expect(allRoles.length).toBe(6);
    });

    it('produces the permission catalog after 2 runs', async () => {
      await seedRbac();
      await seedRbac();
      const allPerms = await testDb.select().from(permissions);
      expect(allPerms.length).toBe(ALL_PERMISSIONS.length);
      expect(allPerms.length).toBe(ALL_PERMISSIONS.length);
    });

    it('preserves existing grants unless reconciliation is requested', async () => {
      await seedRbac();
      const [managerRole] = await testDb.select().from(roles).where(eq(roles.name, 'MANAGER'));
      const [extraPermission] = await testDb
        .select()
        .from(permissions)
        .where(eq(permissions.code, 'finance:invoices:create'));
      await testDb.insert(rolesPermissions).values({
        roleId: managerRole.id,
        permissionId: extraPermission.id,
      });

      await seedRbac();

      const preservedGrant = await testDb
        .select()
        .from(rolesPermissions)
        .where(
          and(
            eq(rolesPermissions.roleId, managerRole.id),
            eq(rolesPermissions.permissionId, extraPermission.id)
          )
        );
      expect(preservedGrant).toHaveLength(1);
    });
  });

  describe('seedCoreData idempotency', () => {
    it('does not duplicate core data after 2 runs', async () => {
      await seedRbac();
      await seedCoreData();
      await seedCoreData();

      expect(await testDb.select().from(currencies)).toHaveLength(2);
      expect(await testDb.select().from(branches)).toHaveLength(1);
      expect(await testDb.select().from(banks)).toHaveLength(6);
      expect(await testDb.select().from(paymentMethods)).toHaveLength(10);
      expect(await testDb.select().from(bankAccounts)).toHaveLength(2);
      expect(await testDb.select().from(users)).toHaveLength(2);
    });
  });

  describe('seedTestData idempotency', () => {
    it('does not duplicate admin user after 2 runs', async () => {
      await seedTestData();
      await testDb
        .update(partners)
        .set({ type: 'SUPPLIER' })
        .where(eq(partners.taxId, 'J-44444444-4'));
      await seedTestData();
      const adminUsers = await testDb
        .select()
        .from(users)
        .where(eq(users.email, 'test-admin@test.local'));
      expect(adminUsers.length).toBe(1);
      expect(await testDb.select().from(currencies)).toHaveLength(2);
      expect(await testDb.select().from(branches)).toHaveLength(2);
      expect(await testDb.select().from(partners).where(eq(partners.type, 'VENDOR'))).toHaveLength(
        2
      );
      expect(await testDb.select().from(invoices)).toHaveLength(5);
      expect(await testDb.select().from(payments)).toHaveLength(3);
    });

    it('creates deterministic accounts, role grants, passwords, and branch access', async () => {
      await seedTestData();

      const testAccounts = [
        { email: 'test-admin@test.local', role: 'ADMIN' },
        { email: 'test-super-admin@test.local', role: 'SUPER_ADMIN' },
        { email: 'test-manager@test.local', role: 'MANAGER' },
        { email: 'test-seller@test.local', role: 'SELLER' },
        { email: 'test-warehouse@test.local', role: 'WAREHOUSE' },
        { email: 'test-accountant@test.local', role: 'ACCOUNTANT' },
      ];

      for (const account of testAccounts) {
        const [user] = await testDb.select().from(users).where(eq(users.email, account.email));
        expect(user).toBeDefined();
        expect(await bcrypt.compare('Test1234!', user.password)).toBe(true);

        const userRoleRows = await testDb
          .select({ name: roles.name, id: roles.id })
          .from(usersRoles)
          .innerJoin(roles, eq(usersRoles.roleId, roles.id))
          .where(eq(usersRoles.userId, user.id));
        expect(userRoleRows.map(({ name }) => name)).toEqual([account.role]);

        const role = userRoleRows[0];
        const actualPermissions = await testDb
          .select({ code: permissions.code })
          .from(rolesPermissions)
          .innerJoin(permissions, eq(rolesPermissions.permissionId, permissions.id))
          .where(eq(rolesPermissions.roleId, role.id));
        expect(actualPermissions.map(({ code }) => code).sort()).toEqual(
          [...ROLE_PERMISSIONS[account.role]].sort()
        );

        const branchRows = await testDb
          .select({
            branchId: usersBranches.branchId,
            branchName: branches.name,
            taxId: companies.taxId,
            isDefault: usersBranches.isDefault,
          })
          .from(usersBranches)
          .innerJoin(branches, eq(usersBranches.branchId, branches.id))
          .innerJoin(companies, eq(branches.companyId, companies.id))
          .where(eq(usersBranches.userId, user.id));
        expect(branchRows).toHaveLength(2);
        expect(branchRows.filter(({ isDefault }) => isDefault)).toHaveLength(1);
        expect(
          branchRows
            .map(({ branchId, branchName, taxId }) => ({ branchId, branchName, taxId }))
            .sort((a, b) => a.branchId.localeCompare(b.branchId))
        ).toEqual([
          {
            branchId: '00000000-0000-4000-8000-000000000010',
            branchName: 'Sucursal Caracas',
            taxId: 'J-12345678-9',
          },
          {
            branchId: '00000000-0000-4000-8000-000000000011',
            branchName: 'Sucursal Maracaibo',
            taxId: 'J-12345678-9',
          },
        ]);
      }
    });

    it('reconciles stale role grants on repeated seed runs', async () => {
      await seedTestData();
      const [managerRole] = await testDb.select().from(roles).where(eq(roles.name, 'MANAGER'));
      const [extraPermission] = await testDb
        .select()
        .from(permissions)
        .where(eq(permissions.code, 'finance:invoices:create'));

      await testDb.insert(rolesPermissions).values({
        roleId: managerRole.id,
        permissionId: extraPermission.id,
      });

      await seedTestData();

      const staleGrant = await testDb
        .select()
        .from(rolesPermissions)
        .where(
          and(
            eq(rolesPermissions.roleId, managerRole.id),
            eq(rolesPermissions.permissionId, extraPermission.id)
          )
        );
      expect(staleGrant).toHaveLength(0);
    });
  });

  describe('unique constraints', () => {
    it('rejects duplicate partner taxId', async () => {
      await seedRbac();
      await seedCoreData();
      const [partner1] = await testDb
        .insert(partners)
        .values({
          name: 'P1',
          taxId: 'J-UNIQUE-001',
          type: 'CUSTOMER',
          taxpayerType: 'ORDINARY',
          retentionRate: '0',
          creditLimit: '0',
        })
        .returning();

      expect(partner1).toBeDefined();

      await expect(
        testDb.insert(partners).values({
          name: 'P2',
          taxId: 'J-UNIQUE-001',
          type: 'CUSTOMER',
          taxpayerType: 'ORDINARY',
          retentionRate: '0',
          creditLimit: '0',
        })
      ).rejects.toThrow();
    });
  });

  describe('audit 12 §3.4 bank balance invariant', () => {
    it('matches the net posted payments per account', async () => {
      await seedTestData();

      const accounts = await testDb.select().from(bankAccounts);
      expect(accounts.length).toBeGreaterThan(0);
      const postedPayments = await testDb.select().from(payments);
      for (const account of accounts) {
        const expectedBalance = postedPayments
          .filter(payment => payment.bankAccountId === account.id && payment.status === 'POSTED')
          .reduce((total, payment) => {
            const amountInCents = Math.round(Number(payment.amount) * 100);
            return total + (payment.type === 'INCOME' ? amountInCents : -amountInCents);
          }, 0);

        expect(Math.round(Number(account.currentBalance) * 100)).toBe(expectedBalance);
      }
    });
  });

  describe('audit 12 §3.5 fiscal invariant', () => {
    it('calculates tax at 16% for posted invoices produced by the seed', async () => {
      await seedTestData();
      const postedInvoices = await testDb
        .select()
        .from(invoices)
        .where(eq(invoices.status, 'POSTED'));

      expect(postedInvoices.length).toBeGreaterThan(0);
      for (const invoice of postedInvoices) {
        const expectedTaxInCents = Math.round(Number(invoice.totalBase) * 0.16 * 100);
        expect(Math.round(Number(invoice.totalTax) * 100)).toBe(expectedTaxInCents);
      }
    });
  });
});
