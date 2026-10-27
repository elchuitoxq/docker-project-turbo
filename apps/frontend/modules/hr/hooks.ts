'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  hrApi,
  type Employee,
  type Department,
  type Position,
  type Incident,
  type PayrollRun,
  type PayrollPayment,
} from './api';

export const hrKeys = {
  employees: ['hr', 'employees'] as const,
  employee: (id: string) => ['hr', 'employees', id] as const,
  departments: ['hr', 'departments'] as const,
  positions: ['hr', 'positions'] as const,
  incidents: ['hr', 'incidents'] as const,
  payrolls: ['hr', 'payroll'] as const,
  settings: ['hr', 'settings'] as const,
};

export function useEmployees(filters: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: [...hrKeys.employees, filters],
    queryFn: () => hrApi.listEmployees(filters),
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: hrKeys.employee(id ?? ''),
    queryFn: () => hrApi.getEmployee(id as string),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Employee>) => hrApi.createEmployee(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.employees }),
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Employee>) => hrApi.updateEmployee(id, data),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: hrKeys.employees });
      qc.setQueryData(hrKeys.employee(id), data);
    },
  });
}

export function useTerminateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, date }: { id: string; reason: string; date: string }) =>
      hrApi.terminateEmployee(id, { reason, date }),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.employees }),
  });
}

export function useDepartments() {
  return useQuery({ queryKey: hrKeys.departments, queryFn: () => hrApi.listDepartments() });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Department>) => hrApi.createDepartment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.departments }),
  });
}

export function usePositions(filters: { departmentId?: string; isActive?: boolean } = {}) {
  return useQuery({
    queryKey: [...hrKeys.positions, filters],
    queryFn: () => hrApi.listPositions(filters),
  });
}

export function useIncidents(filters: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: [...hrKeys.incidents, filters],
    queryFn: () => hrApi.listIncidents(filters),
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Incident>) => hrApi.createIncident(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.incidents }),
  });
}

export function useApproveIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.approveIncident(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.incidents }),
  });
}

export function useRejectIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.rejectIncident(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.incidents }),
  });
}

export function usePayrolls(filters: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: [...hrKeys.payrolls, filters],
    queryFn: () => hrApi.listPayrolls(filters),
  });
}

export function usePayroll(id: string | null) {
  return useQuery({
    queryKey: [...hrKeys.payrolls, id],
    queryFn: () => hrApi.getPayroll(id as string),
    enabled: !!id,
  });
}

export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      branchId: string;
      frequency: string;
      currencyId: string;
      startDate: string;
      endDate: string;
    }) => hrApi.generatePayroll(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.payrolls }),
  });
}

export function useApprovePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.approvePayroll(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.payrolls }),
  });
}

export function usePayPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof hrApi.payPayroll>[1] }) =>
      hrApi.payPayroll(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.payrolls }),
  });
}

export const payrollConfigKeys = {
  settings: (asOf?: string) => ['hr', 'payroll-settings', asOf ?? 'today'] as const,
  concepts: ['hr', 'payroll-concepts'] as const,
};

export function usePayrollSettings(asOf?: string) {
  return useQuery({
    queryKey: payrollConfigKeys.settings(asOf),
    queryFn: () => hrApi.getPayrollSettings(asOf),
  });
}

export function useUpdatePayrollSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof hrApi.updatePayrollSetting>[0]) =>
      hrApi.updatePayrollSetting(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr', 'payroll-settings'] }),
  });
}

export function usePayrollConcepts() {
  return useQuery({
    queryKey: payrollConfigKeys.concepts,
    queryFn: () => hrApi.listConcepts(),
  });
}

export function useCreatePayrollConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof hrApi.createConcept>[0]) => hrApi.createConcept(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollConfigKeys.concepts }),
  });
}

export function useUpdatePayrollConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof hrApi.updateConcept>[1] }) =>
      hrApi.updateConcept(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollConfigKeys.concepts }),
  });
}

export function useDeletePayrollConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hrApi.deleteConcept(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollConfigKeys.concepts }),
  });
}

export const employeeLaborKeys = {
  vacations: (employeeId: string) => ['hr', 'employee', employeeId, 'vacations'] as const,
  benefits: (employeeId: string) => ['hr', 'employee', employeeId, 'benefits'] as const,
  settlement: (employeeId: string) => ['hr', 'employee', employeeId, 'settlement'] as const,
};

export function useVacationSummary(employeeId: string | null, asOf?: string) {
  return useQuery({
    queryKey: [...employeeLaborKeys.vacations(employeeId ?? ''), asOf ?? 'today'],
    queryFn: () => hrApi.getVacationSummary(employeeId as string, asOf),
    enabled: !!employeeId,
  });
}

export function useBenefitsSummary(employeeId: string | null, asOf?: string) {
  return useQuery({
    queryKey: [...employeeLaborKeys.benefits(employeeId ?? ''), asOf ?? 'today'],
    queryFn: () => hrApi.getBenefitsSummary(employeeId as string, asOf),
    enabled: !!employeeId,
  });
}

export function useSettlement(employeeId: string | null) {
  return useQuery({
    queryKey: employeeLaborKeys.settlement(employeeId ?? ''),
    queryFn: () => hrApi.getSettlement(employeeId as string),
    enabled: !!employeeId,
    retry: false,
  });
}

export function useRegisterVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      body,
    }: {
      employeeId: string;
      body: Parameters<typeof hrApi.registerVacation>[1];
    }) => hrApi.registerVacation(employeeId, body),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: employeeLaborKeys.vacations(variables.employeeId) }),
  });
}

export function useDepositBenefit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      body,
    }: {
      employeeId: string;
      body: Parameters<typeof hrApi.depositBenefit>[1];
    }) => hrApi.depositBenefit(employeeId, body),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: employeeLaborKeys.benefits(variables.employeeId) }),
  });
}

export function useRegisterProfitSharing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      body,
    }: {
      employeeId: string;
      body: Parameters<typeof hrApi.registerProfitSharing>[1];
    }) => hrApi.registerProfitSharing(employeeId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.employees }),
  });
}

export function useSettleEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      body,
    }: {
      employeeId: string;
      body: Parameters<typeof hrApi.settleEmployee>[1];
    }) => hrApi.settleEmployee(employeeId, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: employeeLaborKeys.settlement(variables.employeeId) });
      qc.invalidateQueries({ queryKey: hrKeys.employee(variables.employeeId) });
      qc.invalidateQueries({ queryKey: hrKeys.employees });
    },
  });
}
