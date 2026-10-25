# BACKEND NESTJS - MÓDULOS COMPLETOS

## Resumen Ejecutivo

| Aspecto | Cantidad |
|---------|----------|
| Módulos principales | 20 |
| Controladores | 35 |
| Servicios | 40+ |
| DTOs | 25+ |

---

## 1. ACCOUNTING (Contabilidad)

```
accounting/
├── accounting.module.ts
├── accounting.service.ts
└── retentions.service.ts
```

**Controlador**: NO EXISTE (solo servicios, usado por otros módulos)

### AccountingService

```typescript
// accounting.service.ts - Métodos:
createEntry(data)                    // Crea asiento contable (Journal Entry)
ensureAccount(data)                  // Busca o crea cuenta por código
findMap(data)                        // Encuentra mapa contable según criterios
createEntryFromMap(data)             // Crea asiento usando mapa contable
createEntryForInvoice(invoiceId)     // Genera asiento para factura de VENTA
createEntryForInventoryMove(moveId)  // Genera asiento para movimiento de inventario
```

### RetentionsService

```typescript
// retentions.service.ts - Métodos:
calculateIVARetention(taxAmount, retentionRate)  // Calcula retención IVA
generateConsolidatedTxt(retentions)              // Genera TXT retenciones IVA
generateISLRXml(retentions)                     // Genera XML retenciones ISLR
createRetention(data, tx?)                       // Crea retención fiscal
findAllWithPagination(type, options)            // Lista con paginación
findByDateRange(startDate, endDate, type, branchId?, direction?) // Por rango
findOne(id)                                      // Obtiene una retención
```

---

## 2. AUDIT (Auditoría)

```
audit/
├── audit.controller.ts
├── audit.decorator.ts
├── audit.interceptor.ts
├── audit.module.ts
└── audit.service.ts
```

### AuditController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/audit/:entityTable/:entityId` | Obtiene historial de cambios de una entidad |

### AuditService

```typescript
logChange(data)                    // Registra un cambio
getLogsByEntity(entityTable, entityId)  // Logs por entidad
getProcessHistory(entityTable, entityId) // Historial consolidado
```

---

## 3. AUTH (Autenticación)

```
auth/
├── auth.controller.ts
├── auth.module.ts
├── auth.service.ts
├── jwt.strategy.ts
├── dto/login.dto.ts
└── guards/
    ├── jwt-auth.guard.ts
    └── roles.guard.ts
```

### AuthController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/login` | Inicia sesión y retorna JWT |

### AuthService

```typescript
validateUser(email, pass)  // Valida credenciales
login(user)               // Genera token JWT + perfil
```

### DTOs

```typescript
// login.dto.ts
LoginDto {
  email: string
  password: string
}
```

---

## 4. BI (Business Intelligence)

```
bi/
├── bi.controller.ts
├── bi.module.ts
├── bi.service.ts
└── dto/get-bi-stats.dto.ts
```

### BiController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/bi/kpis` | KPIs (ventas, compras,CxC, inventario, productos, pedidos) |
| GET | `/bi/chart` | Datos para gráfico financiero |
| GET | `/bi/activity` | Actividad reciente |

### BiService

```typescript
getKpis(branchId?, startDate?, endDate?)        // Calcula KPIs
getFinancialChart(branchId?, startDate?, endDate?) // Gráfico ingresos/gastos
getRecentActivity(branchId?, limit?)           // Actividad reciente
```

---

## 5. BILLING (Facturación)

```
billing/
├── billing.controller.ts
├── billing.module.ts
├── billing.service.ts
└── dto/
    ├── create-invoice.dto.ts
    └── find-invoices.dto.ts
```

### BillingController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/billing/invoices` | Crear factura (DRAFT) |
| GET | `/billing/invoices/stats` | Estadísticas |
| GET | `/billing/invoices/:id` | Detalle de factura |
| GET | `/billing/invoices/:id/fiscal-json` | JSON fiscal |
| POST | `/billing/invoices/:id` | Actualizar factura |
| GET | `/billing/invoices` | Listar con filtros |
| POST | `/billing/invoices/:id/post` | Emitir (DRAFT→POSTED) |
| POST | `/billing/invoices/:id/void` | Anular factura |

### BillingService (SNIPPET CRÍTICO)

