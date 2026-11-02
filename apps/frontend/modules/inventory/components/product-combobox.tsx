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
import { useProducts } from '../hooks/use-products';
import type { Product } from '../types';

type Props = {
  value: string | null;
  /** Se entrega el producto completo: el formulario necesita su precio y su tasa de IVA. */
  onChange: (product: Product) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
};

/**
 * Buscador de productos para las líneas de pedidos y facturas.
 *
 * Mismo patrón que `PartnerCombobox`: la búsqueda va al backend (`search`) en vez de filtrar una lista
 * ya cargada, porque el catálogo puede tener cientos de SKU y el formulario necesita encontrar uno
 * concreto sin paginar.
 */
export function ProductCombobox({
  value,
  onChange,
  placeholder = 'Seleccionar producto…',
  disabled,
  className,
  id,
  'aria-invalid': ariaInvalid,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const { data, isLoading } = useProducts({ search: search || undefined, limit: 50 });
  const products: Product[] = data?.data ?? [];
  const selected = products.find(product => product.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          {selected ? (
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="truncate">{selected.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{selected.sku}</span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar por SKU o nombre…"
          />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Cargando…' : 'Sin resultados'}</CommandEmpty>
            <CommandGroup>
              {products.map(product => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => {
                    onChange(product);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn('size-4', value === product.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{product.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
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
