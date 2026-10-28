import { apiClient } from '@/lib/api/client';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED';

/** Refleja `EmployeeResponseDto` del backend: nada de campos que la API no devuelve. */
export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  identityCard: string;
  email?: string | null;
  phone?: string | null;
  positionId?: string | null;
  departmentId?: string | null;
  branchId?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  terminationReason?: string | null;
  baseSalary: number;
  salaryCurrencyId?: string | null;
  salaryCurrencyCode?: string | null;
  payFrequency?: string | null;
  paymentMethod?: string | null;
  status?: EmployeeStatus | null;
  positionName?: string;
  departmentName?: string;
};

export type Department = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  managerId: string | null;
  managerName?: string;
  isActive: boolean;
};

export type Position = {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName?: string;
  baseSalary: string;
  level: string;
  isActive: boolean;
};

export type IncidentType =
  'ABSENCE' | 'TARDINESS' | 'OVERTIME' | 'VACATION' | 'SICK_LEAVE' | 'PERMIT' | 'BONUS';

export type Incident = {
  id: string;
  employeeId: string;
  employeeName?: string;
  type: IncidentType;
  date: string;
  days?: number;
  hours?: number;
  amount?: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
};

export type PayrollRunStatus = 'DRAFT' | 'PROCESSED' | 'PAID';

export type ConceptCategory = 'ASSIGNMENT' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION' | 'INFORMATIVE';

export type ConceptKind = 'FIXED' | 'PERCENT' | 'FORMULA' | 'BASE';

/** Desglose por concepto de un recibo (naturaleza + base + tasa efectiva + monto). */
export type PayrollLine = {
  conceptCode: string;
  conceptName: string;
  category: ConceptCategory;
  base: number;
  rate: number;
  amount: number;
};

export type PayrollItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  baseAmount: number;
  bonuses: number;
  deductions: number;
  netTotal: number;
  lines: PayrollLine[];
};

export type PayrollRun = {
  id: string;
  code: string;
  branchId: string;
  frequency: string;
  currencyId: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  status: PayrollRunStatus;
  items?: PayrollItem[];
};

export type PayrollSetting = {
  id: string;
  companyId: string;
  key: string;
  label: string;
  value: number;
  type: string;
  branchId: string | null;
  effectiveFrom: string;
  isActive: boolean;
};

export type PayrollConcept = {
  id: string;
  code: string;
  name: string;
  category: ConceptCategory;
  kind: ConceptKind;
  expression: string | null;
  affectsIntegralSalary: boolean;
  isSalarial: boolean;
  isSystem: boolean;
  branchId: string | null;
};

export type VacationSummary = {
  employeeId: string;
  years: number;
  vacationDays: number;
  bonusDays: number;
  daysTaken: number;
  daysPending: number;
  normalDaily: number;
};

export type BenefitsSummary = {
  employeeId: string;
  years: number;
  integralDaily: number;
  quartersDeposited: number;
  guaranteeAccumulated: number;
  retroactive: number;
  payable: number;
  modality: 'GUARANTEE' | 'RETROACTIVE';
};

export type Settlement = {
  id: string;
  employeeId: string;
  terminationDate: string;
  cause: string;
  years: number;
  integralSalary: number;
  normalSalary: number;
  guaranteeAccumulated: number;
  retroactive: number;
  benefitsAmount: number;
  benefitsModality: string;
  vacationDays: number;
  vacationAmount: number;
  bonusDays: number;
  bonusAmount: number;
  profitDays: number;
  profitAmount: number;
  indemnificationDays: number;
  indemnificationAmount: number;
  totalAmount: number;
  status: string;
};

export type PayrollEntryLine = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
};

/** Asiento contable que genera el run (`POST /hr/payroll/:id/post`, RN-25). */
export type PayrollEntry = {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  status: string;
  sourceType: string | null;
  sourceId: string | null;
  lines: PayrollEntryLine[];
};

export type PayrollPayment = {
  payrollRunId: string;
  runCode: string;
  runStatus: string;
  alreadyPaid: boolean;
  paymentId: string;
  paymentCode: string;
  amount: number;
  amountBase: number;
  currencyId: string;
  exchangeRate: number;
  date: string;
};

