# Operations — Sub-proyecto #1

> **Status:** Diseño histórico; implementación parcial con contratos divergentes.
> **Fecha:** 2026-06-04
> **Alcance:** Partners (clientes/proveedores) CRUD + estado de cuenta, Sales, Purchases, Orders
> **Sub-módulos:** 4 (partners, sales, purchases, orders)
>
> Los endpoints y tipos descritos abajo son requisitos de diseño, no garantía
> del comportamiento actual. Contrastar con [`../../API-CONTRACTS.md`](../../API-CONTRACTS.md)
> y [`../../PROJECT-STATUS.md`](../../PROJECT-STATUS.md).

---

## 1. Alcance y dependencias

### 1.1 Entidades backend (existentes en `apps/backend`)

- `partners` (id, name, email, taxId, address, phone, type, taxpayerType, retentionRate, isSpecialTaxpayer, creditLimit, islrConceptId)
- `orders` (id, branchId, partnerId, type: SALE|PURCHASE, status, items, totals, etc.)
- `invoices` (id, branchId, partnerId, type: SALE|PURCHASE, status: DRAFT|POSTED|VOID, items, totals, tax)
- `creditNotes` (id, invoiceId, ...)

### 1.2 Endpoints a consumir

| Método | Path                                   | Módulo                       |
| ------ | -------------------------------------- | ---------------------------- |
| GET    | `/partners?page=&limit=&type=&search=` | Listado paginado con filtros |
| GET    | `/partners/:id`                        | Detalle                      |
| POST   | `/partners`                            | Crear                        |
| PATCH  | `/partners/:id`                        | Editar                       |
| DELETE | `/partners/:id`                        | Eliminar (soft)              |
| GET    | `/partners/:id/statement?from=&to=`    | Estado de cuenta             |
| GET    | `/orders`                              | Listado de pedidos           |
| GET    | `/orders/:id`                          | Detalle                      |
| GET    | `/billing/invoices?type=SALE`          | Listado de ventas            |
| GET    | `/billing/invoices?type=PURCHASE`      | Listado de compras           |

---

## 2. Módulo Partners (vertical slice completo)

### 2.1 Estructura

```
modules/partners/
├── api.ts                    # funciones fetch tipadas
├── types.ts                  # Partner, PartnerType, Statement, etc.
├── schemas/
│   └── partner.schema.ts     # Zod schemas para crear/editar
├── hooks/
│   ├── use-partners.ts       # usePartners, usePartner, useCreate, useUpdate, useDelete
│   └── use-statement.ts      # usePartnerStatement
└── components/
    ├── partners-table.tsx
    ├── partners-view.tsx
    ├── partner-dialog.tsx        # Crear/editar
    ├── partner-combobox.tsx      # usado en otros módulos
    ├── partner-statement-view.tsx
    └── partner-statement-table.tsx
```

### 2.2 Schemas Zod

```ts
export const partnerSchema = z.object({
  name: z.string().min(1, 'Requerido').max(255),
  email: z.string().email().optional().or(z.literal('')),
  taxId: z.string().min(1, 'Requerido').max(20),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']),
  taxpayerType: z.enum(['ORDINARY', 'SPECIAL']).default('ORDINARY'),
  retentionRate: z.coerce.number().min(0).max(100).default(0),
  isSpecialTaxpayer: z.boolean().default(false),
  creditLimit: z.coerce.number().min(0).default(0),
});
```

### 2.3 Hooks (TanStack Query)

- `usePartners(filters)` → `useQuery`
- `usePartner(id)` → `useQuery`
- `useCreatePartner()` → `useMutation` (invalida `['partners']`)
- `useUpdatePartner()` → `useMutation` (invalida `['partners']` y `['partner', id]`)
- `useDeletePartner()` → `useMutation` (optimistic remove)
- `usePartnerStatement(id, range)` → `useQuery`

### 2.4 Vistas

- **PartnersView:** PageHeader + filtros (search, type) + Table responsive (Tabla/Cards toggle) + botón "Nuevo cliente" → abre PartnerDialog
- **PartnerDialog:** Sheet lateral con FieldGroup grid responsive. Crea/edita. Al guardar, toast y cierra.
- **PartnerStatementView:** Muestra balance, últimas transacciones, filtros por fecha. Tabla con rows de facturas/pagos/notas de crédito.

### 2.5 RBAC

- Ver: `operations:partners:view`
- Crear: `operations:partners:create`
- Editar: `operations:partners:edit`
- Eliminar: `operations:partners:delete`
- Estado de cuenta: `operations:partners:statement`

---

## 3. Módulo Orders (listado + detalle)

### 3.1 Alcance

Solo listado y detalle (no crear/editar en este sub-proyecto). Las vistas muestran el estado y permiten navegar al detalle.

### 3.2 Estructura

```
modules/orders/
├── api.ts
├── types.ts                  # Order, OrderStatus
├── hooks/use-orders.ts
└── components/
    ├── orders-table.tsx
    ├── orders-view.tsx
    ├── order-details-dialog.tsx
    └── order-status-cards.tsx   # KPIs arriba
```

### 3.3 Vistas

- **OrdersView:** Filtros (status, type, partner, date range) + StatusCards (PENDING, APPROVED, INVOICED, CANCELLED) + Tabla responsive.
- **OrderDetailsDialog:** Sheet con detalle completo: header, partner, items, totales, estado, audit history.

---

## 4. Módulo Sales/Purchases (listados)

### 4.1 Alcance

Listado de facturas tipo SALE (Sales) y PURCHASE (Purchases). Detalle al hacer click.

### 4.2 Estructura

Cada uno (sales, purchases) sigue el mismo patrón:

```
modules/<name>/
├── api.ts
├── types.ts
├── hooks/use-invoices.ts
└── components/
    ├── invoices-table.tsx
    ├── invoices-view.tsx
    └── invoice-details-dialog.tsx
```

(Usan el mismo billing endpoint con filtro `type=`)

---

## 5. Páginas App Router

```
app/(dashboard)/dashboard/operations/
├── partners/
│   ├── page.tsx                # lista
│   └── [id]/
│       └── statement/
│           └── page.tsx        # estado de cuenta
├── sales/page.tsx
├── purchases/page.tsx
└── orders/page.tsx
```

---

## 6. Patrones comunes (para todos los módulos de Operations)

1. **PageHeader:** título + botón acción primaria alineado derecha (responsive: stack en mobile).
2. **Filtros:** inline en desktop, Sheet en mobile.
3. **ResponsiveTable:** toggle tabla↔cards en mobile.
4. **Permisos:** `<PermissionsGate>` en cada acción (botón crear, editar, eliminar).
5. **Formularios:** react-hook-form + zod + FieldGroup grid `1/md:2/xl:3`.
6. **DualCurrencyDisplay:** para totales con USD↔VES.
7. **Optimistic updates:** para mutaciones de delete.
8. **Toast feedback:** success/error via sonner.

---

## 7. DoD #1 Operations

- [ ] `pnpm --filter frontend build` ✓
- [ ] `pnpm test --filter frontend --run` ≥ 70 tests passing
- [ ] Partners: CRUD completo + statement funcional
- [ ] Orders: listado + detalle
- [ ] Sales/Purchases: listados
- [ ] Filtros server-side funcionales
- [ ] RBAC visual en todas las acciones
- [ ] Responsive: cards en mobile, tabla en desktop
- [ ] Sin scroll horizontal a 360px
