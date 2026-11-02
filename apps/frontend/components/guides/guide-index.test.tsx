import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideIndexView } from './guide-index';
import { useAuthStore } from '@/stores/use-auth-store';

const NESTING_PATTERN = /cannot be a descendant|cannot contain a nested/;

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  useAuthStore.setState({
    token: null,
    user: {
      id: 'u',
      name: 'u',
      email: 'u@u.c',
      permissions: ['dashboard:view', 'finance:view', 'finance:invoices:view'],
      branches: [],
    },
    isAuthenticated: true,
    hasHydrated: true,
  });
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

function nestingErrors(): string {
  const calls = errorSpy.mock.calls as unknown[][];
  return calls
    .map(call => call.map(item => String(item)).join(' '))
    .filter(message => NESTING_PATTERN.test(message))
    .join('\n');
}

describe('GuideIndexView', () => {
  it('no anida bloques dentro de etiquetas de fraseo', () => {
    render(<GuideIndexView />);

    expect(screen.getByRole('heading', { name: /Guías de uso/ })).toBeInTheDocument();
    expect(nestingErrors()).toBe('');
  });

  it('no anida bloques en los resultados de búsqueda', async () => {
    const user = userEvent.setup();
    render(<GuideIndexView />);

    await user.type(screen.getByLabelText('Buscar en las guías'), 'factura');

    expect(screen.getByText('Facturación')).toBeInTheDocument();
    expect(nestingErrors()).toBe('');
  });
});
