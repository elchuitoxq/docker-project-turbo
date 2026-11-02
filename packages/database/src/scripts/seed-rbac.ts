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
  // Operaciones de tesorería con permiso propio (S-09 §5 regla 6, S-14 D-08):
  // conciliar, caja chica y cierre diario no se derivan de "crear cuenta bancaria".
  'finance:treasury:reconcile',
  'finance:treasury:petty-cash',
  'finance:treasury:daily-close',
  'finance:payments:view',
  'finance:payments:create',
  'finance:payments:void',
  // Cuentas por pagar es una pantalla de proveedores: no se deriva de "ver facturas de venta",
  // porque el vendedor también ve facturas y no debe entrar al CxP (S-16 M-20).
  'finance:payables:view',
  'finance:retentions:view',
  'finance:credit-notes:view',
  'finance:credit-notes:manage',
  'finance:loans:view',
  'finance:loans:manage',
  'finance:reports:view',
  'finance:accounts:view',
  'finance:accounts:manage',
  'finance:entries:view',
  'finance:entries:create',
  'finance:entries:post',
  'finance:close:view',
  'finance:close:manage',

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
  // Bitácora de auditoría (T-07): leer y exportar tienen permisos propios. Antes el visor usaba
  // `settings:users:view`, así que administrar usuarios daba acceso a la bitácora y viceversa.
  'settings:audit:view',
  'settings:audit:export',
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
    // Ve el estado de cuenta del tercero: es la pantalla que explica el saldo que el gerente cobra.
    'operations:partners:statement',
    'operations:sales:view',
    'operations:sales:create',
    'operations:sales:edit',
    // CxP necesita el origen: la factura de compra (S-09, D-04).
    'operations:purchases:view',
    'operations:orders:view',
    'operations:orders:create',
    'operations:orders:edit',
    'operations:orders:approve',
    'inventory:view',
    'inventory:products:view',
    'inventory:products:create',
    'inventory:products:edit',
    // Kardex: el gerente responde por el stock que vende (S-14 M-1).
    'inventory:moves:view',
    // Aprobador natural del ajuste que registra el almacén (S-14 M-2).
    'inventory:moves:approve',
    'finance:view',
    'finance:invoices:view',
    // Emite la factura de la venta que supervisa (S-09, D-03). Publicar es el paso fiscal de esa
    // emisión: sin `:post` el MANAGER dejaba el borrador creado desde el pedido sin poder emitirlo.
    'finance:invoices:create',
    'finance:invoices:post',
    // Corrige el borrador que él mismo crea: la API sólo permite editar DRAFT (S-14 M-3).
    'finance:invoices:edit',
    'finance:treasury:view',
    'finance:treasury:create_account',
    'finance:treasury:reconcile',
    'finance:treasury:petty-cash',
    'finance:treasury:daily-close',
    'finance:payments:view',
    'finance:payments:create',
    'finance:payments:void',
    'finance:payables:view',
    'finance:credit-notes:view',
    'finance:credit-notes:manage',
    'finance:loans:view',
    'finance:loans:manage',
    // El registro fiscal de comprobantes es del contador: el gerente ve la retención en la ficha de
    // la compra que paga, pero no administra el libro (`S-14` PROHIBIDOS).
    // Reportes en moneda funcional con columna USD (S-09, D-07).
    'finance:reports:view',
    'finance:accounts:view',
    'finance:entries:view',
    'finance:close:view',
    'settings:banks:view',
    'settings:taxes:view',
    'settings:currencies:view',
    'hr:view',
    'hr:employees:view',
    // El gerente responde por lo que pasa en su sucursal: consulta la bitácora, no la exporta.
    'settings:audit:view',
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
    // Vende: necesita emitir la factura y ver el catálogo desde la pantalla de ventas.
    'finance:view',
    'finance:invoices:view',
    'finance:invoices:create',
    'inventory:view',
    'inventory:products:view',
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
    'operations:purchases:view',
    'inventory:view',
    'inventory:products:view',
    'finance:view',
    'finance:invoices:view',
    'finance:treasury:view',
    'finance:treasury:create_account',
    // Concilia extractos, administra caja chica y cierra el día (S-14 D-08).
    'finance:treasury:reconcile',
    'finance:treasury:petty-cash',
    'finance:treasury:daily-close',
    'finance:payments:view',
    'finance:payments:create',
    'finance:payments:void',
    'finance:payables:view',
    'finance:retentions:view',
    'finance:credit-notes:view',
    'finance:credit-notes:manage',
    'finance:loans:view',
    'finance:reports:view',
    'finance:accounts:view',
    'finance:accounts:manage',
    'finance:entries:view',
    'finance:entries:create',
    'finance:entries:post',
    'finance:close:view',
    'finance:close:manage',
    'settings:banks:view',
    'settings:taxes:view',
    'settings:currencies:view',
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