```typescript
// billing.service.ts - Lógica de negocio clave

async createInvoice(data) {
  // Calcula totales con IVA e IGTF
  const totalBase = items.reduce((sum, item) => sum + item.total, 0);
  const totalTax = totalBase * (product.isExempt ? 0 : (product.taxRate || 16) / 100);
  
  // IGTF (3% sobre BASE + IVA si es moneda extranjera)
  let totalIgtf = 0;
  if (data.applyIgtf && currency.code !== 'VES') {
    totalIgtf = (totalBase + totalTax) * 0.03;
  }
}

async postInvoice(id, userId) {
  // 1. Genera código correlativo (A-00001)
  // 2. Afecta inventario (si es compra crea movimiento IN)
  // 3. Crea asiento contable via AccountingService
  // 4. Cambia status DRAFT → POSTED
}

async voidInvoice(id, userId, options) {
  // Anula factura y devuelve stock si aplica
  // Solo facturas POSTED pueden anularse
}
```

### DTOs

```typescript
// create-invoice.dto.ts
CreateInvoiceDto {
  partnerId: string
  currencyId: string
  type: 'SALE' | 'PURCHASE'
  invoiceNumber?: string  // Para compras
  warehouseId?: string
  orderId?: string
  items: Array<{
    productId: string
    quantity: number
    price: number
  }>
  applyIgtf?: boolean
}

// find-invoices.dto.ts  
FindInvoicesDto {
  page?: number
  limit?: number
  search?: string
  type?: 'SALE' | 'PURCHASE'
  status?: 'DRAFT' | 'POSTED' | 'PAID' | 'VOID'
  partnerId?: string
}
```

---

## 6. BRANCHES (Sucursales)

```
branches/
├── branches.controller.ts
├── branches.module.ts
├── branches.service.ts
└── dto/
    ├── create-branch.dto.ts
    └── update-branch.dto.ts
```

### BranchesController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/branches` | Crear sucursal |
| GET | `/branches` | Listar todas |
| GET | `/branches/:id` | Detalle |
| PATCH | `/branches/:id` | Actualizar |
| DELETE | `/branches/:id` | Desactivar |

---

## 7. CREDIT-NOTES (Notas de Crédito)

```
credit-notes/
├── credit-notes.controller.ts
├── credit-notes.module.ts
└── credit-notes.service.ts
```

### CreditNotesController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/credit-notes` | Crear NC |
| GET | `/credit-notes` | Listar |
| GET | `/credit-notes/:id` | Detalle |

### CreditNotesService

```typescript
create(data) {
  // 1. Valida factura asociada
  // 2. Calcula totales prorrateados
  // 3. Devuelve stock (movimiento OUT)
  // 4. Crea movimiento de inventario
}

findAll()     // Lista con partner e invoice
findOne(id)   // Con items y producto
```

---

## 8. CRON (Tareas Programadas)

```
cron/
├── bcv-scraper.service.ts
├── cron.controller.ts
└── cron.module.ts
```

### CronController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/cron/trigger-bcv` | Dispara scraping manual |

### BCVScraperService (SNIPPET CRÍTICO)

```typescript
// bcv-scraper.service.ts

@Cron('0 8-18/1 * * *')  // Cada hora de 8am a 6pm
async handleCron() {
  await this.scrapeRates();
}

async scrapeRates() {
  //Hace scrape de https://www.bcv.org.ve/
  // Extrae USD y EUR
  // Guarda en exchange_rates con source: 'BCV_SCRAPER'
  
  // ⚠️ FRAGIL: Si BCV cambia su HTML, rompe
  // ⚠️ RECOMENDACIÓN: Separar parsing, agregar cache Redis
}
```

---

## 9. DOCUMENTS (Enlaces Documentales)

```
documents/
├── documents.controller.ts
├── documents.module.ts
└── documents.service.ts
```

### DocumentsController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/documents/:id/flow` | Flujo de documentos relacionados |

### DocumentsService

```typescript
createLink(data)      // Crea enlace (Order→Invoice, Invoice→Payment)
getFlow(documentId)   // Grafo de documentos relacionados
```

---

## 10. HR (Recursos Humanos) - 11 Controladores, 15 Servicios

