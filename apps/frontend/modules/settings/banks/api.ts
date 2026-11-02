import { apiClient } from '@/lib/api/client';

/**
 * Catálogo de bancos (`settings:banks:*`).
 *
 * Es el maestro que usan las cuentas bancarias de tesorería (`bank_accounts.bank_id`): sin él, la
 * pantalla de cuentas deja el banco vacío y no se puede armar el número de cuenta.
 */
export type Bank = {
  id: string;
  name: string;
  code: string;
  isActive: boolean | null;
  createdAt: string | null;
};

export type CreateBankPayload = {
  name: string;
  code: string;
  isActive?: boolean;
};

export type UpdateBankPayload = Partial<CreateBankPayload>;

export const banksApi = {
  list: () => apiClient.get<Bank[]>('/settings/banks'),
  create: (body: CreateBankPayload) => apiClient.post<Bank>('/settings/banks', body),
  update: (id: string, body: UpdateBankPayload) =>
    apiClient.patch<Bank>(`/settings/banks/${id}`, body),
  toggle: (id: string) => apiClient.post<Bank>(`/settings/banks/${id}/toggle`, {}),
};
