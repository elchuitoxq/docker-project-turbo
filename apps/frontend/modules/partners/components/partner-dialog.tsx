'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  partnerSchema,
  type PartnerFormInput,
  type PartnerFormValues,
} from '../schemas/partner.schema';
import type { Partner } from '../types';
import { useCreatePartner, useUpdatePartner } from '../hooks/use-partners';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: Partner | null;
};

export function PartnerDialog({ open, onOpenChange, partner }: Props) {
  const t = useTranslations('common');
  const isEdit = !!partner;
  const create = useCreatePartner();
  const update = useUpdatePartner(partner?.id ?? '');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PartnerFormInput, unknown, PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      name: '',
      email: '',
      taxId: '',
      address: '',
      phone: '',
      type: 'CUSTOMER',
      taxpayerType: 'ORDINARY',
      retentionRate: 0,
      isSpecialTaxpayer: false,
      creditLimit: 0,
    },
  });

  React.useEffect(() => {
    if (partner) {
      reset({
        name: partner.name,
        email: partner.email ?? '',
        taxId: partner.taxId,
        address: partner.address ?? '',
        phone: partner.phone ?? '',
        type: partner.type,
        taxpayerType: partner.taxpayerType,
        retentionRate: Number(partner.retentionRate),
        isSpecialTaxpayer: partner.isSpecialTaxpayer,
        creditLimit: Number(partner.creditLimit),
      });
    } else {
      reset({
        name: '',
        email: '',
        taxId: '',
        address: '',
        phone: '',
        type: 'CUSTOMER',
        taxpayerType: 'ORDINARY',
        retentionRate: 0,
        isSpecialTaxpayer: false,
        creditLimit: 0,
      });
    }
  }, [partner, reset]);

  const onSubmit = handleSubmit(async data => {
    try {
      const payload = {
        ...data,
        retentionRate: String(data.retentionRate),
        creditLimit: String(data.creditLimit),
        email: data.email || null,
        address: data.address || null,
        phone: data.phone || null,
      };
      if (isEdit) {
        await update.mutateAsync(payload);
      } else {
        await create.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      /* toast handled by hook */
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar partner' : 'Nuevo partner'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Modifica los datos del cliente o proveedor.'
              : 'Crea un nuevo cliente o proveedor.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field data-invalid={!!errors.name} className="md:col-span-2">
              <FieldLabel htmlFor="name">Nombre / Razón social *</FieldLabel>
              <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && (
                <FieldDescription className="text-destructive">
                  {errors.name.message}
                </FieldDescription>
              )}
            </Field>

            <Field data-invalid={!!errors.taxId}>
              <FieldLabel htmlFor="taxId">RIF / Identificación *</FieldLabel>
              <Input
                id="taxId"
                placeholder="J-12345678-9"
                {...register('taxId')}
                aria-invalid={!!errors.taxId}
              />
              {errors.taxId && (
                <FieldDescription className="text-destructive">
                  {errors.taxId.message}
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="type">Tipo</FieldLabel>
              <Select
                value={watch('type')}
                onValueChange={v => setValue('type', v as PartnerFormValues['type'])}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Cliente</SelectItem>
                  <SelectItem value="VENDOR">Proveedor</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} />
              {errors.email && (
                <FieldDescription className="text-destructive">
                  {errors.email.message}
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
              <Input id="phone" {...register('phone')} />
            </Field>

            <Field className="md:col-span-2">
              <FieldLabel htmlFor="address">Dirección</FieldLabel>
              <Input id="address" {...register('address')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="taxpayerType">Tipo de contribuyente</FieldLabel>
              <Select
                value={watch('taxpayerType')}
                onValueChange={v =>
                  setValue('taxpayerType', v as PartnerFormValues['taxpayerType'])
                }
              >
                <SelectTrigger id="taxpayerType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORDINARY">Ordinario</SelectItem>
                  <SelectItem value="SPECIAL">Especial</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="retentionRate">% Retención</FieldLabel>
              <Input
                id="retentionRate"
                type="number"
                step="0.01"
                min={0}
                max={100}
                {...register('retentionRate', { valueAsNumber: true })}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="creditLimit">Límite de crédito</FieldLabel>
              <Input
                id="creditLimit"
                type="number"
                step="0.01"
                min={0}
                {...register('creditLimit', { valueAsNumber: true })}
              />
            </Field>

            <Field orientation="horizontal" className="items-center gap-2 space-y-0">
              <Checkbox
                id="isSpecialTaxpayer"
                checked={watch('isSpecialTaxpayer')}
                onCheckedChange={v => setValue('isSpecialTaxpayer', !!v)}
              />
              <FieldLabel htmlFor="isSpecialTaxpayer" className="cursor-pointer">
                Contribuyente especial
              </FieldLabel>
            </Field>
          </FieldGroup>

          <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isEdit ? t('save') : t('create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
