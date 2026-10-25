import { beforeEach, describe, expect, it } from 'vitest';
import { useCompanyStore } from './use-company-store';

const company = {
  id: 'company-1',
  taxId: 'J-1',
  name: 'A',
  address: null,
  phone: null,
  email: null,
  isActive: true,
  branchCount: 1,
  branches: [{ id: 'branch-1', name: 'Main', companyId: 'company-1', taxId: 'J-1' }],
};

describe('useCompanyStore', () => {
  beforeEach(() => {
    useCompanyStore.setState({
      currentCompanyId: null,
      legacyCompanyTaxId: null,
      availableCompanies: [],
      hasHydrated: false,
    });
  });

  it('starts empty', () => {
    const state = useCompanyStore.getState();
    expect(state.currentCompanyId).toBeNull();
    expect(state.availableCompanies).toEqual([]);
  });

  it('selects a company by its persistent ID', () => {
    useCompanyStore.getState().setCompany(company.id);
    expect(useCompanyStore.getState().currentCompanyId).toBe(company.id);
  });

  it('maps legacy persisted tax IDs to their company ID', () => {
    useCompanyStore.setState({ legacyCompanyTaxId: company.taxId });
    useCompanyStore.getState().setAvailableCompanies([company]);
    expect(useCompanyStore.getState().currentCompanyId).toBe(company.id);
    expect(useCompanyStore.getState().legacyCompanyTaxId).toBeNull();
  });

  it('stores available companies', () => {
    useCompanyStore.getState().setAvailableCompanies([company]);
    expect(useCompanyStore.getState().availableCompanies).toEqual([company]);
  });

  it('reset clears the selected company and available list', () => {
    useCompanyStore.getState().setAvailableCompanies([company]);
    useCompanyStore.getState().setCompany(company.id);
    useCompanyStore.getState().reset();
    expect(useCompanyStore.getState().currentCompanyId).toBeNull();
    expect(useCompanyStore.getState().availableCompanies).toEqual([]);
  });
});
