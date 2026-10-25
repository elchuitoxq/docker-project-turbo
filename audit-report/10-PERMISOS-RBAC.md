# PERMISOS Y ROLES - SISTEMA RBAC/PBAC

## 1. Estructura de Permisos

### permissions (Tabla)

```typescript
permissions = pgTable("permissions", {
  id: uuid().primaryKey(),
  code: text().notNull().unique(),   // 'treasury:create_account'
  description: text(),
  module: text().notNull(),          // 'treasury', 'sales'
})
```

### Códigos de Permisos (packages/db/src/permissions.ts)

```typescript
PERMISSIONS = {
  // Dashboard
  DASHBOARD: { VIEW: "dashboard:view" },
  
  // Operaciones
  OPERATIONS: { 
    VIEW: "operations:view",
    PARTNERS: {
      VIEW: "operations:partners:view",
      CREATE: "operations:partners:create",
      EDIT: "operations:partners:edit",
      DELETE: "operations:partners:delete",
      STATEMENT: "operations:partners:statement",
    },
    SALES: {...},
    PURCHASES: {...}
  },
  
  // Inventario
  INVENTORY: {
    VIEW: "inventory:view",
    PRODUCTS: {...},
    WAREHOUSES: {...},
    MOVES: {...}
  },
  
  // Finanzas
  FINANCE: {
    VIEW: "finance:view",
    INVOICES: {...},
    TREASURY: {...},
    PAYMENTS: {...},
    RETENTIONS: {...},
    REPORTS: {...}
  },
  
  // RRHH
  HR: {
    VIEW: "hr:view",
    EMPLOYEES: {...},
    PAYROLL: {...},
    INCIDENTS: {...},
    SETTINGS: {...}
  },
  
  // Configuración
  SETTINGS: {
    VIEW: "settings:view",
    USERS: {...},
    ROLES: {...},
    BRANCHES: {...},
    BANKS: {...},
    CURRENCIES: {...},
    TAXES: {...}
  }
}
```

---

## 2. ALL_PERMISSIONS (Lista Plana)

```typescript
// flatten Permissions object to array
ALL_PERMISSIONS = [
  "dashboard:view",
  "operations:view",
  "operations:partners:view",
  "operations:partners:create",
  "operations:partners:edit",
  "operations:partners:delete",
  "operations:partners:statement",
  // ... todos los permisos
]
```

---

## 3. Roles por Defecto

```typescript
DEFAULT_ROLES = {
  ADMIN: [
    // Todos los permisos
    ...ALL_PERMISSIONS
  ],
  
  MANAGER: [
    "dashboard:view",
    "operations:view",
    "operations:partners:view",
    "operations:partners:create",
    "operations:partners:edit",
    "operations:sales:view",
    "operations:sales:create",
    "operations:sales:edit",
    "inventory:view",
    "inventory:products:view",
    "inventory:products:create",
    "inventory:products:edit",
    "finance:view",
    "finance:invoices:view",
    "finance:treasury:view",
    "finance:payments:view",
    "hr:view",
    "hr:employees:view",
    // No payroll process
  ],
  
  SELLER: [
    "dashboard:view",
    "operations:view",
    "operations:partners:view",
    "operations:sales:view",
    "operations:sales:create",
  ],
  
  WAREHOUSE: [
    "dashboard:view",
    "inventory:view",
    "inventory:products:view",
    "inventory:warehouses:view",
    "inventory:moves:view",
    "inventory:moves:create",
    "inventory:moves:approve",
  ],
  
  ACCOUNTANT: [
    "dashboard:view",
    "operations:view",
    "operations:partners:view",
    "inventory:view",
    "finance:view",
    "finance:invoices:view",
    "finance:treasury:view",
    "finance:payments:view",
    "finance:retentions:view",
    "finance:reports:view",
  ]
}
```

---

## 4. Roles (Tabla)

```typescript
roles = pgTable("roles", {
  id: uuid().primaryKey(),
  name: text().notNull().unique(),  // 'ADMIN', 'MANAGER', 'SELLER'
  description: text(),
})
```

---

## 5. usersRoles (Junction)

```typescript
usersRoles = pgTable("users_roles", {
  userId: uuid().references(() => users.id).notNull(),
  roleId: uuid().references(() => roles.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.roleId] }),
}))
```

