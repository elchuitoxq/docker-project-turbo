# FRONTEND NEXT.JS - ESTRUCTURA COMPLETA

## Resumen

| Aspecto | Cantidad |
|---------|----------|
| Páginas (app/) | 31 |
| Módulos (modules/) | 14 |
| Componentes UI (shadcn) | 32 |
| Stores (Zustand) | 2 |
| Hooks personalizados | 4 |

---

## 1. Estructura app/ (App Router)

```
app/
├── page.tsx                              # Landing (/)
├── layout.tsx                            # Root layout
├── globals.css
├── favicon.ico
├── login/
│   └── page.tsx                         # /login
└── dashboard/
    ├── page.tsx                         # /dashboard (BI)
    ├── layout.tsx                       # Dashboard layout (AuthGuard + Sidebar)
    ├── billing/
    │   └── invoices/
    │       └── page.tsx                 # /dashboard/billing/invoices
    ├── treasury/
    │   ├── page.tsx                     # /dashboard/treasury
    │   ├── accounts/
    │   │   └── page.tsx                # /dashboard/treasury/accounts
    │   ├── statements/
    │   │   └── [partnerId]/
    │   │       └── page.tsx            # /dashboard/treasury/statements/:partnerId
    │   ├── retentions/
    │   │   └── page.tsx                # /dashboard/treasury/retentions
    │   ├── daily-close/
    │   │   └── page.tsx                # /dashboard/treasury/daily-close
    │   └── reports/
    │       └── page.tsx                 # /dashboard/treasury/reports
    ├── settings/
    │   ├── users/
    │   │   └── page.tsx               # /dashboard/settings/users
    │   ├── tax-concepts/
    │   │   └── page.tsx               # /dashboard/settings/tax-concepts
    │   ├── methods/
    │   │   └── page.tsx               # /dashboard/settings/methods
    │   ├── payroll-concepts/
    │   │   └── page.tsx              # /dashboard/settings/payroll-concepts
    │   ├── payroll-settings/
    │   │   └── page.tsx              # /dashboard/settings/payroll-settings
    │   ├── currencies/
    │   │   └── page.tsx               # /dashboard/settings/currencies
    │   └── banks/
    │       └── page.tsx               # /dashboard/settings/banks
    ├── operations/
    │   ├── sales/
    │   │   └── page.tsx              # /dashboard/operations/sales
    │   ├── purchases/
    │   │   └── page.tsx              # /dashboard/operations/purchases
    │   ├── partners/
    │   │   ├── page.tsx             # /dashboard/operations/partners
    │   │   └── [id]/
    │   │       └── statement/
    │   │           └── page.tsx     # /dashboard/operations/partners/:id/statement
    │   └── orders/
    │       └── page.tsx              # /dashboard/operations/orders
    ├── inventory/
    │   ├── products/
    │   │   └── page.tsx             # /dashboard/inventory/products
    │   ├── warehouses/
    │   │   └── page.tsx             # /dashboard/inventory/warehouses
    │   └── moves/
    │       └── page.tsx             # /dashboard/inventory/moves
    ├── hr/
    │   ├── employees/
    │   │   ├── page.tsx            # /dashboard/hr/employees
    │   │   └── [id]/
    │   │       └── page.tsx        # /dashboard/hr/employees/:id
    │   ├── departments/
    │   │   └── page.tsx           # /dashboard/hr/departments
    │   ├── positions/
    │   │   └── page.tsx           # /dashboard/hr/positions
    │   ├── payroll/
    │   │   ├── page.tsx           # /dashboard/hr/payroll
    │   │   └── [id]/
    │   │       └── page.tsx       # /dashboard/hr/payroll/:id
    │   ├── incidents/
    │   │   └── page.tsx          # /dashboard/hr/incidents
    │   └── settings/
    │       └── page.tsx          # /dashboard/hr/settings
    └── branches/
        └── page.tsx             # /dashboard/branches
```

---

## 2. Estructura components/

