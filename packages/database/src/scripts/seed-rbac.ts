import { db } from '../index';
import { roles, permissions, rolesPermissions } from '../schema';
import { uuidv7 } from '../schema';
import { inArray, sql } from 'drizzle-orm';

export const ALL_PERMISSIONS = [
  'dashboard:view',

  // Ámbito transversal (S-00): consolidado entre sucursales y escritura de maestros compartidos.
  'core:branch:all',
  'core:catalog:manage',

  'operations:view',
  'operations:partners:view',
  'operations:partners:create',
  'operations:partners:edit',
  'operations:partners:delete',
  'operations:partners:statement',
  'operations:sales:view',
  'operations:sales:create',
  'operations:sales:edit',
  'operations:purchases:view',
  'operations:purchases:create',
  'operations:purchases:edit',
  'operations:orders:view',
  'operations:orders:create',
  'operations:orders:edit',
  'operations:orders:approve',

  'inventory:view',
  'inventory:products:view',
  'inventory:products:create',
  'inventory:products:edit',
  'inventory:products:delete',
  'inventory:warehouses:view',
  'inventory:warehouses:create',
  'inventory:warehouses:edit',
  'inventory:moves:view',
  'inventory:moves:create',
  'inventory:moves:approve',

  'finance:view',
  'finance:invoices:view',
  'finance:invoices:create',
  'finance:invoices:edit',
  'finance:invoices:post',
  'finance:invoices:void',
  'finance:treasury:view',
  'finance:treasury:create_account',
  'finance:payments:view',
  'finance:payments:create',
  'finance:payments:void',
  'finance:retentions:view',
  'finance:reports:view',

  'hr:view',
  'hr:employees:view',
  'hr:employees:create',
  'hr:employees:edit',
  'hr:employees:delete',
  'hr:payroll:view',
  'hr:payroll:process',
  'hr:incidents:view',
  'hr:incidents:create',
  'hr:incidents:approve',
  'hr:departments:manage',
  'hr:positions:manage',
  'hr:settings:view',
  'hr:settings:manage',
  'hr:concepts:view',
  'hr:concepts:manage',

  'settings:view',
  'settings:users:view',
  'settings:users:create',
  'settings:users:edit',
  'settings:users:manage',
  'settings:roles:view',
  'settings:roles:manage',
  'settings:companies:view',
  'settings:companies:manage',
  'settings:branches:view',
  'settings:branches:manage',
  'settings:banks:view',
  'settings:banks:manage',
  'settings:currencies:view',
  'settings:currencies:manage',
  'settings:taxes:view',
  'settings:taxes:manage',
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  // ADMIN administra todo, pero el modo consolidado entre sucursales queda sólo en SUPER_ADMIN.
  ADMIN: ALL_PERMISSIONS.filter(code => code !== 'core:branch:all'),
  MANAGER: [
    'dashboard:view',
    'settings:companies:view',
    'settings:branches:view',
    'operations:view',
    'operations:partners:view',
    'operations:partners:create',
    'operations:partners:edit',
    'operations:sales:view',
    'operations:sales:create',
    'operations:sales:edit',
    'operations:orders:view',
    'operations:orders:create',
    'operations:orders:edit',
    'operations:orders:approve',
    'inventory:view',
    'inventory:products:view',
    'inventory:products:create',
    'inventory:products:edit',
    'finance:view',
    'finance:invoices:view',
    'finance:treasury:view',
    'finance:payments:view',
    'hr:view',
    'hr:employees:view',
  ],
  SELLER: [
    'dashboard:view',
    'settings:companies:view',
    'settings:branches:view',
    'operations:view',
    'operations:partners:view',
    'operations:sales:view',
    'operations:sales:create',
    'operations:orders:view',
    'operations:orders:create',
  ],
  WAREHOUSE: [
    'dashboard:view',
    'settings:companies:view',
    'settings:branches:view',
    'inventory:view',
    'inventory:products:view',
    'inventory:warehouses:view',
    'inventory:moves:view',
    'inventory:moves:create',
    'inventory:moves:approve',
  ],
  ACCOUNTANT: [
    'dashboard:view',
    'settings:companies:view',
    'settings:branches:view',
    'operations:view',
    'operations:partners:view',
    'inventory:view',
    'finance:view',
    'finance:invoices:view',
    'finance:treasury:view',
    'finance:payments:view',
    'finance:retentions:view',
    'finance:reports:view',
  ],
};

const MODULE_MAP: Record<string, string> = {
  dashboard: 'dashboard',
  operations: 'operations',
  inventory: 'inventory',
  finance: 'finance',
  hr: 'hr',
  settings: 'settings',
};

function getModule(code: string): string {
  const prefix = code.split(':')[0];
  return MODULE_MAP[prefix] || 'other';
}

export async function seedRbac(options: { reconcileRolePermissions?: boolean } = {}) {
  console.log('Seeding RBAC...');

  await db.transaction(async tx => {
    const insertedPermissions = await tx
      .insert(permissions)
      .values(
        ALL_PERMISSIONS.map(code => ({
          id: uuidv7(),
          code,
          description: `Permission for ${code}`,
          module: getModule(code),
        }))
      )
      .onConflictDoUpdate({
        target: permissions.code,
        set: {
          description: sql`excluded.description`,
          module: sql`excluded.module`,
        },
      })
      .returning({ id: permissions.id, code: permissions.code });
    console.log(`Inserted ${insertedPermissions.length} permissions`);

    const permissionMap = new Map(insertedPermissions.map(({ code, id }) => [code, id]));
    const roleEntries = Object.entries(ROLE_PERMISSIONS);
    const insertedRoles = await tx
      .insert(roles)
      .values(
        roleEntries.map(([name]) => ({
          id: uuidv7(),
          name,
          description: `Default ${name} role`,
          isSystem: true,
        }))
      )
      .onConflictDoUpdate({
        target: roles.name,
        set: { description: sql`excluded.description`, isSystem: true },
      })
      .returning({ id: roles.id, name: roles.name });
    const roleMap = new Map(insertedRoles.map(({ name, id }) => [name, id]));

    const grants = roleEntries.flatMap(([roleName, rolePerms]) => {
      const roleId = roleMap.get(roleName);
      if (!roleId) {
        throw new Error(`Role ${roleName} was not inserted`);
      }

      return rolePerms.map(code => {
        const permissionId = permissionMap.get(code);
        if (!permissionId) {
          throw new Error(`Permission ${code} was not inserted`);
        }
        return { roleId, permissionId };
      });
    });

    if (options.reconcileRolePermissions) {
      await tx.delete(rolesPermissions).where(
        inArray(
          rolesPermissions.roleId,
          insertedRoles.map(({ id }) => id)
        )
      );
      await tx.insert(rolesPermissions).values(grants);
    } else {
      await tx.insert(rolesPermissions).values(grants).onConflictDoNothing();
    }

    console.log(`Synchronized ${insertedRoles.length} roles and ${grants.length} grants`);
  });

  console.log('RBAC seeding completed!');
}