---

## 6. Implementación Backend

### PermissionsGuard (common/guards/permissions.guard.ts)

```typescript
// Uso en controllers
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)  // ← Ambos guards
export class TreasuryController {
  @Post()
  @RequirePermission(PERMISSIONS.FINANCE.TREASURY.CREATE)
  create() { ... }
}
```

### Decorador @RequirePermission

```typescript
// common/decorators/permissions.decorator.ts

// Single permission
@RequirePermission(PERMISSIONS.FINANCE.PAYMENTS.VOID)

// Multiple (OR logic - access if has ANY)
@RequirePermission([PERM_A, PERM_B])

// ⚠️ Nota: NO verificar roles directamente
// ⚠️ SIEMPRE verificar permisos
```

### Lógica del Guard

```typescript
// permissions.guard.ts
canActivate(context) {
  const user = request.user;
  const requiredPermissions = this.reflector.get('permissions', context.getHandler());
  
  // OR logic: acceso si tiene AL MENOS UNO de los permisos
  return requiredPermissions.some(perm => user.permissions.includes(perm));
}
```

---

## 7. Implementación Frontend

### usePermission Hook (hooks/use-permission.ts)

```typescript
const usePermission = () => {
  const { user } = useAuthStore();
  
  const hasPermission = (permission: string): boolean => {
    return user?.permissions.includes(permission) ?? false;
  };
  
  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(p => hasPermission(p));
  };
  
  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(p => hasPermission(p));
  };
  
  return { hasPermission, hasAnyPermission, hasAllPermissions };
};

// Uso
const { hasPermission } = usePermission();

if (hasPermission(PERMISSIONS.FINANCE.PAYMENTS.VOID)) {
  <VoidPaymentButton />
}
```

### PermissionsGate Component (components/auth/permissions-gate.tsx)

```typescript
interface PermissionsGateProps {
  permission?: string | string[];
  anyPermission?: boolean;  // OR logic (default: true)
  allPermissions?: boolean; // AND logic
  children: ReactNode;
}

// Uso
<PermissionsGate permission={PERMISSIONS.FINANCE.INVOICES.CREATE}>
  <CreateInvoiceButton />
</PermissionsGate>

// OR
<PermissionsGate anyPermission={[PERM_A, PERM_B]}>
  <SomeButton />
</PermissionsGate>

// AND
<PermissionsGate allPermissions={[PERM_A, PERM_B]}>
  <ComplexButton />
</PermissionsGate>
```

### AuthGuard (components/auth/auth-guard.tsx)

```typescript
// Redirects to /login if not authenticated
// Redirects to /forbidden if authenticated but no permission
```

---

## 8. Navegación con Permisos

### lib/navigation.ts

```typescript
NAV_ITEMS = [
  {
    title: "Dashboard",
    url: "/dashboard",
    permission: PERMISSIONS.DASHBOARD.VIEW,
  },
  {
    title: "Operaciones",
    items: [
      {
        title: "Clientes",
        url: "/dashboard/operations/partners",
        permission: PERMISSIONS.OPERATIONS.PARTNERS.VIEW,
      },
      // ...
    ],
  },
  // ...
]
```

### Filtrado en Sidebar

```typescript
// app-sidebar.tsx
const filteredItems = NAV_ITEMS.filter(item => {
  if (!item.permission) return true;
  return hasPermission(item.permission);
});
```

---

## 9. Permisos por Sucursal

### users_branches (Tabla)

```typescript
usersBranches = pgTable("users_branches", {
  userId: uuid().references(() => users.id).notNull(),
  branchId: uuid().references(() => branches.id).notNull(),
  isDefault: boolean().default(false),
})
```

### BranchInterceptor (Backend)

```typescript
// common/interceptors/branch.interceptor.ts
// Extrae x-branch-id del header
// Valida acceso del usuario a esa sucursal
// Agrega branchId a request
// Filtra datos automáticamente por branchId
```

---

## 10. Manejo de 403

### forbidden/page.tsx

```typescript
// Página mostrada cuando:
// - Usuario autenticado pero sin permiso
// - Usuario intenta acceder a ruta restringida

// Opciones:
// 1. Redirect a /forbidden
// 2. Mostrar UI alternativa (ocultar botones)
// 3. Deshabilitar elementos sin mostrar error
```

