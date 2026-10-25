# Foundation — Diseño Aprobado

> **Sub-proyecto:** #0 de 6 (Foundation → Operations → Inventory → Finance → HR → BI)
> **Estado:** Diseño aprobado por el usuario
> **Fecha:** 2026-06-04
> **Alcance:** Shell frontend con sidebar-07, auth, multi-tenant empresa-sucursal, tema dark/light, RBAC visual, responsive (mobile/tablet/desktop), 14 stubs de módulos.

---

## 1. Contexto y objetivos

### 1.1 Estado actual verificado

| Capa | Realidad |
|---|---|
| `apps/frontend/` | Solo scaffold Next.js 16 + React 19. `app/page.tsx` con H1. Cero shadcn, cero módulos, cero stores, cero api client. |
| `apps/frontend/components/` | Subcarpetas vacías (`auth/`, `layout/`, `navigation/`, `ui/`). |
| `apps/frontend/components.json` | **No existe.** |
| `apps/frontend/package.json` | Sin shadcn, sin TanStack Query, sin Zustand, sin next-themes, sin zod. |
| Backend (NestJS) | 19 módulos completos. Endpoints funcionales, RBAC, BCV, USD/VES, fiscalidad VE. |
| Base de datos | `branches` con `name, taxId, address, phone, email, isActive`. **No existe** tabla `companies`. Multi-tenant actual = `users_branches` → `branches`. |

### 1.2 Decisiones cerradas

| # | Decisión |
|---|---|
| D1 | Frontend completo end-to-end (14 módulos) en 6 sub-proyectos |
| D2 | Foundation primero (1 sprint) |
| D3 | Tema: toggle dark/light estándar shadcn, sin editor ni backend |
| D4 | Header empresarial: CompanyContext, branch, search, favoritos, help, i18n |
| D5 | API: openapi-typescript + openapi-codegen + fetch nativo + React Query v5 (sin axios) |
| D6 | Estética: Linear/Vercel con shadcn `sidebar-07` |
| D7 | Multi-tenant: Camino C — empresa lógica agrupada por RIF |
| D8 | Ejecución: vertical slice en 9 días |

### 1.3 Métricas DoD Foundation

- Build, lint, typecheck en verde.
- Coverage > 80% en `lib/`, `stores/`, `hooks/`, `components/auth/`.
- 4 specs Playwright pasando: auth, company-switch, sidebar, responsive.
- Login real contra backend.
- Cambio de empresa + sucursal refleja `x-branch-id` en Network.
- Sidebar filtrado por permisos.
- Dark/light persiste entre recargas.
- 14 módulos con link stub en sidebar.
- Sin scroll horizontal a 360px.

---

## 2. Arquitectura

### 2.1 Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Estilos:** Tailwind CSS v4 + shadcn/ui block `sidebar-07`
- **Estado servidor:** TanStack Query v5
- **Estado cliente:** Zustand + persist (localStorage)
- **Tema:** next-themes (`attribute="class"`)
- **API client:** `fetch` nativo + wrapper en `lib/api/client.ts`
- **Generación de tipos:** openapi-typescript + openapi-codegen
- **Formularios:** react-hook-form + zod (@hookform/resolvers)
- **Tablas:** shadcn Table + TanStack Table
- **i18n:** next-intl con `es-VE` (default) y `en-US`
- **DnD favoritos:** @dnd-kit/core
- **Búsqueda global:** cmdk (incluido en shadcn)
- **Tests:** Vitest + React Testing Library + MSW + Playwright

### 2.2 Estructura de carpetas

