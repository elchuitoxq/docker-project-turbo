'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePartners } from '../hooks/use-partners';
import type { Partner, PartnerType } from '../types';

type Props = {
  value: string | null;
  onChange: (partnerId: string) => void;
  filterType?: PartnerType;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function PartnerCombobox({ value, onChange, filterType, placeholder = 'Seleccionar partner…', disabled, className }: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const { data, isLoading } = usePartners({
    ...(filterType ? { type: filterType } : {}),
    ...(search ? { search } : {}),
    limit: 50,
  });
  const partners: Partner[] = data?.data ?? [];
  const selected = partners.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          {selected ? (
            <span className="flex flex-col items-start gap-0.5 truncate">
              <span className="truncate">{selected.name}</span>
              <span className="text-xs text-muted-foreground">{selected.taxId}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Buscar por nombre o RIF…" />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Cargando…' : 'Sin resultados'}</CommandEmpty>
            <CommandGroup>
              {partners.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check className={cn('size-4', value === p.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.taxId}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