```
hr/
├── hr.module.ts
├── concepts/
│   ├── payroll-concepts.controller.ts
│   └── payroll-concepts.service.ts
├── controllers/
│   ├── benefits.controller.ts
│   ├── contracts.controller.ts
│   ├── departments.controller.ts
│   ├── employees.controller.ts
│   ├── job-positions.controller.ts
│   ├── payroll-incidents.controller.ts
│   ├── payroll-settings.controller.ts
│   ├── payroll.controller.ts
│   ├── profit-sharing.controller.ts
│   ├── terminations.controller.ts
│   └── vacations.controller.ts
├── services/
│   ├── bank-file-generator.service.ts
│   ├── benefits.service.ts
│   ├── compliance-reports.service.ts
│   ├── contracts.service.ts
│   ├── departments.service.ts
│   ├── employees.service.ts
│   ├── job-positions.service.ts
│   ├── payroll-export.service.ts
│   ├── payroll-incidents.service.ts
│   ├── payroll-pdf.service.ts
│   ├── payroll-settings.service.ts
│   ├── payroll.service.ts
│   ├── profit-sharing.service.ts
│   ├── terminations.service.ts
│   └── vacations.service.ts
└── dto/
    ├── benefit.dto.ts
    ├── contract.dto.ts
    ├── department.dto.ts
    ├── employee.dto.ts
    ├── job-position.dto.ts
    ├── payroll-incident.dto.ts
    ├── payroll-setting.dto.ts
    ├── payroll-settings.dto.ts
    ├── profit-sharing.dto.ts
    ├── termination.dto.ts
    └── vacation.dto.ts
```

### EmployeesController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/hr/employees` | Listar empleados |
| GET | `/hr/employees/:id` | Detalle |
| POST | `/hr/employees` | Crear |
| PUT | `/hr/employees/:id` | Actualizar |

### PayrollController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/hr/payroll` | Listar corridas |
| GET | `/hr/payroll/:id` | Detalle corrida |
| POST | `/hr/payroll/generate` | Generar nómina |
| POST | `/hr/payroll/:id/pay` | Procesar pago |
| PATCH | `/hr/payroll/:id/status` | Actualizar estado |
| GET | `/hr/payroll/:runId/payslip/:itemId` | Recibo individual |
| GET | `/hr/payroll/:runId/export/txt` | TXT banco |
| GET | `/hr/payroll/:runId/export/excel` | Excel |

### PayrollService (SNIPPET CRÍTICO - Lógica Venezuela)

```typescript
// payroll.service.ts

async generate(data) {
  // Para cada empleado activo:
  // 1. Busca incidencias en rango de fechas
  // 2. Calcula:
  //    - SALARY: Salario del período
  //    - CESTATICKET: Ticket Alimentación
  //    - SSO_EMP: Seguro Social (4%)
  //    - SSO_PAT: Seguro Social Patronal (9-11%)
  //    - FAOV_EMP: FAOV empleado (1%)
  //    - FAOV_PAT: FAOV patronal (2%)
  //    - PIE_EMP: Régimen Prestacional (0.5%)
  //    - PIE_PAT: RPE patrimonial (2%)
  // 3. Genera payroll_items con payroll_item_lines
}

async processPayment(id, data) {
  // 1. Valida saldo en bankAccount (cuenta empresa)
  // 2. Debita bankAccount.currentBalance
  // 3. Crea accounting entry
  // 4. Genera archivo TXT para banco
}
```

---

## 11. INVENTORY

```
inventory/
├── inventory.controller.ts
├── inventory.module.ts
├── inventory.service.ts
└── dto/
    ├── create-move.dto.ts
    ├── create-warehouse.dto.ts
    ├── find-moves.dto.ts
    ├── reject-move.dto.ts
    └── update-warehouse.dto.ts
```

### InventoryController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/inventory/warehouses` | Listar almacenes |
| POST | `/inventory/warehouses` | Crear almacén |
| PATCH | `/inventory/warehouses/:id` | Actualizar |
| GET | `/inventory/stock/:warehouseId` | Stock de almacén |
| GET | `/inventory/moves` | Listar movimientos |
| POST | `/inventory/moves` | Crear movimiento |
| PATCH | `/inventory/moves/:id/approve` | Aprobar |
| PATCH | `/inventory/moves/:id/reject` | Rechazar |

### InventoryService

```typescript
createMove(data) {
  // Transacción atómica:
  // 1. Valida stock suficiente (para OUT)
  // 2. Actualiza stock en warehouses
  // 3. Crea inventory_moves
  // 4. Crea inventory_move_lines
  // 5. Crea asiento contable via AccountingService
}
```

