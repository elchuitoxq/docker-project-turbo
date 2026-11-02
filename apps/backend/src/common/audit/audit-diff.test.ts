import { describe, expect, it } from 'vitest';
import { describeAuditEvent, diffSnapshot, redactSecrets, summarizeDiff } from './audit-diff';

describe('diffSnapshot', () => {
  it('sólo devuelve los campos que cambiaron', () => {
    const diff = diffSnapshot(
      { id: 'a', total: '100.00', status: 'DRAFT', name: 'Factura' },
      { id: 'a', total: '120.00', status: 'DRAFT', name: 'Factura' }
    );

    expect(diff?.changedFields).toEqual(['total']);
    expect(diff?.before).toEqual({ total: '100.00' });
    expect(diff?.after).toEqual({ total: '120.00' });
  });

  it('trata el mismo número como string y como número como igual', () => {
    expect(diffSnapshot({ total: '100' }, { total: 100 })).toBeNull();
  });

  it('ignora los campos técnicos', () => {
    const before = { updatedAt: new Date('2026-01-01T00:00:00Z'), total: 1 };
    const after = { updatedAt: new Date('2026-01-02T00:00:00Z'), total: 1 };

    expect(diffSnapshot(before, after)).toBeNull();
  });

  it('en un alta todos los campos son nuevos', () => {
    const diff = diffSnapshot(null, { code: 'FAC-1', total: 100 });

    expect(diff?.before).toEqual({ code: null, total: null });
    expect(diff?.after).toEqual({ code: 'FAC-1', total: 100 });
  });

  it('en un borrado conserva el estado previo', () => {
    const diff = diffSnapshot({ code: 'FAC-1' }, null);

    expect(diff?.changedFields).toEqual(['code']);
    expect(diff?.after).toEqual({ code: null });
  });

  it('devuelve null cuando no hay nada con qué comparar', () => {
    expect(diffSnapshot(null, null)).toBeNull();
  });
});

describe('summarizeDiff', () => {
  it('arma "campo: antes → después" con etiquetas en español', () => {
    const diff = diffSnapshot({ status: 'DRAFT' }, { status: 'POSTED' });

    expect(summarizeDiff(diff)).toBe('estado: DRAFT → POSTED');
  });

  it('corta la lista de campos para no inflar la fila', () => {
    const diff = diffSnapshot({ a: 1, b: 2, c: 3 }, { a: 9, b: 9, c: 9 });

    expect(summarizeDiff(diff, 2).split(' · ')).toHaveLength(2);
  });
});

describe('describeAuditEvent', () => {
  it('compone verbo, entidad y documento', () => {
    const diff = diffSnapshot({ status: 'DRAFT' }, { status: 'POSTED' });

    expect(
      describeAuditEvent({
        verb: 'Publicó',
        entityLabel: 'factura',
        documentCode: 'FAC-000123',
        diff,
      })
    ).toBe('Publicó la factura FAC-000123 · estado: DRAFT → POSTED');
  });

  it('usa el artículo correcto para entidades masculinas', () => {
    expect(describeAuditEvent({ verb: 'Creó', entityLabel: 'pago' })).toBe('Creó el pago');
  });

  it('cae al texto de respaldo cuando no hay entidad', () => {
    expect(describeAuditEvent({ verb: 'Exportó', fallback: 'Exportó la bitácora' })).toBe(
      'Exportó la bitácora'
    );
  });
});

describe('redactSecrets', () => {
  it('oculta contraseñas y tokens sin tocar el resto', () => {
    expect(
      redactSecrets({ email: 'ana@empresa.com', password: 'secreto', nested: { token: 'abc' } })
    ).toEqual({
      email: 'ana@empresa.com',
      password: '[redacted]',
      nested: { token: '[redacted]' },
    });
  });
});