```
components/
├── ui/                           # 32 componentes shadcn/ui
│   ├── alert-dialog.tsx
│   ├── avatar.tsx
│   ├── badge.tsx
│   ├── breadcrumb.tsx
│   ├── button.tsx
│   ├── calendar.tsx
│   ├── card.tsx
│   ├── checkbox.tsx
│   ├── collapsible.tsx
│   ├── command.tsx
│   ├── date-picker.tsx
│   ├── date-range-picker.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── field.tsx
│   ├── form.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── popover.tsx
│   ├── scroll-area.tsx
│   ├── select.tsx
│   ├── separator.tsx
│   ├── sheet.tsx
│   ├── sidebar.tsx
│   ├── skeleton.tsx
│   ├── sonner.tsx (toasts)
│   ├── switch.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── textarea.tsx
│   └── tooltip.tsx
├── navigation/
│   ├── app-sidebar.tsx          # Sidebar principal
│   ├── av-main.tsx
│   ├── av-projects.tsx
│   ├── av-user.tsx
│   ├── branch-switcher.tsx     # Cambio de sucursal
│   └── dynamic-breadcrumb.tsx
├── layout/
│   ├── app-header.tsx
│   ├── global-rate-display.tsx  # Muestra tasa BCV
│   └── page-header.tsx         # Encabezado unificado
└── auth/
    ├── auth-guard.tsx          # Redirect si no auth
    ├── login-form.tsx
    └── permissions-gate.tsx    # Gate basado en permisos
```

---

## 3. Estructura modules/ (14 módulos)

