import { describe, expect, it, vi, beforeEach } from 'vitest';
import { firstValueFrom, of, throwError } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { db } from '../../database';
import type { AuditService } from '../../modules/audit/audit.service';
import { AuditWriteInterceptor } from './audit-write.interceptor';

vi.mock('../../database', () => ({ db: { execute: vi.fn() } }));

const ENTITY_ID = '8f0c1a3e-1111-4222-8333-444455556666';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

function handlerFailing(): CallHandler {
  return { handle: () => throwError(() => new Error('boom')) };
}

const request = {
  method: 'PATCH',
  url: '/v1/billing/invoices/8f0c1a3e-1111-4222-8333-444455556666',
  body: { status: 'POSTED' },
  ip: '10.0.0.8',
  headers: { 'user-agent': 'vitest' },
  user: { id: 'user-1', name: 'Ana Pérez', email: 'ana@empresa.com', roles: ['ADMIN'] },
  branchId: 'branch-1',
};

describe('AuditWriteInterceptor', () => {
  const record = vi.fn(() => Promise.resolve());
  const audit = { record } as unknown as AuditService;
  let interceptor: AuditWriteInterceptor;

  beforeEach(() => {
    vi.clearAllMocks();
    interceptor = new AuditWriteInterceptor(audit);
  });

  it('registra sólo los campos que cambiaron, con el autor y el documento', async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce([
        { id: ENTITY_ID, code: 'FAC-1', status: 'DRAFT', total: '100' },
      ] as never)
      .mockResolvedValueOnce([
        { id: ENTITY_ID, code: 'FAC-1', status: 'POSTED', total: '100' },
      ] as never);

    await firstValueFrom(
      interceptor.intercept(contextFor(request), handlerReturning({ ok: true }))
    );
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityTable: 'invoices',
        entityId: ENTITY_ID,
        action: 'UPDATE',
        module: 'billing',
        entityLabel: 'factura',
        documentCode: 'FAC-1',
        documentStatus: 'POSTED',
        actorName: 'Ana Pérez',
        actorEmail: 'ana@empresa.com',
        actorRoles: ['ADMIN'],
        httpMethod: 'PATCH',
        result: 'SUCCESS',
        changes: {
          before: { status: 'DRAFT' },
          after: { status: 'POSTED' },
          changedFields: ['status'],
        },
      })
    );
    expect(record.mock.calls[0][0].description).toContain('estado: DRAFT → POSTED');
  });

  it('audita el alta aunque la URL no lleve UUID, tomando el id de la respuesta', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([
      { id: ENTITY_ID, code: 'FAC-2', status: 'DRAFT' },
    ] as never);

    const createRequest = { ...request, method: 'POST', url: '/v1/billing/invoices' };
    await firstValueFrom(
      interceptor.intercept(contextFor(createRequest), handlerReturning({ id: ENTITY_ID }))
    );
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entityId: ENTITY_ID, documentCode: 'FAC-2' })
    );
    // En un alta se cuenta lo que el usuario envió, no los valores por defecto de la fila.
    expect(record.mock.calls[0][0].changes).toEqual({
      before: {},
      after: { status: 'POSTED' },
      changedFields: ['status'],
    });
  });

  it('no registra un PATCH que no cambió nada', async () => {
    const row = [{ id: ENTITY_ID, code: 'FAC-1', status: 'DRAFT' }] as never;
    vi.mocked(db.execute).mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await firstValueFrom(
      interceptor.intercept(contextFor(request), handlerReturning({ ok: true }))
    );
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(record).not.toHaveBeenCalled();
  });

  it('marca el intento fallido como ERROR y propaga la excepción', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([
      { id: ENTITY_ID, code: 'FAC-1', status: 'DRAFT' },
    ] as never);

    await expect(
      firstValueFrom(interceptor.intercept(contextFor(request), handlerFailing()))
    ).rejects.toThrow('boom');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'ERROR', action: 'UPDATE' })
    );
  });

  it('ignora las peticiones de lectura', async () => {
    const getRequest = { ...request, method: 'GET' };

    await firstValueFrom(interceptor.intercept(contextFor(getRequest), handlerReturning({})));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(record).not.toHaveBeenCalled();
  });
});
