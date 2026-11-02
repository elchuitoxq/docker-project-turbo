'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  Plus,
  Search,
  LayoutGrid,
  List,
  Package,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermission } from '@/hooks/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useProductCategories,
} from '../hooks/use-products';
import {
  productSchema,
  type ProductFormInput,
  type ProductFormValues,
} from '../schemas/product.schema';
import { formatMoney } from '@/lib/utils';
import { useCurrencies, useCurrencyIndex } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ListCard,
  ListEmptyRow,
  ListFilters,
  ListRowActions,
  ListSkeletonRows,
  ListTd,
  ListTh,
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/list/list-table';
import type { Product, ProductType } from '../types';

const TYPE_LABEL: Record<ProductType, string> = {
  PHYSICAL: 'Físico',
  SERVICE: 'Servicio',
  DIGITAL: 'Digital',
};

const TYPE_VARIANT: Record<ProductType, 'default' | 'secondary' | 'outline'> = {
  PHYSICAL: 'default',
  SERVICE: 'secondary',
  DIGITAL: 'outline',
};

export function ProductsView() {
  const t = useTranslations('common');
  const isMobile = useIsMobile();
  const { hasPermission } = usePermission();
  const { codeOf } = useCurrencyIndex();
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<ProductType | 'ALL'>('ALL');
  const [viewMode, setViewMode] = React.useState<'table' | 'cards'>('table');
  const [page, setPage] = React.useState(1);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);

  const view = isMobile ? 'cards' : viewMode;

  const filters = React.useMemo(
    () => ({
      page,
      limit: 20,
      ...(search && { search }),
      ...(type !== 'ALL' && { type }),
    }),
    [page, search, type]
  );

  const { data, isLoading } = useProducts(filters);
  const categoriesQuery = useProductCategories();
  const create = useCreateProduct();
  const update = useUpdateProduct(editing?.id ?? '');
  const del = useDeleteProduct();

  const products = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const categoryName = (id: string | null) =>
    (id && categoriesQuery.data?.find(category => category.id === id)?.name) || '—';

  function handleEdit(p: Product) {
    setEditing(p);
    setDialogOpen(true);
  }
  function handleNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function handleDelete(p: Product) {
    if (window.confirm(`¿Eliminar ${p.name}?`)) {
      del.mutate(p.id, {
        onSuccess: () => toast.success('Producto eliminado'),
        onError: () => toast.error('Error al eliminar'),
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            {total} producto{total === 1 ? '' : 's'} registrado{total === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={v => v && setViewMode(v as 'table' | 'cards')}
              size="sm"
            >
              <ToggleGroupItem value="table" aria-label="Tabla">
                <List />
              </ToggleGroupItem>
              <ToggleGroupItem value="cards" aria-label="Cards">
                <LayoutGrid />
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {hasPermission(PERMISSIONS.INVENTORY.PRODUCTS.CREATE) && (
            <Button onClick={handleNew}>
              <Plus /> Nuevo
            </Button>
          )}
        </div>
      </div>

      <ListFilters>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por SKU o nombre…"
            className="pl-8"
          />
        </div>
        <Select value={type} onValueChange={v => setType(v as ProductType | 'ALL')}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            <SelectItem value="PHYSICAL">Físicos</SelectItem>
            <SelectItem value="SERVICE">Servicios</SelectItem>
            <SelectItem value="DIGITAL">Digitales</SelectItem>
          </SelectContent>
        </Select>
      </ListFilters>

      <ListCard
        title="Catálogo"
        description={
          isLoading
            ? 'Cargando…'
            : `${products.length} producto${products.length === 1 ? '' : 's'} en esta página`
        }
      >
        {view === 'cards' ? (
          isLoading ? (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No se encontraron productos.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              {products.map(p => (
                <ProductCard key={p.id} product={p} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </div>
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <ListTh>SKU</ListTh>
                <ListTh>Nombre</ListTh>
                <ListTh>Tipo</ListTh>
                <ListTh hide="md">Categoría</ListTh>
                <ListTh align="right">Costo</ListTh>
                <ListTh align="right">Precio</ListTh>
                <ListTh align="right" hide="lg">
                  Stock mín.
                </ListTh>
                <ListTh className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <ListSkeletonRows cols={8} />
              ) : products.length === 0 ? (
                <ListEmptyRow cols={8} message="No se encontraron productos." />
              ) : (
                products.map(p => (
                  <TableRow key={p.id}>
                    <ListTd mono>{p.sku}</ListTd>
                    <ListTd className="font-medium">
                      <Link href={`/dashboard/inventory/products`} className="hover:underline">
                        {p.name}
                      </Link>
                    </ListTd>
                    <ListTd>
                      <Badge variant={TYPE_VARIANT[p.type]}>{TYPE_LABEL[p.type]}</Badge>
                    </ListTd>
                    <ListTd hide="md" muted>
                      {categoryName(p.categoryId)}
                    </ListTd>
                    <ListTd numeric>{formatMoney(Number(p.cost), codeOf(p.currencyId))}</ListTd>
                    <ListTd numeric className="font-semibold">
                      {formatMoney(Number(p.price), codeOf(p.currencyId))}
                    </ListTd>
                    <ListTd numeric muted hide="lg">
                      {p.minStock}
                    </ListTd>
                    <ListTd className="w-12">
                      <ListRowActions label={`Acciones de ${p.name}`}>
                        {hasPermission(PERMISSIONS.INVENTORY.PRODUCTS.EDIT) && (
                          <DropdownMenuItem onClick={() => handleEdit(p)}>
                            <Pencil /> Editar
                          </DropdownMenuItem>
                        )}
                        {hasPermission(PERMISSIONS.INVENTORY.PRODUCTS.DELETE) && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(p)}
                            className="text-destructive"
                          >
                            <Trash2 /> Eliminar
                          </DropdownMenuItem>
                        )}
                      </ListRowActions>
                    </ListTd>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </ListCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        onSubmit={async values => {
          const payload = {
            ...values,
            categoryId: values.categoryId || null,
            currencyId: values.currencyId || null,
            description: values.description || null,
          };
          try {
            if (editing) {
              await update.mutateAsync(payload);
              toast.success('Producto actualizado');
            } else {
              await create.mutateAsync(payload);
              toast.success('Producto creado');
            }
            setDialogOpen(false);
          } catch {
            // El mensaje del backend lo muestra `useCreateProduct`/`useUpdateProduct`.
          }
        }}
        submitting={create.isPending || update.isPending}
      />
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const { hasPermission } = usePermission();
  const { codeOf } = useCurrencyIndex();
  const canEdit = hasPermission(PERMISSIONS.INVENTORY.PRODUCTS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.INVENTORY.PRODUCTS.DELETE);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate font-medium">{product.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
            </div>
          </div>
          <Badge variant={TYPE_VARIANT[product.type]}>{TYPE_LABEL[product.type]}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Costo</p>
            <p className="tabular-nums">
              {formatMoney(Number(product.cost), codeOf(product.currencyId))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Precio</p>
            <p className="font-semibold tabular-nums">
              {formatMoney(Number(product.price), codeOf(product.currencyId))}
            </p>
          </div>
        </div>
        {(canEdit || canDelete) && (
          <div className="flex gap-2 pt-2">
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onEdit(product)}
              >
                <Pencil /> Editar
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => onDelete(product)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSubmit: (values: ProductFormValues) => void | Promise<void>;
  submitting: boolean;
};

function ProductDialog({ open, onOpenChange, product, onSubmit, submitting }: ProductDialogProps) {
  const t = useTranslations('common');
  const isEdit = !!product;
  const { data: categories = [] } = useProductCategories();
  const { data: currencies = [] } = useCurrencies();
  const { codeOf } = useCurrencyIndex();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      categoryId: '',
      currencyId: '',
      cost: 0,
      price: 0,
      isExempt: false,
      taxRate: 16,
      type: 'PHYSICAL',
      minStock: 0,
      hasBatches: false,
    },
  });

  React.useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        description: product.description ?? '',
        categoryId: product.categoryId ?? '',
        currencyId: product.currencyId ?? '',
        cost: Number(product.cost),
        price: Number(product.price),
        isExempt: product.isExempt,
        taxRate: Number(product.taxRate),
        type: product.type,
        minStock: Number(product.minStock),
        hasBatches: product.hasBatches,
      });
    } else {
      reset({
        sku: '',
        name: '',
        description: '',
        categoryId: '',
        currencyId: '',
        cost: 0,
        price: 0,
        isExempt: false,
        taxRate: 16,
        type: 'PHYSICAL',
        minStock: 0,
        hasBatches: false,
      });
    }
  }, [product, reset]);

  const typeValue = useWatch({ control, name: 'type' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const currencyValue = useWatch({ control, name: 'currencyId' });
  const isExempt = useWatch({ control, name: 'isExempt' });
  const hasBatches = useWatch({ control, name: 'hasBatches' });
  const priceCode = codeOf(currencyValue || null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar producto' : 'Nuevo producto'}</SheetTitle>
          <SheetDescription>Datos del producto, precios e inventario</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field data-invalid={!!errors.sku}>
              <FieldLabel htmlFor="sku">SKU *</FieldLabel>
              <Input id="sku" {...register('sku')} aria-invalid={!!errors.sku} />
              {errors.sku && (
                <FieldDescription className="text-destructive">
                  {errors.sku.message}
                </FieldDescription>
              )}
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Nombre *</FieldLabel>
              <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && (
                <FieldDescription className="text-destructive">
                  {errors.name.message}
                </FieldDescription>
              )}
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="description">Descripción</FieldLabel>
              <Input id="description" {...register('description')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="type">Tipo</FieldLabel>
              <Select
                value={typeValue}
                onValueChange={v => setValue('type', v as ProductFormValues['type'])}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHYSICAL">Físico</SelectItem>
                  <SelectItem value="SERVICE">Servicio</SelectItem>
                  <SelectItem value="DIGITAL">Digital</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="categoryId">Categoría</FieldLabel>
              <Select value={categoryId ?? ''} onValueChange={v => setValue('categoryId', v)}>
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="currencyId">Moneda *</FieldLabel>
              <Select value={currencyValue || ''} onValueChange={v => setValue('currencyId', v)}>
                <SelectTrigger id="currencyId">
                  <SelectValue placeholder="Moneda funcional" />
                </SelectTrigger>
                <SelectContent>
                  {(currencies ?? []).map(currency => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.code} · {currency.name}
                      {currency.isBase ? ' (funcional)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                El costo y el precio se registran en esta moneda; las facturas y pedidos los
                convierten a la suya.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="cost">Costo ({priceCode})</FieldLabel>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min={0}
                {...register('cost', { valueAsNumber: true })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="price">Precio ({priceCode})</FieldLabel>
              <Input
                id="price"
                type="number"
                step="0.01"
                min={0}
                {...register('price', { valueAsNumber: true })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="taxRate">% IVA</FieldLabel>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                min={0}
                max={100}
                {...register('taxRate', { valueAsNumber: true })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="minStock">Stock mínimo</FieldLabel>
              <Input
                id="minStock"
                type="number"
                step="0.01"
                min={0}
                {...register('minStock', { valueAsNumber: true })}
              />
            </Field>
            <Field orientation="horizontal" className="items-center gap-2 space-y-0">
              <Checkbox
                id="isExempt"
                checked={isExempt}
                onCheckedChange={v => setValue('isExempt', !!v)}
              />
              <FieldLabel htmlFor="isExempt" className="cursor-pointer">
                Exento de IVA
              </FieldLabel>
            </Field>
            <Field orientation="horizontal" className="items-center gap-2 space-y-0">
              <Checkbox
                id="hasBatches"
                checked={hasBatches}
                onCheckedChange={v => setValue('hasBatches', !!v)}
              />
              <FieldLabel htmlFor="hasBatches" className="cursor-pointer">
                Maneja lotes
              </FieldLabel>
            </Field>
          </FieldGroup>
          <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              {isEdit ? t('save') : t('create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
