import { apiClient } from '@/lib/api/client';

/**
 * Conceptos de retención de ISLR (`settings:taxes:*`).
 *
 * El partner guarda `islr_concept_id` y, al registrar un pago a proveedor, el sistema retiene el
 * porcentaje del concepto. Por eso el maestro tiene que existir y estar habilitado.
 */
export type TaxConcept = {
  id: string;
  code: string;
  name: string;
  /** Porcentaje de retención (0–100). */
  retentionPercentage: number;
  baseMin: number;
  sustraendo: number;
  /** BS (monto fijo) o UT (unidades tributarias). */
  sustraendoUnit: 'BS' | 'UT';
  isEnabled: boolean;
};

export type CreateTaxConceptPayload = {
  code: string;
  name: string;
  retentionPercentage: number;
  baseMin?: number;
  sustraendo?: number;
  sustraendoUnit?: 'BS' | 'UT';
  isEnabled?: boolean;
};

export type UpdateTaxConceptPayload = Partial<CreateTaxConceptPayload>;

export const taxConceptsApi = {
  list: () => apiClient.get<TaxConcept[]>('/settings/tax-concepts'),
  create: (body: CreateTaxConceptPayload) =>
    apiClient.post<TaxConcept>('/settings/tax-concepts', body),
  update: (id: string, body: UpdateTaxConceptPayload) =>
    apiClient.patch<TaxConcept>(`/settings/tax-concepts/${id}`, body),
  remove: (id: string) => apiClient.delete<{ message: string }>(`/settings/tax-concepts/${id}`),
};
