import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideModuleView } from './guide-module-view';
import { INVENTORY_GUIDE } from '@/lib/guides/modules/inventory';
import { useAuthStore } from '@/stores/use-auth-store';

function setPermissions(permissions: string[]) {
  useAuthStore.setState({
    token: null,
    user: { id: 'u', name: 'u', email: 'u@u.c', permissions, branches: [] },
    isAuthenticated: true,
    hasHydrated: true,
  });
}

describe('GuideModuleView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setPermissions(['inventory:view', 'inventory:products:view']);
  });

  it('muestra el módulo y bloquea los submódulos sin permiso', () => {
    render(<GuideModuleView module={INVENTORY_GUIDE} />);

    expect(screen.getByRole('heading', { name: /Inventario/ })).toBeInTheDocument();
    // Almacenes y Movimientos quedan fuera del alcance del rol.
    expect(screen.getAllByText(/No puedes abrir esta pantalla/)).toHaveLength(2);
    expect(screen.getAllByText('Almacenes').length).toBeGreaterThan(0);
  });

  it('habilita un submódulo al activar su permiso en el simulador', async () => {
    const user = userEvent.setup();
    render(<GuideModuleView module={INVENTORY_GUIDE} />);

    await user.click(screen.getByRole('checkbox', { name: 'inventory:moves:view' }));

    expect(screen.getAllByText(/No puedes abrir esta pantalla/)).toHaveLength(1);
  });

  it('marca un submódulo como revisado y actualiza el progreso', async () => {
    const user = userEvent.setup();
    render(<GuideModuleView module={INVENTORY_GUIDE} />);

    await user.click(
      screen.getByRole('checkbox', { name: 'Marcar Stock por almacén como revisado' })
    );

    expect(screen.getByText('1 de 4 revisados')).toBeInTheDocument();
  });

  it('filtra los submódulos por el término de búsqueda', async () => {
    const user = userEvent.setup();
    render(<GuideModuleView module={INVENTORY_GUIDE} />);

    await user.type(screen.getByLabelText('Buscar dentro de la guía'), 'almacenes');

    const index = screen.getByRole('navigation', { name: /Índice de Inventario/ });
    expect(within(index).getByText('Almacenes')).toBeInTheDocument();
    expect(within(index).queryByText('Movimientos')).not.toBeInTheDocument();
    expect(within(index).queryByText('Productos')).not.toBeInTheDocument();
  });

  it('explica cuando la búsqueda no tiene resultados', async () => {
    const user = userEvent.setup();
    render(<GuideModuleView module={INVENTORY_GUIDE} />);

    await user.type(screen.getByLabelText('Buscar dentro de la guía'), 'conciliación');

    expect(screen.getByText(/No hay procesos que coincidan/)).toBeInTheDocument();
  });
});
