import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../database';
import { PermissionsGuard } from './permissions.guard';
import type { AuditService } from '../../modules/audit/audit.service';
import { REQUIRED_PERMISSIONS } from '../decorators/require-permissions.decorator';
import { ROLE_PERMISSIONS } from '../../../../../packages/database/src/scripts/seed-rbac';

type RoleName = keyof typeof ROLE_PERMISSIONS;

const roles = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'SELLER',
  'WAREHOUSE',
  'ACCOUNTANT',
] as const satisfies readonly RoleName[];

function isAllowed(allowed: readonly RoleName[], role: RoleName): boolean {
  return allowed.includes(role);
}

const roleWorkflows = [
  {
    name: 'crear pedidos',
    required: ['operations:orders:create'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'],
  },
  {
    name: 'aprobar pedidos',
    required: ['operations:orders:approve'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    name: 'emitir facturas de venta',
    required: ['operations:sales:create', 'finance:invoices:create'],
    // MANAGER emite la factura de la venta que supervisa (S-09, decisión D-03).
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'],
  },
  {
    name: 'ver facturas de compra',
    required: ['operations:purchases:view'],
    // CxP necesita el origen de la deuda (S-09, decisión D-04).
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'anular pagos de tesorería',
    required: ['finance:payments:void'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'ver estado de cuenta de terceros',
    required: ['operations:partners:statement'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    name: 'ver monedas y tasas',
    required: ['settings:currencies:view'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'ver reportes de gestión',
    required: ['finance:reports:view'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'crear clientes y proveedores',
    required: ['operations:partners:create'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    name: 'registrar movimientos de almacén',
    required: ['inventory:moves:create'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'WAREHOUSE'],
  },
  {
    name: 'aprobar movimientos de almacén',
    required: ['inventory:moves:approve'],
    // El gerente aprueba el ajuste que registra el almacén (S-14, D-09).
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'WAREHOUSE'],
  },
  {
    name: 'ver el kardex de movimientos',
    required: ['inventory:moves:view'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'WAREHOUSE'],
  },
  {
    name: 'corregir borradores de factura',
    required: ['finance:invoices:edit'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    name: 'conciliar extractos bancarios',
    required: ['finance:treasury:reconcile'],
    // Conciliar no se deriva de crear cuentas (S-14, D-08).
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'operar la caja chica',
    required: ['finance:treasury:petty-cash'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'cerrar el día de caja',
    required: ['finance:treasury:daily-close'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'procesar nómina',
    required: ['hr:payroll:process'],
    allowed: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'crear pagos',
    required: ['finance:payments:create'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    name: 'crear y contabilizar asientos',
    required: ['finance:entries:create', 'finance:entries:post'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  },
  {
    name: 'gestionar cierres contables',
    required: ['finance:close:manage'],
    allowed: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
  },
  {
    name: 'administrar usuarios',
    required: ['settings:users:manage'],
    allowed: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'operar en modo consolidado entre sucursales',
    required: ['core:branch:all'],
    allowed: ['SUPER_ADMIN'],
  },
] as const satisfies readonly {
  name: string;
  required: readonly string[];
  allowed: readonly RoleName[];
}[];

vi.mock('../../database', () => ({
  db: { selectDistinct: vi.fn() },
}));

vi.mock('../../../../../packages/database/src/index', () => ({ db: {} }));

function query(data: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(data).then(resolve, reject),
    [Symbol.toStringTag]: 'Promise',
  };
  return builder;
}

describe('PermissionsGuard', () => {
  const handler = () => undefined;
  // El guard escribe el `403` en la bitácora; aquí sólo se comprueba que no rompa la decisión.
  const silentAudit = { record: vi.fn(() => Promise.resolve()) } as unknown as AuditService;
  let guard: PermissionsGuard;
  let context: {
    getHandler: () => () => undefined;
    getClass: () => typeof PermissionsGuard;
    switchToHttp: () => { getRequest: () => { user: { id: string } } };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.defineMetadata(REQUIRED_PERMISSIONS, ['settings:users:view'], handler);
    guard = new PermissionsGuard(new Reflector(), silentAudit);
    context = {
      getHandler: () => handler,
      getClass: () => PermissionsGuard,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1' } }) }),
    };
  });

  it('queries live grants and allows a matching permission', async () => {
    vi.mocked(db.selectDistinct).mockReturnValue(query([{ code: 'settings:users:view' }]) as never);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it('rejects requests when the user lacks a required permission', async () => {
    vi.mocked(db.selectDistinct).mockReturnValue(query([]) as never);

    await expect(guard.canActivate(context as never)).rejects.toThrow(ForbiddenException);
  });

  it('reuses the cached grants within the TTL', async () => {
    vi.mocked(db.selectDistinct).mockReturnValue(query([{ code: 'settings:users:view' }]) as never);

    await guard.canActivate(context as never);
    await guard.canActivate(context as never);

    expect(db.selectDistinct).toHaveBeenCalledTimes(1);
  });

  it('queries again after invalidate()', async () => {
    vi.mocked(db.selectDistinct).mockReturnValue(query([{ code: 'settings:users:view' }]) as never);

    await guard.canActivate(context as never);
    guard.invalidate('user-1');
    await guard.canActivate(context as never);

    expect(db.selectDistinct).toHaveBeenCalledTimes(2);
  });

  describe.each(roleWorkflows)('$name', workflow => {
    it.each(roles)('enforces access for %s', async role => {
      vi.mocked(db.selectDistinct).mockReturnValue(
        query(ROLE_PERMISSIONS[role].map(code => ({ code }))) as never
      );

      const handler = () => undefined;
      Reflect.defineMetadata(REQUIRED_PERMISSIONS, [...workflow.required], handler);
      const roleContext = {
        getHandler: () => handler,
        getClass: () => PermissionsGuard,
        switchToHttp: () => ({ getRequest: () => ({ user: { id: role } }) }),
      };
      const roleGuard = new PermissionsGuard(new Reflector(), silentAudit);
      const permissionCheck = roleGuard.canActivate(roleContext as never);

      if (isAllowed(workflow.allowed, role)) {
        await expect(permissionCheck).resolves.toBe(true);
      } else {
        await expect(permissionCheck).rejects.toThrow(ForbiddenException);
      }
    });
  });
});