---

## 12. LOANS (Préstamos de Inventario)

```
loans/
├── loans.controller.ts
├── loans.module.ts
└── loans.service.ts
```

### LoansController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/loans` | Crear préstamo |
| GET | `/loans` | Listar préstamos |

---

## 13. ORDERS (Pedidos)

```
orders/
├── orders.controller.ts
├── orders.module.ts
├── orders.service.ts
└── dto/
    ├── create-order.dto.ts
    └── find-orders.dto.ts
```

### OrdersController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/orders` | Listar pedidos |
| GET | `/orders/stats` | Estadísticas |
| GET | `/orders/:id` | Detalle |
| POST | `/orders` | Crear pedido |
| POST | `/orders/:id/confirm` | Confirmar |
| POST | `/orders/:id/cancel` | Cancelar |
| POST | `/orders/:id/invoice` | Generar factura |
| POST | `/orders/:id/recalculate` | Recalcular totales |

---

## 14. PARTNERS (Clientes/Proveedores)

```
partners/
├── partners.controller.ts
├── partners.module.ts
├── partners.service.ts
└── dto/find-partners.dto.ts
```

### PartnersController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/partners` | Listar con filtros |
| GET | `/partners/:id` | Detalle |
| POST | `/partners` | Crear |
| PUT | `/partners/:id` | Actualizar |
| DELETE | `/partners/:id` | Eliminar |

---

## 15. PRODUCTS

```
products/
├── products.controller.ts
├── products.module.ts
├── products.service.ts
└── dto/
    ├── create-product.dto.ts
    └── update-product.dto.ts
```

### ProductsController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/products` | Crear |
| GET | `/products` | Listar |
| GET | `/products/:id` | Detalle |
| PATCH | `/products/:id` | Actualizar |

---

## 16. REPORTS (Reportes Fiscales)

```
reports/
├── fiscal-reports.controller.ts
├── fiscal-reports.module.ts
└── fiscal-reports.service.ts
```

### FiscalReportsController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/reports/fiscal/retenciones-txt` | TXT retenciones IVA |
| GET | `/reports/fiscal/retenciones-xml` | XML retenciones ISLR |
| GET | `/reports/fiscal/summary` | Resumen fiscal |
| GET | `/reports/fiscal/libro-ventas` | Libro de ventas |
| GET | `/reports/fiscal/libro-compras` | Libro de compras |
| GET | `/reports/fiscal/:type/export/excel` | Exporta libro |

### FiscalReportsService

```typescript
getLibroVentas(month, year, branchId?, fortnight?) {
  // ⚠️ CRÍTICO: Moneda es SIEMPRE VES
  // Conversión: invoice.totalBase * invoice.exchangeRate = VES
  // Columnas: Total Factura, Base Imponible, IVA (100%), IVA Retenido (75%/100%), N° Comprobante
}

getFiscalSummary(month, year, branchId?, fortnight?) {
  // Débito Fiscal - Crédito Fiscal = IVA a Pagar
}
```

---

## 17. ROLES

```
roles/
├── roles.controller.ts
├── roles.module.ts
├── roles.service.ts
└── dto/
    ├── assign-role.dto.ts
    ├── create-role.dto.ts
    └── update-role-permissions.dto.ts
```

### RolesController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/roles` | Crear rol |
| GET | `/roles` | Listar con permisos |
| GET | `/roles/permissions` | Todos los permisos |
| POST | `/roles/:id/permissions` | Actualizar permisos |
| POST | `/roles/assign` | Asignar rol a usuario |
| DELETE | `/roles/:id` | Eliminar rol |

---

## 18. SETTINGS (3 submódulos)

```
settings/
├── banks/
│   ├── banks.controller.ts
│   ├── banks.module.ts
│   └── banks.service.ts
├── currencies/
│   ├── currencies.controller.ts
│   ├── currencies.module.ts
│   └── currencies.service.ts
└── tax-concepts/
    ├── tax-concepts.controller.ts
    ├── tax-concepts.module.ts
    └── tax-concepts.service.ts
```

### BanksController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/settings/banks` | Listar |
| POST | `/settings/banks` | Crear |
| PUT | `/settings/banks/:id` | Actualizar |
| PATCH | `/settings/banks/:id/toggle` | Activar/Desactivar |

