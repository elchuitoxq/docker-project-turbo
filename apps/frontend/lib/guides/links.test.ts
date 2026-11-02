import { describe, expect, it } from 'vitest';
import { guideTargetForPath } from './links';

describe('guideTargetForPath', () => {
  it('resuelve la pantalla exacta de un submódulo', () => {
    const target = guideTargetForPath('/dashboard/finance/invoices');
    expect(target?.module.id).toBe('finance');
    expect(target?.submodule?.id).toBe('invoices');
    expect(target?.href).toBe('/dashboard/guides/finance#invoices');
  });

  it('resuelve fichas de detalle por prefijo', () => {
    const target = guideTargetForPath(
      '/dashboard/inventory/products/0192abc4-1234-4abc-9def-0123456789ab'
    );
    expect(target?.submodule?.id).toBe('products');
    expect(target?.href).toBe('/dashboard/guides/inventory#products');
  });

  it('prefiere la ruta más específica', () => {
    expect(guideTargetForPath('/dashboard/finance/treasury/accounts')?.submodule?.id).toBe(
      'treasury-accounts'
    );
    expect(guideTargetForPath('/dashboard/finance/accounting/entries')?.submodule?.id).toBe(
      'accounting'
    );
    expect(guideTargetForPath('/dashboard/hr/payroll')?.submodule?.id).toBe('payroll');
    expect(guideTargetForPath('/dashboard/hr/payroll/abc')?.submodule?.id).toBe('payroll');
  });

  it('cae al módulo cuando la pantalla no está documentada', () => {
    const target = guideTargetForPath('/dashboard/bi');
    expect(target).toBeNull();

    const moduleOnly = guideTargetForPath('/dashboard/settings');
    expect(moduleOnly?.module.id).toBe('settings');
    expect(moduleOnly?.submodule).toBeUndefined();
    expect(moduleOnly?.href).toBe('/dashboard/guides/settings');
  });

  it('ignora query, hash y barra final', () => {
    const target = guideTargetForPath('/dashboard/operations/orders/?page=2#top');
    expect(target?.submodule?.id).toBe('orders');
  });

  it('no resuelve rutas fuera del dashboard de módulos', () => {
    expect(guideTargetForPath('/login')).toBeNull();
    expect(guideTargetForPath('/dashboard')).toBeNull();
  });
});