```
apps/frontend/
├── app/                              # App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── forbidden/page.tsx
│   │   └── layout.tsx
│   └── (dashboard)/
│       ├── layout.tsx                # AuthGuard + SidebarProvider + CompanyContext
│       ├── page.tsx                  # /dashboard (BI stub)
│       ├── operations/<ruta>/page.tsx
│       ├── inventory/<ruta>/page.tsx
│       ├── finance/<ruta>/page.tsx
│       ├── hr/<ruta>/page.tsx
│       ├── settings/<ruta>/page.tsx
│       └── bi/page.tsx
├── components/
│   ├── ui/                           # shadcn primitives
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── app-header.tsx
│   │   ├── app-sidebar.tsx
│   │   ├── nav-main.tsx
│   │   ├── nav-modules.tsx
│   │   ├── nav-favorites.tsx
│   │   ├── nav-user.tsx
│   │   ├── company-context-switcher.tsx
│   │   ├── branch-switcher.tsx
│   │   ├── global-rate-display.tsx
│   │   ├── command-palette.tsx
│   │   ├── help-popover.tsx
│   │   ├── language-switcher.tsx
│   │   └── nav-mobile-trigger.tsx
│   ├── auth/
│   │   ├── auth-guard.tsx
│   │   ├── permissions-gate.tsx
│   │   └── login-form.tsx
│   └── theme-provider.tsx
├── modules/<14 módulos>/             # types, schemas, api, hooks, components
├── stores/
│   ├── use-auth-store.ts
│   ├── use-company-store.ts
│   ├── use-branch-store.ts
│   ├── use-favorites-store.ts
│   └── use-ui-store.ts
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── endpoints.ts
│   │   └── error.ts
│   ├── codegen.config.ts
│   ├── i18n/
│   │   ├── config.ts
│   │   ├── request.ts
│   │   └── locales/{es-VE,en-US}.json
│   ├── navigation.ts
│   ├── permissions.ts
│   ├── query-provider.tsx
│   ├── get-breadcrumb.ts
│   ├── env.ts
│   └── utils.ts
├── hooks/
│   ├── use-debounce.ts
│   ├── use-mobile.ts
│   ├── use-permission.ts
│   ├── use-profile.ts
│   └── use-shortcut.ts
├── types/
│   ├── api.ts
│   └── api-schema.d.ts               # generado
├── config/
│   └── site.ts
├── styles/
│   └── globals.css                   # Tailwind v4 + CSS vars
├── e2e/                              # Playwright specs
└── public/
```

### 2.3 Reglas arquitectónicas

1. **Aislamiento por capas:** `modules/<name>/api` → fetch, `modules/<name>/hooks` → React Query, `modules/<name>/components` → consume hooks.
2. **Page = thin wrapper:** `app/(dashboard)/<ruta>/page.tsx` solo importa la view del módulo. Cero lógica.
3. **Stores separados:** auth, company, branch, favorites, ui. Cada uno con su `reset()`.
4. **Tipos generados:** todos los tipos de API vienen de `types/api-schema.d.ts` (generado).
5. **Permisos siempre via código, nunca via rol directo:** `<PermissionsGate permission="...">` o `usePermission().hasPermission()`.

---

## 3. Diseño funcional

### 3.1 Flujo de autenticación

1. `POST /auth/login` con `{email, password}`.
2. Backend retorna `{accessToken, user: {id, name, email, permissions, branches}}`.
3. `useAuthStore.login(token, user)` guarda en Zustand persist.
4. `AuthGuard` en `app/(dashboard)/layout.tsx`:
   - Sin auth → `router.replace('/login')`.
   - Sin `currentCompanyTaxId` válido → `router.replace('/forbidden?reason=no-company')`.
   - Sin branch accesible → `router.replace('/forbidden?reason=no-branch')`.
5. `lib/api/client.ts` inyecta `Authorization: Bearer <token>` y `x-branch-id: <branchId>`.

### 3.2 Flujo multi-tenant (Camino C)

1. Backend expone `GET /branches/companies` que agrupa branches por `taxId`.
2. Frontend: `useCompanies()` hook + `useCompanyStore` (persiste `currentCompanyTaxId`).
3. `useBranchStore` filtra `availableBranches` por el `taxId` actual.
4. `CompanyContextSwitcher` en header: dos comboboxes (Empresa → Sucursal).
5. Al cambiar empresa: `queryClient.clear()`.

### 3.3 Layout responsive (regla §10)

| Breakpoint | Rango | Sidebar | Header |
|---|---|---|---|
| (base) / sm | < 768px | Sheet drawer overlay | Hamburger + chip empresa compacto + menú ⋯ |
| md | 768-1023px | Sidebar colapsado a iconos, abre como overlay | Ambos selectores inline + breadcrumb + i18n |
| lg+ | ≥ 1024px | Sidebar expandido con variantes (default/inset) | Full: CompanyContext + breadcrumb + Help + i18n + Notif |

### 3.4 RBAC visual

- `usePermission()` hook con `hasPermission`, `hasAnyPermission`, `hasAllPermissions`.
- `<PermissionsGate permission>` para gates finos.
- `NavMain` filtra items sin permiso.
- Sub-item sin permiso oculta al padre si todos están vacíos.

### 3.5 Tema