```
modules/
├── auth/
│   └── schemas/
│       └── login.schema.ts
├── billing/
│   ├── types.ts
│   ├── hooks/
│   │   ├── use-credit-notes.ts
│   │   └── use-invoices.ts
│   └── components/
│       ├── create-credit-note-dialog.tsx
│       ├── invoice-details-dialog.tsx
│       ├── invoice-status-cards.tsx
│       ├── invoices-table.tsx
│       └── invoices-view.tsx
├── bi/
│   ├── types.ts
│   ├── hooks/
│   │   └── use-bi.ts
│   └── components/
│       ├── activity-feed.tsx
│       ├── dashboard-view.tsx
│       ├── overview-chart.tsx
│       └── stats-cards.tsx
├── branches/
│   ├── types.ts
│   ├── schemas/
│   │   └── branch.schema.ts
│   ├── hooks/
│   │   ├── use-branch-mutations.ts
│   │   └── use-branches.ts
│   └── components/
│       ├── branch-dialog.tsx
│       ├── branches-table.tsx
│       └── branches-view.tsx
├── common/
│   ├── types/
│   │   └── audit.ts
│   ├── hooks/
│   │   ├── use-audit-history.ts
│   │   └── use-document-flow.ts
│   └── components/
│       ├── document-flow.tsx
│       ├── document-history.tsx
│       └── pdf/
│           ├── document-layout.tsx
│           ├── invoice-pdf.tsx
│           ├── order-pdf.tsx
│           └── pdf-styles.ts
├── hr/
│   ├── schemas/
│   │   └── hr.schema.ts
│   ├── payroll.api.ts
│   ├── payroll/
│   │   └── payroll-dashboard.tsx
│   ├── concepts/
│   │   ├── hooks/
│   │   │   └── use-payroll-concepts.ts
│   │   └── components/
│   │       ├── concept-dialog.tsx
│   │       └── payroll-concepts-view.tsx
│   ├── incidents/
│   │   ├── hooks/
│   │   │   └── use-incidents.ts
│   │   └── components/
│   │       ├── incident-dialog.tsx
│   │       └── incidents-view.tsx
│   ├── hooks/
│   │   ├── use-benefits.ts
│   │   ├── use-contracts.ts
│   │   ├── use-departments.ts
│   │   ├── use-employees.ts
│   │   ├── use-incidents.ts
│   │   ├── use-payroll-settings.ts
│   │   ├── use-payroll.ts
│   │   ├── use-positions.ts
│   │   ├── use-profit-sharing.ts
│   │   ├── use-terminations.ts
│   │   └── use-vacations.ts
│   └── components/
│       ├── dialogs/
│       │   ├── contract-dialog.tsx
│       │   ├── department-dialog.tsx
│       │   ├── employee-dialog.tsx
│       │   ├── position-dialog.tsx
│       │   └── termination-dialog.tsx
│       ├── views/
│       │   ├── departments-view.tsx
│       │   ├── employee-detail-view.tsx
│       │   ├── employees-view.tsx
│       │   ├── hr-settings-view.tsx
│       │   ├── payroll-detail-view.tsx
│       │   └── positions-view.tsx
│       ├── tabs/
│       │   ├── benefits-tab.tsx
│       │   ├── contracts-tab.tsx
│       │   ├── incidents-tab.tsx
│       │   ├── payroll-settings-tab.tsx
│       │   ├── profit-sharing-tab.tsx
│       │   └── vacations-tab.tsx
│       ├── shared/
│       │   └── employee-combobox.tsx
│       └── payroll/
│           ├── generator-dialog.tsx
│           └── payslip-viewer.tsx
├── inventory/
│   ├── types.ts
│   ├── schemas/
│   │   ├── move.schema.ts
│   │   └── product.schema.ts
│   ├── hooks/
│   │   ├── use-inventory.ts
│   │   ├── use-products.ts
│   │   ├── use-stock.ts
│   │   └── use-warehouses.ts
│   └── components/
│       ├── dual-currency-display.tsx    # USD + VES
│       ├── move-dialog.tsx
│       ├── move-details-dialog.tsx
│       ├── moves-table.tsx
│       ├── moves-view.tsx
│       ├── product-combobox.tsx
│       ├── product-dialog.tsx
│       ├── products-table.tsx
│       ├── products-view.tsx
│       ├── warehouse-dialog.tsx
│       ├── warehouse-stock-dialog.tsx
│       ├── warehouses-view.tsx
│       └── products-view.tsx
├── orders/
│   ├── types.ts
│   ├── hooks/
│   │   └── use-orders.ts
│   └── components/
│       ├── order-dialog.tsx
│       ├── order-details-dialog.tsx
│       ├── order-status-cards.tsx
│       ├── orders-table.tsx
│       ├── purchases-view.tsx
│       ├── sales-view.tsx
│       └── orders-table.tsx
├── partners/
│   ├── types.ts
│   ├── schemas/
│   │   └── partner.schema.ts
│   ├── hooks/
│   │   └── use-partners.ts
│   └── components/
│       ├── partner-combobox.tsx
│       ├── partner-dialog.tsx
│       ├── partner-statement-view.tsx
│       ├── partners-table.tsx
│       └── partners-view.tsx
├── reports/
│   ├── reports.api.ts
│   └── components/
│       ├── document-detail-modal.tsx
│       ├── fiscal-guide.tsx
│       └── reports-view.tsx
├── roles/
│   └── components/
│       ├── role-dialog.tsx
│       ├── roles-table.tsx
│       └── roles-view.tsx
├── settings/
│   ├── hooks/
│   │   └── use-exchange-rate.ts
│   ├── components/
│   │   ├── methods-view.tsx
│   │   └── payroll-settings-view.tsx
│   ├── banks/
│   │   ├── hooks/
│   │   │   └── use-banks.ts
│   │   └── components/
│   │       ├── bank-dialog.tsx
│   │       └── banks-view.tsx
│   ├── currencies/
│   │   ├── hooks/
│   │   │   └── use-currencies.ts
│   │   └── components/
│   │       └── currencies-view.tsx
│   └── tax-concepts/
│       ├── hooks/
│       │   └── use-tax-concepts.ts
│       └── components/
│           └── tax-concepts-view.tsx
├── treasury/
│   ├── types.ts
│   ├── hooks/
│   │   ├── use-bank-accounts.ts
│   │   ├── use-treasury.ts
│   │   └── use-void-payment.ts
│   └── components/
│       ├── accounts-view.tsx
│       ├── balance-picker.tsx          # Para cruce de saldo
│       ├── bank-account-ledger.tsx
│       ├── bank-accounts-table.tsx
│       ├── daily-close-view.tsx
│       ├── exchange-rate-widget.tsx
│       ├── global-payment-form.tsx
│       ├── global-payments-table.tsx
│       ├── payment-details-dialog.tsx
│       ├── payment-dialog.tsx
│       ├── retentions-table.tsx
│       ├── retentions-view.tsx
│       ├── statement-table.tsx         # Estado de cuenta
│       ├── treasury-statement-view.tsx
│       └── treasury-view.tsx
└── users/
    ├── types.ts
    ├── schemas/
    │   └── user.schema.ts
    ├── hooks/
    │   ├── use-user-mutations.ts
    │   └── use-users.ts
    └── components/
        ├── user-dialog.tsx
        ├── users-and-roles-view.tsx
        └── users-table.tsx
```

