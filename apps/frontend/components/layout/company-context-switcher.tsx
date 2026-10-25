'use client';

import * as React from 'react';
import { Building2, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Combobox } from '@/components/ui/combobox';
import { useCompanyStore, type Company } from '@/stores/use-company-store';
import { useBranchStore, type Branch } from '@/stores/use-branch-store';
import { useCompanies, useBranches } from '@/modules/branches/hooks';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export function CompanyContextSwitcher({ className }: { className?: string }) {
  const isMobile = useIsMobile();
  const t = useTranslations('company');
  const queryClient = useQueryClient();
  const { hasAllPermissions } = usePermission();
  const { data: companies = [] } = useCompanies();
  const { data: branches = [] } = useBranches();

  const currentCompanyId = useCompanyStore(s => s.currentCompanyId);
  const setCompany = useCompanyStore(s => s.setCompany);
  const currentBranchId = useBranchStore(s => s.currentBranchId);
  const setBranch = useBranchStore(s => s.setBranch);

  const availableBranches = React.useMemo(
    () => branches.filter(branch => branch.companyId === currentCompanyId),
    [branches, currentCompanyId]
  );

  const handleCompanyChange = React.useCallback(
    (companyId: string) => {
      setCompany(companyId);
      const firstBranch = branches.find(branch => branch.companyId === companyId);
      setBranch(firstBranch?.id ?? null);
      queryClient.invalidateQueries();
    },
    [branches, queryClient, setBranch, setCompany]
  );

  if (
    !hasAllPermissions([PERMISSIONS.SETTINGS.COMPANIES.VIEW, PERMISSIONS.SETTINGS.BRANCHES.VIEW])
  ) {
    return null;
  }

  if (isMobile) {
    return (
      <div className={cn('flex w-full min-w-0 flex-col gap-2 px-1', className)}>
        <CompanyCombobox
          companies={companies}
          value={currentCompanyId}
          onChange={handleCompanyChange}
          label={t('select')}
        />
        <BranchCombobox
          branches={availableBranches}
          value={currentBranchId}
          onChange={setBranch}
          label={t('branch')}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 group-data-[collapsible=icon]:hidden',
        className
      )}
    >
      <CompanyCombobox
        companies={companies}
        value={currentCompanyId}
        onChange={handleCompanyChange}
        icon={Building2}
        disabled={companies.length <= 1}
        className="w-full min-w-0"
      />
      <BranchCombobox
        branches={availableBranches}
        value={currentBranchId}
        onChange={setBranch}
        icon={MapPin}
        disabled={availableBranches.length <= 1}
        className="w-full min-w-0"
      />
    </div>
  );
}

type CompanyComboboxProps = {
  companies: Company[];
  value: string | null;
  onChange: (companyId: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  disabled?: boolean;
  className?: string;
};

function CompanyCombobox({
  companies,
  value,
  onChange,
  icon,
  label,
  disabled,
  className,
}: CompanyComboboxProps) {
  return (
    <Combobox
      icon={icon}
      placeholder={label ?? 'Empresa'}
      value={value}
      options={companies.map(c => ({
        value: c.id,
        label: c.name,
        sublabel: `${c.taxId ? `RIF: ${c.taxId} · ` : ''}${c.branchCount} sucursal${c.branchCount === 1 ? '' : 'es'}`,
      }))}
      onChange={onChange}
      disabled={disabled}
      className={cn('w-full min-w-0', className)}
    />
  );
}

type BranchComboboxProps = {
  branches: Branch[];
  value: string | null;
  onChange: (id: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  disabled?: boolean;
  className?: string;
};

function BranchCombobox({
  branches,
  value,
  onChange,
  icon,
  label,
  disabled,
  className,
}: BranchComboboxProps) {
  return (
    <Combobox
      icon={icon}
      placeholder={label ?? 'Sucursal'}
      value={value}
      options={branches.map(b => ({ value: b.id, label: b.name }))}
      onChange={onChange}
      disabled={disabled}
      className={cn('w-full min-w-0', className)}
    />
  );
}
