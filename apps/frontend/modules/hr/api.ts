import { apiClient } from '@/lib/api/client';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED';

export type Employee = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  nationalId: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  hireDate: string;
  terminationDate?: string | null;
  status: EmployeeStatus;
  departmentId: string | null;
  departmentName?: string;
  positionId: string | null;
  positionName?: string;
  branchId: string | null;
  salary: string;
  salaryCurrencyId: string | null;
  salaryCurrencyCode?: string;
  bankAccount?: string;
  bankName?: string;
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

export type PayrollRun = {
  id: string;
  code: string;
  periodFrom: string;
  periodTo: string;
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'VOID';
  totalGross: string;
  totalNet: string;
  totalDeductions: string;
  employeesCount: number;
  calculatedAt?: string;
  approvedAt?: string;
  paidAt?: string;
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
  calculatePayroll: (periodFrom: string, periodTo: string) =>
    apiClient.post<PayrollRun>('/hr/payroll/calculate', { periodFrom, periodTo }),
  approvePayroll: (id: string) => apiClient.post<PayrollRun>(`/hr/payroll/${id}/process`, {}),
  payPayroll: (id: string) => apiClient.post<PayrollRun>(`/hr/payroll/${id}/pay`, {}),

  getSettings: () => apiClient.get<Record<string, unknown>>('/hr/settings'),
  updateSettings: (data: Record<string, unknown>) => apiClient.patch('/hr/settings', data),
};