---

## 11. Resumen de Permisos Completos

### Módulo Dashboard
| Permiso | Descripción |
|---------|-------------|
| `dashboard:view` | Ver dashboard |

### Módulo Operations
| Permiso | Descripción |
|---------|-------------|
| `operations:view` | Ver módulo |
| `operations:partners:view` | Ver clientes/proveedores |
| `operations:partners:create` | Crear |
| `operations:partners:edit` | Editar |
| `operations:partners:delete` | Eliminar |
| `operations:partners:statement` | Ver estados de cuenta |
| `operations:sales:view` | Ver ventas |
| `operations:sales:create` | Crear venta |
| `operations:sales:edit` | Editar venta |
| `operations:purchases:view` | Ver compras |
| `operations:purchases:create` | Crear compra |
| `operations:purchases:edit` | Editar compra |

### Módulo Inventory
| Permiso | Descripción |
|---------|-------------|
| `inventory:view` | Ver módulo |
| `inventory:products:view` | Ver productos |
| `inventory:products:create` | Crear producto |
| `inventory:products:edit` | Editar producto |
| `inventory:products:delete` | Eliminar producto |
| `inventory:warehouses:view` | Ver almacenes |
| `inventory:warehouses:create` | Crear almacén |
| `inventory:warehouses:edit` | Editar almacén |
| `inventory:moves:view` | Ver movimientos |
| `inventory:moves:create` | Crear movimiento |
| `inventory:moves:approve` | Aprobar movimiento |

### Módulo Finance
| Permiso | Descripción |
|---------|-------------|
| `finance:view` | Ver módulo |
| `finance:invoices:view` | Ver facturas |
| `finance:invoices:create` | Crear factura |
| `finance:invoices:edit` | Editar factura |
| `finance:invoices:post` | Emitir factura |
| `finance:invoices:void` | Anular factura |
| `finance:treasury:view` | Ver tesorería |
| `finance:treasury:create_account` | Crear cuenta |
| `finance:payments:view` | Ver pagos |
| `finance:payments:create` | Registrar pago |
| `finance:payments:void` | Anular pago |
| `finance:retentions:view` | Ver retenciones |
| `finance:reports:view` | Ver reportes |

### Módulo HR
| Permiso | Descripción |
|---------|-------------|
| `hr:view` | Ver módulo |
| `hr:employees:view` | Ver empleados |
| `hr:employees:create` | Crear empleado |
| `hr:employees:edit` | Editar empleado |
| `hr:employees:delete` | Eliminar empleado |
| `hr:payroll:view` | Ver nómina |
| `hr:payroll:process` | Procesar nómina |
| `hr:incidents:view` | Ver novedades |
| `hr:incidents:create` | Registrar novedad |
| `hr:settings:view` | Ver configuración |

### Módulo Settings
| Permiso | Descripción |
|---------|-------------|
| `settings:view` | Ver módulo |
| `settings:users:view` | Ver usuarios |
| `settings:users:create` | Crear usuario |
| `settings:users:edit` | Editar usuario |
| `settings:roles:view` | Ver roles |
| `settings:roles:manage` | Gestionar roles |
| `settings:branches:view` | Ver sucursales |
| `settings:branches:manage` | Gestionar sucursales |
| `settings:banks:view` | Ver bancos |
| `settings:banks:manage` | Gestionar bancos |
| `settings:currencies:view` | Ver monedas |
| `settings:currencies:manage` | Gestionar monedas |
| `settings:taxes:view` | Ver impuestos |
| `settings:taxes:manage` | Gestionar impuestos |

---

## 12. Permisos vs Roles

### Regla de Oro

> **NUNCA verificar roles en código. SIEMPRE verificar permisos.**

```typescript
// ❌ INCORRECTO
if (user.role === 'ADMIN') { ... }

// ✅ CORRECTO
if (hasPermission(PERMISSIONS.SETTINGS.USERS.MANAGE)) { ... }
```

### Por Qué

1. **Granularidad**: Permisos son más específicos
2. **Flexibilidad**: Un rol puede tener permisos específicos
3. **Mantenimiento**: Agregar permisos sin crear roles
4. **Seguridad**: No hay bypass por nombre de rol
