import { db } from '../index';
import { accountingAccounts } from '../schema';
import { uuidv7 } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Plan de cuentas base (Venezuela), jerárquico y por sucursal.
 *
 * Sin esto la contabilidad nace vacía: no hay árbol que mostrar ni cuentas contra las que postear.
 * Las cuentas de grupo (`isPostable: false`) existen sólo para agrupar; las hojas son las que
 * aceptan líneas de asiento (`T-04-01`).
 */
type AccountSeed = {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'COST' | 'ORDER';
  parentCode?: string;
  isPostable?: boolean;
};

const CHART: AccountSeed[] = [
  { code: '1', name: 'Activo', type: 'ASSET', isPostable: false },
  { code: '1.1', name: 'Activo corriente', type: 'ASSET', parentCode: '1', isPostable: false },
  {
    code: '1.1.1',
    name: 'Efectivo y equivalentes',
    type: 'ASSET',
    parentCode: '1.1',
    isPostable: false,
  },
  { code: '1.1.1.001', name: 'Caja', type: 'ASSET', parentCode: '1.1.1' },
  { code: '1.1.1.002', name: 'Banco moneda funcional', type: 'ASSET', parentCode: '1.1.1' },
  { code: '1.1.1.003', name: 'Banco moneda extranjera', type: 'ASSET', parentCode: '1.1.1' },
  {
    code: '1.1.2',
    name: 'Cuentas por cobrar',
    type: 'ASSET',
    parentCode: '1.1',
    isPostable: false,
  },
  { code: '1.1.2.001', name: 'Clientes', type: 'ASSET', parentCode: '1.1.2' },
  { code: '1.1.2.002', name: 'IVA crédito fiscal', type: 'ASSET', parentCode: '1.1.2' },
  { code: '1.1.3', name: 'Inventarios', type: 'ASSET', parentCode: '1.1', isPostable: false },
  { code: '1.1.3.001', name: 'Mercancía disponible', type: 'ASSET', parentCode: '1.1.3' },
  { code: '1.2', name: 'Activo no corriente', type: 'ASSET', parentCode: '1', isPostable: false },
  { code: '1.2.1.001', name: 'Mobiliario y equipos', type: 'ASSET', parentCode: '1.2' },

  { code: '2', name: 'Pasivo', type: 'LIABILITY', isPostable: false },
  { code: '2.1', name: 'Pasivo corriente', type: 'LIABILITY', parentCode: '2', isPostable: false },
  { code: '2.1.1.001', name: 'Proveedores por pagar', type: 'LIABILITY', parentCode: '2.1' },
  { code: '2.1.1.002', name: 'IVA débito fiscal', type: 'LIABILITY', parentCode: '2.1' },
  { code: '2.1.1.003', name: 'Retenciones por pagar', type: 'LIABILITY', parentCode: '2.1' },
  { code: '2.1.1.004', name: 'Sueldos y salarios por pagar', type: 'LIABILITY', parentCode: '2.1' },
  {
    code: '2.1.1.005',
    name: 'Aportes parafiscales por pagar',
    type: 'LIABILITY',
    parentCode: '2.1',
  },
  {
    code: '2.1.1.006',
    name: 'Prestaciones sociales por pagar',
    type: 'LIABILITY',
    parentCode: '2.1',
  },

  { code: '3', name: 'Patrimonio', type: 'EQUITY', isPostable: false },
  { code: '3.1.1.001', name: 'Capital social', type: 'EQUITY', parentCode: '3' },
  { code: '3.1.1.002', name: 'Resultados acumulados', type: 'EQUITY', parentCode: '3' },
  { code: '3.1.1.003', name: 'Resultado del ejercicio', type: 'EQUITY', parentCode: '3' },

  { code: '4', name: 'Ingresos', type: 'REVENUE', isPostable: false },
  { code: '4.1.1.001', name: 'Ingresos por ventas', type: 'REVENUE', parentCode: '4' },
  { code: '4.1.1.002', name: 'Ingresos por servicios', type: 'REVENUE', parentCode: '4' },
  { code: '4.2.1.001', name: 'Otros ingresos', type: 'REVENUE', parentCode: '4' },

  { code: '5', name: 'Costos', type: 'COST', isPostable: false },
  { code: '5.1.1.001', name: 'Costo de ventas', type: 'COST', parentCode: '5' },

  { code: '6', name: 'Gastos', type: 'EXPENSE', isPostable: false },
  { code: '6.1.1.001', name: 'Sueldos y salarios', type: 'EXPENSE', parentCode: '6' },
  { code: '6.1.1.002', name: 'Cargas sociales', type: 'EXPENSE', parentCode: '6' },
  { code: '6.1.2.001', name: 'Servicios públicos', type: 'EXPENSE', parentCode: '6' },
  { code: '6.1.3.001', name: 'Gasto por diferencia cambiaria', type: 'EXPENSE', parentCode: '6' },
  { code: '6.1.4.001', name: 'Otros gastos operativos', type: 'EXPENSE', parentCode: '6' },
];

/**
 * Idempotente: crea lo que falte y sincroniza `parentId`/`isPostable`. No toca cuentas propias de la
 * empresa (las que no están en el catálogo base).
 */
export async function seedChartOfAccounts(branchId: string): Promise<number> {
  const rows = await db.select().from(accountingAccounts);
  const byCode = new Map(rows.filter(row => row.branchId === branchId).map(row => [row.code, row]));

  let created = 0;

  for (const account of CHART) {
    const parent = account.parentCode ? byCode.get(account.parentCode) : undefined;
    const isPostable = account.isPostable ?? true;

    const current = byCode.get(account.code);
    if (current) {
      await db
        .update(accountingAccounts)
        .set({ name: account.name, type: account.type, parentId: parent?.id ?? null, isPostable })
        .where(eq(accountingAccounts.id, current.id));
      continue;
    }

    const [inserted] = await db
      .insert(accountingAccounts)
      .values({
        id: uuidv7(),
        code: account.code,
        name: account.name,
        type: account.type,
        branchId,
        parentId: parent?.id ?? null,
        isPostable,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      byCode.set(account.code, inserted);
      created += 1;
    }
  }

  return created;
}