- `next-themes` con `attribute="class"`, `defaultTheme="system"`, `enableSystem`.
- `ModeToggle` (sol/luna) en `NavUser` del sidebar.
- CSS vars en `styles/globals.css` con `@theme inline` (Tailwind v4).

---

## 4. API — nuevos endpoints y tipos

### 4.1 Nuevo endpoint backend

```typescript
// apps/backend/src/modules/branches/branches.controller.ts (extender)
@Get('companies')
@ApiOperation({ summary: 'Lista empresas (agrupadas por RIF) accesibles al usuario' })
async findCompanies(@CurrentUser() user): Promise<CompanyResponseDto[]> {
  return this.branchesService.findCompaniesGroupedByTaxId(user.id);
}
```

```typescript
// apps/backend/src/modules/branches/dto/branches.dto.ts (extender)
export class CompanyResponseDto {
  taxId: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  branches: BranchResponseDto[];
  branchCount: number;
}
```

### 4.2 Endpoints consumidos (ya existentes)

| Método | Path | Uso |
|---|---|---|
| POST | `/auth/login` | Login |
| GET | `/auth/profile` | Perfil del usuario autenticado |
| GET | `/branches` | Sucursales accesibles |
| GET | `/branches/companies` | Empresas (RIF agrupados) — **NUEVO** |
| GET | `/settings/exchange-rates/current` | Tasa BCV actual |
| GET | `/search?q=` | Búsqueda global |
| GET | `/audit/:entityTable/:entityId` | Historial de cambios |

---

## 5. Modelo de datos en frontend

### 5.1 Stores Zustand

```typescript
// useAuthStore
{ token, user: {id, name, email, permissions, branches}, isAuthenticated, hasHydrated,
  login(token, user), logout(), setUser(user) }

// useCompanyStore
{ currentCompanyTaxId, availableCompanies, setCompany, setAvailableCompanies, reset }

// useBranchStore
{ currentBranchId, availableBranches, setBranch, setAvailableBranches, reset }

// useFavoritesStore
{ items: Array<{path, label, icon}>, add, remove, reorder, reset }

// useUiStore
{ sidebarOpen, commandPaletteOpen, language, setSidebarOpen, toggleCommandPalette, setLanguage }
```

### 5.2 Permisos (réplica tipada)

```typescript
// lib/permissions.ts
export const PERMISSIONS = {
  DASHBOARD: { VIEW: 'dashboard:view' },
  OPERATIONS: {
    VIEW: 'operations:view',
    PARTNERS: { VIEW, CREATE, EDIT, DELETE, STATEMENT },
    SALES: { VIEW, CREATE, EDIT },
    PURCHASES: { VIEW, CREATE, EDIT },
    ORDERS: { VIEW, CREATE, EDIT, APPROVE },
  },
  INVENTORY: { VIEW, PRODUCTS: {…}, WAREHOUSES: {…}, MOVES: {…} },
  FINANCE: { VIEW, INVOICES: {…}, TREASURY: {…}, PAYMENTS: {…}, RETENTIONS: {…}, REPORTS: {…} },
  HR: { VIEW, EMPLOYEES: {…}, PAYROLL: {…}, INCIDENTS: {…}, SETTINGS: {…} },
  SETTINGS: { VIEW, USERS: {…}, ROLES: {…}, BRANCHES: {…}, BANKS: {…}, CURRENCIES: {…}, TAXES: {…} },
} as const;
```

### 5.3 NAV_ITEMS

```typescript
[
  { title: 'Dashboard', url: '/dashboard', icon: 'LayoutDashboard', permission: PERMISSIONS.DASHBOARD.VIEW },
  { title: 'Operaciones', icon: 'Briefcase', permission: PERMISSIONS.OPERATIONS.VIEW, items: [
    { title: 'Clientes y Proveedores', url: '/dashboard/operations/partners', permission: PERMISSIONS.OPERATIONS.PARTNERS.VIEW },
    { title: 'Ventas', url: '/dashboard/operations/sales', permission: PERMISSIONS.OPERATIONS.SALES.VIEW },
    { title: 'Compras', url: '/dashboard/operations/purchases', permission: PERMISSIONS.OPERATIONS.PURCHASES.VIEW },
    { title: 'Pedidos', url: '/dashboard/operations/orders', permission: PERMISSIONS.OPERATIONS.ORDERS.VIEW },
  ]},
  // ... mismo patrón para Inventory, Finance, HR, Settings
]
```

---