---

## 4. Estructura stores/

```
stores/
├── use-auth-store.ts          # Zustand store de autenticación
│   ├── token: string | null
│   ├── user: User | null
│   ├── currentBranch: Branch | null
│   ├── isAuthenticated: boolean
│   ├── hasHydrated: boolean
│   ├── login(token, user)
│   ├── logout()
│   └── setBranch(branch)
└── use-guide-store.ts         # Sistema de tours/guias
```

---

## 5. Estructura hooks/

```
hooks/
├── use-debounce.ts            # Debounce para inputs
├── use-mobile.ts              # Detectar móvil
├── use-permission.ts          # Check de permisos PBAC
│   ├── hasPermission(perm)
│   ├── hasAnyPermission([permA, permB])
│   └── hasAllPermissions([permA, permB])
└── use-profile.ts            # Perfil de usuario
```

---

## 6. Estructura lib/

```
lib/
├── api.ts                     # API Client (axios-like con auth)
│   ├── get/post/put/patch/delete
│   ├── Header x-branch-id
│   ├── response interceptors
│   └── responseType: 'blob' para descargas
├── navigation.ts              # NAV_ITEMS config
│   └── items de sidebar con permisos
├── query-provider.tsx         # React Query provider
└── utils.ts                  # cn(), formatCurrency, formatDate
```

---

## 7. Estructura types/

```
types/
├── api.ts                     # Tipos de API response
└── api.schema.ts              # Tipos generados de OpenAPI
```

---

## 8. Estructura config/

```
config/
└── permissions.ts             # Copia de PERMISSIONS del paquete db
```

---

## 9. API Client (lib/api.ts)

```typescript
// Ejemplo de API Client
const api = {
  get: async (url, config?) => { /* ... */ },
  post: async (url, data, config?) => { /* ... */ },
  // ...
};

// Características:
// - Bearer token en headers
// - Header x-branch-id para contexto multi-tenant
// - Manejo de 401 (logout automático)
// - Tipado con generics
```

---

## 10. DualCurrencyDisplay Component

```typescript
// Componente para mostrar USD + VES
// apps/web/modules/inventory/components/dual-currency-display.tsx

interface DualCurrencyDisplayProps {
  amount: number;
  currency?: 'USD' | 'VES';
  exchangeRate?: number;
}

// Muestra:
// $ 25.00 USD  (≈ Bs 8.818,25)
```

---

## 11. Navigation (lib/navigation.ts)

```typescript
// Configuración de sidebar
NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard" },
  { title: "Operaciones", items: [Clientes, Ventas, Compras] },
  { title: "Inventario", items: [Productos, Almacenes, Movimientos] },
  { title: "Finanzas", items: [Facturas, Tesorería, Cierre, Retenciones, Cuentas, Reportes] },
  { title: "Recursos Humanos", items: [Empleados, Cargos, Deptos, Nóminas, Novedades] },
  { title: "Configuración", items: [Users, Sucursales, Bancos, ISLR, Monedas] }
]
// Cada item puede tener permission requerida
```

---

## 12. Permisos en Frontend (usePermission)

```typescript
// hooks/use-permission.ts

const { hasPermission } = usePermission();

// En componente
<PermissionsGate permission={PERMISSIONS.FINANCE.INVOICES.CREATE}>
  <CreateInvoiceButton />
</PermissionsGate>

// Nav items se filtran automáticamente
```
