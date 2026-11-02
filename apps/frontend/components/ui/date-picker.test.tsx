import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker, parseDay, toDayValue } from '@/components/ui/date-picker';

/**
 * Control de fecha (`S-13`).
 *
 * Lo que importa: el valor viaja como `YYYY-MM-DD` (igual que `<input type="date">`, así no cambian los
 * contratos) y no se corre un día por zona horaria — el error clásico de `new Date('2026-10-27')`.
 */
describe('DatePicker', () => {
  it('muestra la fecha del valor en formato local', () => {
    render(<DatePicker value="2026-10-27" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /27\/10\/2026/ })).toBeInTheDocument();
  });

  it('muestra el placeholder cuando no hay fecha', () => {
    render(<DatePicker value="" onChange={vi.fn()} placeholder="Fecha de corte" />);

    expect(screen.getByRole('button', { name: /Fecha de corte/ })).toBeInTheDocument();
  });

  it('al elegir un día devuelve `YYYY-MM-DD`', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker value="2026-10-27" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /27\/10\/2026/ }));
    await user.click(await screen.findByRole('button', { name: /15/ }));

    expect(onChange).toHaveBeenCalledWith('2026-10-15');
  });

  it('en modo no controlado refleja la fecha en un input oculto para `FormData`', async () => {
    const user = userEvent.setup();
    render(<DatePicker name="startDate" defaultValue="2026-10-05" />);

    const hidden = document.querySelector('input[name="startDate"]') as HTMLInputElement;
    expect(hidden.value).toBe('2026-10-05');

    await user.click(screen.getByRole('button', { name: /05\/10\/2026/ }));
    await user.click(await screen.findByRole('button', { name: /12/ }));

    expect(hidden.value).toBe('2026-10-12');
  });
});

describe('parseDay / toDayValue', () => {
  it('no corre el día por zona horaria', () => {
    const date = parseDay('2026-11-26');

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(26);
    expect(date && toDayValue(date)).toBe('2026-11-26');
  });

  it('devuelve undefined con valores vacíos o inválidos', () => {
    expect(parseDay('')).toBeUndefined();
    expect(parseDay(null)).toBeUndefined();
    expect(parseDay('no-es-fecha')).toBeUndefined();
  });
});