## 6. Backend (1 endpoint + 1 test)

### 6.1 Endpoint `GET /branches/companies`

**Implementación:**

```typescript
// branches.service.ts (agregar método)
async findCompaniesGroupedByTaxId(userId: string): Promise<CompanyResponseDto[]> {
  // 1. Cargar branches accesibles por el user (vía users_branches)
  const userBranches = await db
    .select({ branch: branches })
    .from(usersBranches)
    .innerJoin(branches, eq(usersBranches.branchId, branches.id))
    .where(eq(usersBranches.userId, userId));

  // 2. Agrupar por taxId
  const byTaxId = new Map<string, typeof userBranches>();
  for (const row of userBranches) {
    const taxId = row.branch.taxId ?? 'UNKNOWN';
    if (!byTaxId.has(taxId)) byTaxId.set(taxId, []);
    byTaxId.get(taxId)!.push(row);
  }

  // 3. Mapear a CompanyResponseDto
  return Array.from(byTaxId.entries()).map(([taxId, rows]) => {
    const first = rows[0].branch;
    return {
      taxId,
      name: first.name,
      address: first.address,
      phone: first.phone,
      email: first.email,
      branchCount: rows.length,
      branches: rows.map(r => this.toResponseDto(r.branch)),
    };
  });
}
```

### 6.2 Test unitario

```typescript
it('groups branches by taxId and returns aggregated company info', async () => {
  const userId = 'user-1';
  await seedBranch({ name: 'HQ Caracas', taxId: 'J-111', address: 'Av. 1' });
  await seedBranch({ name: 'Sucursal Valencia', taxId: 'J-111', address: 'Av. 2' });
  await seedBranch({ name: 'Other Co', taxId: 'J-222', address: 'Av. 3' });
  await grantAccess(userId, ['hq', 'valencia', 'other']);

  const result = await service.findCompaniesGroupedByTaxId(userId);

  expect(result).toHaveLength(2);
  const j111 = result.find(c => c.taxId === 'J-111');
  expect(j111?.branchCount).toBe(2);
  expect(j111?.branches).toHaveLength(2);
});
```

---

## 7. Frontend — Foundation detallada

### 7.1 Providers globales (root layout)

```tsx
// app/layout.tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <QueryProvider>
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Toaster richColors position="top-right" />
      {children}
    </NextIntlClientProvider>
  </QueryProvider>
</ThemeProvider>
```

### 7.2 API client

```typescript
// lib/api/client.ts
const API_BASE = env.NEXT_PUBLIC_API_URL;

class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export const apiClient = {
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { token } = useAuthStore.getState();
    const { currentBranchId } = useBranchStore.getState();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(currentBranchId && { 'x-branch-id': currentBranchId }),
        ...init.headers,
      },
    });
    if (res.status === 401) {
      useAuthStore.getState().logout();
      throw new ApiError(401, 'Unauthorized');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, body?.message ?? res.statusText, body);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  },
  get: <T>(p: string) => apiClient.request<T>(p),
  post: <T>(p: string, body: unknown) =>
    apiClient.request<T>(p, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(p: string, body: unknown) =>
    apiClient.request<T>(p, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) =>
    apiClient.request<T>(p, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(p: string) => apiClient.request<T>(p, { method: 'DELETE' }),
};
```

### 7.3 Auth store

```typescript
// stores/use-auth-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  setHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      hasHydrated: false,
      login: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
      setHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'erp.auth',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => { state?.setHydrated(true); },
    },
  ),
);
```

### 7.4 CompanyContextSwitcher (componente clave §11)

