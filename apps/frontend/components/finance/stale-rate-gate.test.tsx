import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StaleRateGate } from './stale-rate-gate';
import type { ExchangeRate } from '@/lib/rates';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  // Fecha local, no UTC: `toISOString()` a las 21:00 en Venezuela ya es "mañana".
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const fresh: ExchangeRate = {
  id: '1',
  rate: 40,
  date: daysAgo(0),
  source: 'BCV',
  currencyCode: 'USD',
};

const stale: ExchangeRate = { ...fresh, id: '2', date: daysAgo(5) };

describe('StaleRateGate', () => {
  it('no muestra nada si la tasa es del día', () => {
    render(
      <StaleRateGate
        rate={fresh}
        currencyCode="USD"
        confirmed={false}
        onConfirmedChange={() => {}}
        documentLabel="el pago"
      />
    );

    expect(screen.queryByTestId('stale-rate-gate')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="alert"]')).toBeNull();
  });

  it('avisa cuando la tasa tiene más de un día y dice cuántos', () => {
    render(
      <StaleRateGate
        rate={stale}
        currencyCode="USD"
        confirmed={false}
        onConfirmedChange={() => {}}
        documentLabel="el pago"
      />
    );

    const gate = screen.getByTestId('stale-rate-gate');
    expect(gate).toBeInTheDocument();
    expect(gate.textContent).toMatch(/Tasa desactualizada/);
    expect(gate.textContent).toMatch(/hace 5 días/);
  });

  it('avisa cuando no hay tasa de la moneda', () => {
    render(
      <StaleRateGate
        rate={undefined}
        currencyCode="EUR"
        confirmed={false}
        onConfirmedChange={() => {}}
        documentLabel="el pago"
      />
    );

    expect(screen.getByText(/No hay tasa vigente para EUR/)).toBeInTheDocument();
  });

  it('informa al confirmar la casilla', () => {
    const onConfirmedChange = vi.fn();

    render(
      <StaleRateGate
        rate={stale}
        currencyCode="USD"
        confirmed={false}
        onConfirmedChange={onConfirmedChange}
        documentLabel="el pago"
      />
    );

    fireEvent.click(screen.getByLabelText('Confirmar tasa vencida'));

    expect(onConfirmedChange).toHaveBeenCalledWith(true);
  });
});
