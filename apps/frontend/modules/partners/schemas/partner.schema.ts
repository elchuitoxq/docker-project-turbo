import { z } from 'zod';

export const partnerSchema = z.object({
  name: z.string().min(1, 'Requerido').max(255),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  taxId: z.string().min(1, 'Requerido').max(20),
  address: z.string().max(500).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  type: z.enum(['CUSTOMER', 'VENDOR']),
  taxpayerType: z.enum(['ORDINARY', 'SPECIAL']).default('ORDINARY'),
  retentionRate: z.coerce.number().min(0).max(100).default(0),
  isSpecialTaxpayer: z.boolean().default(false),
  creditLimit: z.coerce.number().min(0).default(0),
});

export type PartnerFormValues = z.infer<typeof partnerSchema>;
export type PartnerFormInput = z.input<typeof partnerSchema>;
