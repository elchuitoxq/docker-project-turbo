import { z } from 'zod';

export const productSchema = z.object({
  sku: z.string().min(1, 'Requerido').max(50),
  name: z.string().min(1, 'Requerido').max(255),
  description: z.string().max(1000).optional().or(z.literal('')),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  cost: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0).default(0),
  isExempt: z.boolean().default(false),
  taxRate: z.coerce.number().min(0).max(100).default(16),
  type: z.enum(['PHYSICAL', 'SERVICE', 'DIGITAL']).default('PHYSICAL'),
  minStock: z.coerce.number().min(0).default(0),
  hasBatches: z.boolean().default(false),
});

export type ProductFormValues = z.infer<typeof productSchema>;
export type ProductFormInput = z.input<typeof productSchema>;