```tsx
// components/layout/company-context-switcher.tsx
'use client';

import { useMemo } from 'react';
import { ChevronRight, Building2 } from 'lucide-react';
import { useCompanyStore } from '@/stores/use-company-store';
import { useBranchStore } from '@/stores/use-branch-store';
import { useCompanies } from '@/modules/branches/hooks/use-companies';
import { useBranches } from '@/modules/branches/hooks/use-branches';
import { Combobox } from '@/components/ui/combobox';

export function CompanyContextSwitcher() {
  const { currentCompanyTaxId, setCompany } = useCompanyStore();
  const { currentBranchId, setBranch } = useBranchStore();
  const { data: companies = [] } = useCompanies();
  const { data: branches = [] } = useBranches();

  const currentCompany = useMemo(
    () => companies.find((c) => c.taxId === currentCompanyTaxId) ?? null,
    [companies, currentCompanyTaxId],
  );
  const availableBranches = useMemo(
    () => branches.filter((b) => b.taxId === currentCompanyTaxId),
    [branches, currentCompanyTaxId],
  );

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Combobox
        icon={Building2}
        placeholder="Empresa"
        value={currentCompanyTaxId}
        options={companies.map((c) => ({
          value: c.taxId,
          label: c.name,
          sublabel: `RIF: ${c.taxId}`,
        }))}
        onChange={(taxId) => {
          setCompany(taxId);
          const firstBranch = branches.find((b) => b.taxId === taxId);
          setBranch(firstBranch?.id ?? null);
        }}
        disabled={companies.length <= 1}
      />
      <ChevronRight className="size-3.5 text-muted-foreground" />
      <Combobox
        placeholder="Sucursal"
        value={currentBranchId}
        options={availableBranches.map((b) => ({
          value: b.id,
          label: b.name,
        }))}
        onChange={setBranch}
        disabled={availableBranches.length <= 1}
      />
    </div>
  );
}
```

### 7.5 Responsive (regla §10)

- **Sidebar:** `useSidebar()` de shadcn ya provee `isMobile`. En mobile renderiza como `Sheet`; en desktop como `Sidebar` fijo.
- **Header:** `useIsMobile()` oculta elementos condicionalmente.
- **Tabla:** wrapper `ResponsiveTable` con toggle tabla↔cards en mobile.
- **Formularios:** grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`.

---

## 8. Testing

### 8.1 Unit (Vitest)

- `lib/api/client.test.ts` — fetch wrapper con auth + branch headers, 401, 403, errores.
- `stores/use-auth-store.test.ts` — login/logout/persist.
- `stores/use-company-store.test.ts` — setCompany, reset, persistencia.
- `stores/use-branch-store.test.ts` — setBranch, filtrado por companyTaxId.
- `hooks/use-permission.test.ts` — hasPermission, hasAny/AllPermissions.
- `components/auth/auth-guard.test.tsx` — redirige sin auth, sin company, sin branch.
- `components/auth/permissions-gate.test.tsx` — gate simple/any/all.
- `components/layout/company-context-switcher.test.tsx` — render, cambio, filtrado.

### 8.2 E2E (Playwright)

- `e2e/auth.spec.ts` — login válido/inválido, logout, refresh.
- `e2e/company-switch.spec.ts` — cambio de empresa refleja x-branch-id, BranchSwitcher se filtra.
- `e2e/sidebar.spec.ts` — filtrado por permisos, navegación entre módulos.
- `e2e/responsive.spec.ts` — sin scroll horizontal a 360px, sidebar drawer, tabla cards.

### 8.3 MSW handlers

- `GET /auth/profile`
- `GET /branches`
- `GET /branches/companies`
- `GET /settings/exchange-rates/current`
- `GET /search?q=`

---

## 9. Calendario de implementación (9 días)

| Día | Entregable |
|---|---|
| 1 | shadcn init + sidebar-07 + tema dark/light + ThemeProvider |
| 2 | Providers (TanStack Query, Toaster, i18n) + globals.css + ModeToggle |
| 3 | apiClient + openapi-typescript + openapi-codegen + tipos generados |
| 4 | Login page + AuthStore + AuthGuard + Logout |
| 5 | Backend endpoint `/branches/companies` + CompanyContextSwitcher + BranchSwitcher |
| 6 | NavMain + NavFavorites (drag&drop) + NavUser + CommandPalette + GlobalRateDisplay |
| 7 | usePermission + PermissionsGate + lib/permissions.ts + lib/navigation.ts + §10 responsive |
| 8 | 14 módulos stubs + pages wrappers |
| 9 | E2E tests + build + lint + typecheck + coverage |

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `npx shadcn@latest add` requiere red y puede fallar en contenedor | Documentar el fallback (instalación manual) en el plan |
| Conflictos de versión Next 16 + shadcn reciente | Usar `--legacy-peer-deps` si es necesario |
| Tests MSW con fetch wrapper requiere node-fetch polyfill en jsdom | Añadir `whatwg-fetch` o configurar Vitest con `environment: 'happy-dom'` |
| Drag&drop con @dnd-kit/core en React 19 puede tener issues | Verificar compatibilidad antes de implementar; alternativa: HTML5 native drag&drop |
| next-intl v3 vs v4 cambia API | Pin a versión conocida estable en package.json |