### CurrenciesController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/settings/currencies` | Listar monedas |
| POST | `/settings/currencies` | Crear |
| GET | `/settings/currencies/rates/latest` | Tasas recientes |
| POST | `/settings/currencies/rates` | Agregar tasa |

### TaxConceptsController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/settings/tax-concepts` | Listar conceptos |
| GET | `/settings/tax-concepts/:id` | Detalle |
| POST | `/settings/tax-concepts` | Crear |
| PUT | `/settings/tax-concepts/:id` | Actualizar |
| DELETE | `/settings/tax-concepts/:id` | Eliminar |

---

## 19. TREASURY (4 submódulos)

```
treasury/
├── treasury.module.ts
├── treasury.controller.ts
├── treasury.service.ts
├── bank-accounts.controller.ts
├── bank-accounts.service.ts
├── payment-methods.controller.ts
├── tax-retentions/
│   └── tax-retention.controller.ts
└── dto/
    ├── create-bank-account.dto.ts
    ├── create-payment-method.dto.ts
    ├── create-payment.dto.ts
    └── update-bank-account.dto.ts
```

### TreasuryController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/treasury/payments` | Registrar pago |
| POST | `/treasury/payments/:id/void` | Anular pago |
| GET | `/treasury/methods` | Listar métodos |
| POST | `/treasury/methods` | Crear método |
| PATCH | `/treasury/methods/:id` | Actualizar |
| POST | `/treasury/methods/:id/accounts` | Asociar cuentas |
| GET | `/treasury/payments` | Listar pagos |
| GET | `/treasury/statements/:partnerId` | Estado de cuenta |
| GET | `/treasury/daily-close` | Cierre diario |
| GET | `/treasury/available-credit-notes` | NC disponibles |

### BankAccountsController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/treasury/bank-accounts` | Listar cuentas |
| GET | `/treasury/bank-accounts/:id` | Detalle |
| POST | `/treasury/bank-accounts` | Crear |
| PUT | `/treasury/bank-accounts/:id` | Actualizar |
| PATCH | `/treasury/bank-accounts/:id/toggle` | Activar/Desactivar |

### TreasuryService (SNIPPET CRÍTICO - voidPayment 8 pasos)

```typescript
// treasury.service.ts

async voidPayment(paymentId, branchId?, userId?) {
  // PASO 1: Validar Credit Notes hijos no estén gastados
  // PASO 2: Revertir bankAccount.currentBalance
  // PASO 3: Liberar creditNoteUsages si el pago usó NC
  // PASO 4: Eliminar Credit Notes hijos ( NC de sobrepago)
  // PASO 5: Limpiar taxRetentionLines y recalcular totals
  // PASO 6: Eliminar paymentAllocations
  // PASO 7: Limpiar documentLinks
  // PASO 8: Reabrir invoices (PAID→PARTIALLY_PAID o POSTED)
}
```

---

## 20. USERS

```
users/
├── users.controller.ts
├── users.module.ts
├── users.service.ts
└── dto/
    ├── create-user.dto.ts
    └── update-user.dto.ts
```

### UsersController

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/users` | Crear usuario |
| GET | `/users` | Listar |
| GET | `/users/:id` | Detalle |
| PATCH | `/users/:id` | Actualizar (roles, sucursales) |
| DELETE | `/users/:id` | Eliminar |

---

## Resumen de Endpoints por Módulo

| Módulo | Endpoints | Notas |
|--------|-----------|-------|
| auth | 2 | Login, refresh |
| users | 5 | CRUD |
| roles | 6 | CRUD + assign |
| partners | 5 | CRUD |
| products | 4 | CRUD |
| orders | 8 | CRUD + confirm/cancel/invoice |
| billing | 8 | CRUD + post/void |
| credit-notes | 3 | CRUD |
| inventory | 8 | Warehouses + moves |
| treasury | 11+ | Payments, methods, accounts, statements |
| hr | 25+ | 11 controladores |
| accounting | 0 | Sin controlador público |
| reports | 6 | Fiscales |
| branches | 5 | CRUD |
| settings | 12+ | banks, currencies, tax-concepts |
| bi | 3 | KPIs, charts |
| audit | 1 | Logs por entidad |
| documents | 1 | Flujo documental |
| loans | 2 | CRUD |
| cron | 1 | Trigger manual BCV |