function buildQuery(filters: Record<string, string | number | boolean | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const hrApi = {
  listEmployees: (
    filters: {
      status?: string;
      departmentId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) =>
    apiClient.get<{ data: Employee[]; total: number; page: number; limit: number }>(
      `/hr/employees${buildQuery(filters)}`
    ),
  getEmployee: (id: string) => apiClient.get<Employee>(`/hr/employees/${id}`),
  createEmployee: (data: Partial<Employee>) => apiClient.post<Employee>('/hr/employees', data),
  updateEmployee: (id: string, data: Partial<Employee>) =>
    apiClient.patch<Employee>(`/hr/employees/${id}`, data),
  terminateEmployee: (id: string, data: { reason: string; date: string }) =>
    apiClient.post<Employee>(`/hr/employees/${id}/terminate`, data),

  listDepartments: () => apiClient.get<Department[]>('/hr/departments'),
  createDepartment: (data: Partial<Department>) =>
    apiClient.post<Department>('/hr/departments', data),
  updateDepartment: (id: string, data: Partial<Department>) =>
    apiClient.patch<Department>(`/hr/departments/${id}`, data),

  listPositions: (filters: { departmentId?: string; isActive?: boolean } = {}) =>
    apiClient.get<Position[]>(`/hr/positions${buildQuery(filters)}`),
  createPosition: (data: Partial<Position>) => apiClient.post<Position>('/hr/positions', data),
  updatePosition: (id: string, data: Partial<Position>) =>
    apiClient.patch<Position>(`/hr/positions/${id}`, data),

  listIncidents: (
    filters: {
      employeeId?: string;
      type?: IncidentType;
      status?: string;
      fromDate?: string;
      toDate?: string;
    } = {}
  ) => apiClient.get<Incident[]>(`/hr/incidents${buildQuery(filters)}`),
  createIncident: (data: Partial<Incident>) => apiClient.post<Incident>('/hr/incidents', data),
  approveIncident: (id: string) => apiClient.post<Incident>(`/hr/incidents/${id}/approve`, {}),
  rejectIncident: (id: string) => apiClient.post<Incident>(`/hr/incidents/${id}/reject`, {}),

  listPayrolls: (filters: { status?: string; from?: string; to?: string } = {}) =>
    apiClient.get<PayrollRun[]>(`/hr/payroll${buildQuery(filters)}`),
  getPayroll: (id: string) => apiClient.get<PayrollRun>(`/hr/payroll/${id}`),
  generatePayroll: (body: {
    branchId: string;
    frequency: string;
    currencyId: string;
    startDate: string;
    endDate: string;
  }) => apiClient.post<PayrollRun>('/hr/payroll/generate', body),
  approvePayroll: (id: string) => apiClient.post<PayrollRun>(`/hr/payroll/${id}/process`, {}),
  payPayroll: (
    id: string,
    body: {
      methodId: string;
      bankAccountId?: string;
      exchangeRate?: number;
      date?: string;
      reference?: string;
    }
  ) => apiClient.post<PayrollPayment>(`/hr/payroll/${id}/pay`, body),
  postPayroll: (id: string) => apiClient.post<PayrollEntry>(`/hr/payroll/${id}/post`, {}),
  getPayrollParameters: (id: string) =>
    apiClient.get<PayrollSetting[]>(`/hr/payroll/${id}/parameters`),

  getPayrollSettings: (asOf?: string) =>
    apiClient.get<PayrollSetting[]>(`/hr/settings${buildQuery({ asOf })}`),
  updatePayrollSetting: (body: {
    key: string;
    value: number;
    type?: string;
    label?: string;
    effectiveFrom?: string;
  }) => apiClient.patch<PayrollSetting>('/hr/settings', body),

  listConcepts: () => apiClient.get<PayrollConcept[]>('/hr/concept-types'),
  createConcept: (body: Partial<PayrollConcept>) =>
    apiClient.post<PayrollConcept>('/hr/concept-types', body),
  updateConcept: (id: string, body: Partial<PayrollConcept>) =>
    apiClient.patch<PayrollConcept>(`/hr/concept-types/${id}`, body),
  deleteConcept: (id: string) => apiClient.delete<{ deleted: true }>(`/hr/concept-types/${id}`),

  getVacationSummary: (employeeId: string, asOf?: string) =>
    apiClient.get<VacationSummary>(`/hr/employees/${employeeId}/vacations${buildQuery({ asOf })}`),
  registerVacation: (
    employeeId: string,
    body: { year: number; days: number; startDate?: string; endDate?: string; notes?: string }
  ) =>
    apiClient.post<VacationSummary & { vacationAmount: number; bonusAmount: number }>(
      `/hr/employees/${employeeId}/vacations`,
      body
    ),
  getBenefitsSummary: (employeeId: string, asOf?: string) =>
    apiClient.get<BenefitsSummary>(`/hr/employees/${employeeId}/benefits${buildQuery({ asOf })}`),
  depositBenefit: (
    employeeId: string,
    body: { year: number; quarter: number; isAnniversaryQuarter?: boolean; notes?: string }
  ) => apiClient.post<BenefitsSummary>(`/hr/employees/${employeeId}/benefits/deposit`, body),
  registerProfitSharing: (
    employeeId: string,
    body: { year: number; monthsWorked: number; paymentDate?: string; notes?: string }
  ) =>
    apiClient.post<{ employeeId: string; year: number; days: number; amount: number }>(
      `/hr/employees/${employeeId}/profit-sharing`,
      body
    ),
  getSettlement: (employeeId: string) =>
    apiClient.get<Settlement>(`/hr/employees/${employeeId}/settlement`),
  settleEmployee: (
    employeeId: string,
    body: { terminationDate: string; cause: string; notes?: string }
  ) => apiClient.post<Settlement>(`/hr/employees/${employeeId}/settle`, body),
};
