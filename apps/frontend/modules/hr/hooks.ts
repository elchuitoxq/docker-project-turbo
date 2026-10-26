'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  hrApi,
  type Employee,
  type Department,
  type Position,
  type Incident,
  type PayrollRun,
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

export function useCalculatePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => hrApi.calculatePayroll(from, to),
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
    mutationFn: (id: string) => hrApi.payPayroll(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: hrKeys.payrolls }),
  });
}
