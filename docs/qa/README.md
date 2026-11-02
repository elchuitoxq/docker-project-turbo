# Plan de pruebas visuales por tipo de usuario

Documentación de las pruebas manuales/visuales de flujo por rol, ejecutadas sobre el entorno
levantado con Docker. El objetivo es validar que **cada rol ve lo que debe ver, puede hacer lo que
debe poder hacer y no puede hacer nada más**, sin repetir la cobertura que ya existe en Playwright
([e2e/](../../e2e)) ni los flujos de administración.

## 1. Alcance

### En alcance

- Roles con flujo operativo: **MANAGER**, **SELLER**, **WAREHOUSE** y **ACCOUNTANT**.
- Navegación y menú derivados de permisos (`apps/frontend/lib/navigation.ts`).
- Flujos de escritura propios de cada rol (altas, ediciones, aprobaciones, pagos, asientos).
- Estados vacíos, filtros, búsquedas, mensajes de error y toasts.
- Aislamiento por sucursal (selector de empresa/sucursal y datos filtrados).
- Comportamiento responsive básico y accesibilidad mínima (foco, teclado, labels).

### Fuera de alcance

- **ADMIN** y **SUPER_ADMIN**: se consideran ya validados; sólo se usan como referencia de
  comportamiento esperado (menú completo, `core:branch:all`).
- Pruebas de rendimiento, carga y seguridad profunda (ver [docs/update/03-FASE-2-SEGURIDAD.md](../update/03-FASE-2-SEGURIDAD.md)).
- Automatización E2E nueva: la existente vive en `e2e/` y no se modifica.
- Módulos de nómina operativa (procesar/cerrar nómina): sólo ADMIN los ve con los usuarios
  sembrados; quedan como deuda de cobertura.

## 2. Entorno y puesta en marcha

| Recurso            | URL / valor                                     |
| ------------------ | ----------------------------------------------- |
| Frontend (Next.js) | <http://localhost:3000>                         |
| Backend (NestJS)   | <http://localhost:4000>                         |
| Swagger / OpenAPI  | <http://localhost:4000/docs>                    |
| Salud del backend  | <http://localhost:4000/health>                  |
| PostgreSQL (dev)   | `127.0.0.1:5432`, base `mydb`, usuario `myuser` |

```bash
# 1. Levantar el stack (db-setup aplica migraciones y `db:seed:dev`)
pnpm dev:docker:up
docker compose ps          # backend y frontend deben estar "healthy"

# 2. Verificación rápida
curl http://localhost:4000/health
curl -I http://localhost:3000

# 3. Si hace falta resembrar los datos de prueba (idempotente sobre las mismas claves)
docker compose exec backend pnpm --filter database db:seed:dev
```

> El servicio `db-setup` ejecuta `db:seed:dev`, es decir `seed-test.ts` sobre `mydb`
> ([scripts/dev-entrypoint.sh](../../scripts/dev-entrypoint.sh)). Por eso las cuentas de rol
> existen en la base de desarrollo.

### 2.1 Credenciales

Contraseña única: **`Test1234!`**

| Rol                                        | Correo                        |
| ------------------------------------------ | ----------------------------- |
| MANAGER                                    | `test-manager@test.local`     |
| SELLER                                     | `test-seller@test.local`      |
| WAREHOUSE                                  | `test-warehouse@test.local`   |
| ACCOUNTANT                                 | `test-accountant@test.local`  |
| ADMIN (referencia, fuera de alcance)       | `test-admin@test.local`       |
| SUPER_ADMIN (referencia, fuera de alcance) | `test-super-admin@test.local` |

Cada cuenta está asignada a **dos sucursales**, con `Test Branch` como predeterminada, y por tanto
el selector de contexto muestra dos empresas/sucursales.

**Idioma de la interfaz:** el menú de usuario permite `🇻🇪 Español (VE)` y `🇺🇸 English (US)`. El
valor por defecto es Español; si el navegador conserva una preferencia previa en `localStorage` la
UI puede aparecer en inglés. Fijar Español (VE) antes de ejecutar para que los textos coincidan con
los resultados esperados de este plan.

### 2.2 Baseline de datos (observado al 2026-10-30)

Los conteos son orientativos: si se resembró o se usaron seeds anteriores pueden variar. Lo que sí
debe cumplirse es la **presencia** de estos registros en `Test Branch`.

| Entidad                   | Registros visibles en `Test Branch`                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Clientes y proveedores    | 6 (incluye `Cliente Ejemplo C.A.`, `Proveedor Internacional`)                               |
| Productos                 | 11 (`ELEC-001` … `HOG-003`)                                                                 |
| Almacenes                 | 4 (`Almacén Principal Caracas`, `Depósito Sur`, `Punto de Venta Caracas`, `Test Warehouse`) |
| Stock                     | 11 filas con cantidades > 0                                                                 |
| Pedidos                   | 5 (`ORD-000001` … `ORD-000005`)                                                             |
| Facturas                  | 23 de venta (5 `INV-000001` … `INV-000005` + serie `A-900xx`) y 4 de compra                 |
| Pagos                     | 7                                                                                           |
| Empleados                 | 6 en total: 5 en `Test Branch` y 1 en `Casa Principal`                                      |
| Notas de crédito          | 2                                                                                           |
| Préstamos de equipos      | 3                                                                                           |
| Fondos de caja chica      | 2                                                                                           |
| Movimientos de inventario | **0** (ver preparación en [03-warehouse.md](./03-warehouse.md))                             |
| Nóminas (`payroll_runs`)  | 4 (fuera de alcance: ningún rol de prueba ve Nómina)                                        |

## 3. Matriz RBAC esperada: menú por rol

Derivada de `ROLE_PERMISSIONS` ([seed-rbac.ts](../../packages/database/src/scripts/seed-rbac.ts))
intersección con `NAV_ITEMS` ([navigation.ts](../../apps/frontend/lib/navigation.ts)).
`—` significa que el ítem no debe aparecer en el menú.

> **Verificada** contra la aplicación en ejecución el **2026-10-30** y **re-verificada el 2026-10-31**
> tras el ajuste del cargo MANAGER ([`S-14`](../sdd/specs/S-14-actuaciones-rol-manager.md)): con las
> cuatro cuentas de rol el sidebar renderizó exactamente las columnas de esta tabla.

| Sección / Ítem                             | Ruta                                         | Permiso                                                                        | MANAGER | SELLER | WAREHOUSE | ACCOUNTANT |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------ | :-----: | :----: | :-------: | :--------: |
| Panel                                      | `/dashboard`                                 | `dashboard:view`                                                               |    ✔    |   ✔    |     ✔     |     ✔      |
| **Operaciones** (grupo)                    | —                                            | `operations:view`                                                              |    ✔    |   ✔    |     —     |     ✔      |
| · Clientes y Proveedores                   | `/dashboard/operations/partners`             | `operations:partners:view`                                                     |    ✔    |   ✔    |     —     |     ✔      |
| · Ventas                                   | `/dashboard/operations/sales`                | `operations:sales:view`                                                        |    ✔    |   ✔    |     —     |     —      |
| · Compras                                  | `/dashboard/operations/purchases`            | `operations:purchases:view`                                                    |    ✔    |   —    |     —     |     ✔      |
| · Pedidos                                  | `/dashboard/operations/orders`               | `operations:orders:view`                                                       |    ✔    |   ✔    |     —     |     —      |
| **Inventario** (grupo)                     | —                                            | `inventory:view`                                                               |    ✔    |   ✔    |     ✔     |     ✔      |
| · Productos                                | `/dashboard/inventory/products`              | `inventory:products:view`                                                      |    ✔    |   ✔    |     ✔     |     ✔      |
| · Almacenes                                | `/dashboard/inventory/warehouses`            | `inventory:warehouses:view`                                                    |    —    |   —    |     ✔     |     —      |
| · Movimientos                              | `/dashboard/inventory/moves`                 | `inventory:moves:view`                                                         |    ✔    |   —    |     ✔     |     —      |
| · Stock                                    | `/dashboard/inventory/stock`                 | `inventory:products:view`                                                      |    ✔    |   ✔    |     ✔     |     ✔      |
| **Finanzas** (grupo)                       | —                                            | `finance:view`                                                                 |    ✔    |   ✔    |     —     |     ✔      |
| · Facturación                              | `/dashboard/finance/invoices`                | `finance:invoices:view`                                                        |    ✔    |   ✔    |     —     |     ✔      |
| · Cuentas por pagar                        | `/dashboard/finance/payables`                | `finance:invoices:view`                                                        |    ✔    |   ✔    |     —     |     ✔      |
| · Notas de crédito                         | `/dashboard/finance/credit-notes`            | `finance:credit-notes:view`                                                    |    ✔    |   —    |     —     |     ✔      |
| · Préstamos                                | `/dashboard/finance/loans`                   | `finance:loans:view`                                                           |    ✔    |   —    |     —     |     ✔      |
| · Tesorería                                | `/dashboard/finance/treasury`                | `finance:treasury:view`                                                        |    ✔    |   —    |     —     |     ✔      |
| · Cuentas bancarias                        | `/dashboard/finance/treasury/accounts`       | `finance:treasury:view`                                                        |    ✔    |   —    |     —     |     ✔      |
| · Conciliación                             | `/dashboard/finance/treasury/reconciliation` | `finance:treasury:view`                                                        |    ✔    |   —    |     —     |     ✔      |
| · Caja chica                               | `/dashboard/finance/treasury/petty-cash`     | `finance:treasury:view`                                                        |    ✔    |   —    |     —     |     ✔      |
| · Cierre diario                            | `/dashboard/finance/daily-close`             | `finance:view`                                                                 |    ✔    |   ✔    |     —     |     ✔      |
| · Retenciones                              | `/dashboard/finance/retentions`              | `finance:retentions:view`                                                      |    —    |   —    |     —     |     ✔      |
| · Contabilidad                             | `/dashboard/finance/accounting`              | `finance:accounts:view`                                                        |    ✔    |   —    |     —     |     ✔      |
| · Cierre contable                          | `/dashboard/finance/accounting/periods`      | `finance:close:view`                                                           |    ✔    |   —    |     —     |     ✔      |
| · Reportes                                 | `/dashboard/finance/reports`                 | `finance:reports:view`                                                         |    ✔    |   —    |     —     |     ✔      |
| **Recursos Humanos** (grupo)               | —                                            | `hr:view`                                                                      |    ✔    |   —    |     —     |     —      |
| · Empleados                                | `/dashboard/hr/employees`                    | `hr:employees:view`                                                            |    ✔    |   —    |     —     |     —      |
| · Cargos                                   | `/dashboard/hr/positions`                    | `hr:view`                                                                      |    ✔    |   —    |     —     |     —      |
| · Departamentos                            | `/dashboard/hr/departments`                  | `hr:view`                                                                      |    ✔    |   —    |     —     |     —      |
| · Nómina, Parámetros, Conceptos, Novedades | `/dashboard/hr/payroll`, …                   | `hr:payroll:view`, `hr:settings:view`, `hr:concepts:view`, `hr:incidents:view` |    —    |   —    |     —     |     —      |
| **Configuración** (sin permiso de grupo)   | —                                            | —                                                                              |    ✔    |   ✔    |     ✔     |     ✔      |
| · Usuarios y Roles                         | `/dashboard/settings/users`                  | `settings:users:view`                                                          |    —    |   —    |     —     |     —      |
| · Roles                                    | `/dashboard/settings/roles`                  | `settings:roles:view`                                                          |    —    |   —    |     —     |     —      |
| · Sucursales                               | `/dashboard/settings/branches`               | `settings:companies:view` \| `settings:branches:view`                          |    ✔    |   ✔    |     ✔     |     ✔      |
| · Bancos                                   | `/dashboard/settings/banks`                  | `settings:banks:view`                                                          |    ✔    |   —    |     —     |     ✔      |
| · Métodos de pago                          | `/dashboard/settings/methods`                | `finance:treasury:view`                                                        |    ✔    |   —    |     —     |     ✔      |
| · Monedas                                  | `/dashboard/settings/currencies`             | `settings:currencies:view`                                                     |    ✔    |   —    |     —     |     ✔      |
| · Impuestos                                | `/dashboard/settings/tax-concepts`           | `settings:taxes:view`                                                          |    ✔    |   —    |     —     |     ✔      |
| · Guía de parámetros legales               | `/dashboard/settings/payroll-guide`          | `hr:settings:view`                                                             |    —    |   —    |     —     |     —      |
| · Auditoría                                | `/dashboard/settings/audit`                  | `settings:users:view`                                                          |    —    |   —    |     —     |     —      |

Notas de lectura de la matriz:

- **SELLER** ve _Cierre diario_ y _Cuentas por pagar_ porque esos ítems reutilizan permisos que sí
  tiene (`finance:view` y `finance:invoices:view`). Es intencional según el catálogo actual; se
  valida que ambas vistas queden **de sólo lectura** (sin botones de acción).
- El grupo **Configuración** no declara permiso propio: siempre se muestra, y se filtra por ítem.
- Ningún rol de prueba ve _Usuarios y Roles_, _Roles_, _Auditoría_ ni _Guía de parámetros legales_.
- **Actualización del 2026-10-30 (`S-09`, decisiones D-02…D-07):** MANAGER y ACCOUNTANT suman
  _Compras_ (`operations:purchases:view`), y MANAGER suma _Reportes_ (`finance:reports:view`);
  MANAGER y ACCOUNTANT suman _Monedas_ (`settings:currencies:view`, sólo lectura: el override y el
  refresh exigen `settings:currencies:manage`, que queda en ADMIN/SUPER_ADMIN). MANAGER también
  recibe `operations:partners:statement`, `finance:invoices:create` y `finance:payments:void`.
  Matriz re-verificada en la app en ejecución: con MANAGER el sidebar mostró _Compras_, _Reportes_ y
  _Monedas_, y la pantalla de monedas abrió en modo lectura.

## 4. Convenciones

### Identificadores

| Prefijo | Documento                                |
| ------- | ---------------------------------------- |
| `CT-xx` | [00-transversal.md](./00-transversal.md) |
| `MG-xx` | [01-manager.md](./01-manager.md)         |
| `SL-xx` | [02-seller.md](./02-seller.md)           |
| `WH-xx` | [03-warehouse.md](./03-warehouse.md)     |
| `AC-xx` | [04-accountant.md](./04-accountant.md)   |

### Estados de ejecución

- **OK**: coincide con el resultado esperado.
- **FALLA**: no coincide (abrir defecto con severidad).
- **BLOQ.**: no se pudo ejecutar (dato faltante, entorno, dependencia).
- **N/A**: el caso dejó de aplicar (documentar por qué).

### Severidad de defectos

| Severidad        | Criterio                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **S1 – Crítico** | Fuga de datos entre sucursales/roles, acción permitida sin permiso, pérdida de datos.    |
| **S2 – Alto**    | Flujo del rol no se puede completar, error 5xx, importe/estado incorrecto.               |
| **S3 – Medio**   | Elemento visible que no debería, acción sin efecto, mensaje confuso, validación ausente. |
| **S4 – Bajo**    | Cosmético: alineación, textos, iconografía, estados vacíos pobres.                       |

### Evidencia

Guardar capturas en `docs/qa/evidencias/<rol>/<ID>-<descripcion>.png` y referenciarlas en la
bitácora de ejecución ([05-plantilla-ejecucion.md](./05-plantilla-ejecucion.md)).

## 5. Criterios de entrada y salida

**Entrada**

- `docker compose ps` con `backend` y `frontend` en estado `healthy`.
- Las cuatro cuentas de rol inician sesión correctamente.
- Datos semilla presentes según el baseline de la sección 2.2.

**Salida**

- Todos los casos `CT-*` ejecutados y con estado.
- Cada rol con sus casos ejecutados; ningún `BLOQ.` sin justificación.
- Defectos S1 y S2 con ticket abierto y evidencia.
- Resumen por rol completado en la bitácora.

## 6. Hallazgos previos a confirmar en la ejecución

Detectados por lectura de código antes de ejecutar. **No abrir defecto duplicado**: confirmarlos
visualmente y marcarlos como _conocidos_ en la bitácora, con su ID de defecto si ya existe ticket.
Los hallazgos 1, 2, 3, 5, 6, 7 y 10 ya están corregidos y verificados (ver §7); el resto sigue vigente.

| #   | Observación                                                                                                                                                                                                                             | Dónde                                                                                                                                                                              | Qué esperar al probar                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Botón "Nueva" de Facturación sin acción (no abre formulario)                                                                                                                                                                            | [invoices-view.tsx](../../apps/frontend/modules/finance/components/invoices-view.tsx)                                                                                              | Click no produce nada; no hay alta de factura desde Finanzas.                                                                                 |
| 2   | "Nueva venta" en Ventas apunta a la misma lista                                                                                                                                                                                         | [sales/page.tsx](<../../apps/frontend/app/(dashboard)/dashboard/operations/sales/page.tsx>)                                                                                        | Navega a la misma vista; no existe formulario de venta.                                                                                       |
| 3   | "Nuevo pago" en Tesorería sin acción                                                                                                                                                                                                    | [treasury-view.tsx](../../apps/frontend/modules/finance/components/treasury-view.tsx)                                                                                              | Click no produce nada; los pagos se registran desde Cuentas por pagar.                                                                        |
| 4   | Bancos, Impuestos y Monedas son stubs "Pendiente de implementación"                                                                                                                                                                     | [module-stub.tsx](../../apps/frontend/components/layout/module-stub.tsx)                                                                                                           | Muestran sólo el endpoint de referencia.                                                                                                      |
| 5   | Estados/tipos de movimientos de inventario desalineados: backend `EN_TRAMITE`/`ENTRADA`/`SALIDA`/`TRANSFERENCIA` vs UI `DRAFT`/`IN`/`OUT`/`TRANSFER`/`ADJUSTMENT`                                                                       | [moves-view.tsx](../../apps/frontend/modules/inventory/components/moves-view.tsx), [inventory.dto.ts](../../apps/backend/src/modules/inventory/dto/inventory.dto.ts)               | Badges de estado/tipo vacíos y contadores en 0 aunque existan movimientos.                                                                    |
| 6   | Pedidos siempre vacío: `GET /v1/orders` devuelve un **array** y el cliente espera `{data,…}`; además los estados sembrados (`COMPLETED`, `PROCESSING`) no están en el mapa de la UI                                                     | [orders-view.tsx](../../apps/frontend/modules/orders/orders-view.tsx), [orders-api.ts](../../apps/frontend/modules/orders/orders-api.ts)                                           | Confirmado el 2026-10-30: "0 pedidos" con 5 pedidos en la sucursal.                                                                           |
| 7   | `/dashboard/bi` no está en el menú, hereda el requisito de `/dashboard` y **falla en runtime**: `(kpis ?? []).slice is not a function`                                                                                                  | [dashboard-view.tsx](../../apps/frontend/modules/bi/components/dashboard-view.tsx)                                                                                                 | Confirmado el 2026-10-30: cualquier rol abre la URL y ve "This page couldn't load". Defecto S2.                                               |
| 8   | Cierre diario se habilita con `finance:treasury:create_account`; Reportes usa `finance:retentions:view` para libros                                                                                                                     | [daily-close-view.tsx](../../apps/frontend/modules/finance/components/daily-close-view.tsx), [reports-view.tsx](../../apps/frontend/modules/finance/components/reports-view.tsx)   | Permisos distintos a los que sugiere el módulo; validar que sólo los roles esperados ven la acción.                                           |
| 9   | Los KPI del Panel enlazan a módulos que algunos roles no pueden ver                                                                                                                                                                     | [dashboard-home.tsx](../../apps/frontend/modules/dashboard/components/dashboard-home.tsx)                                                                                          | WAREHOUSE/SELLER/ACCOUNTANT terminan en `/forbidden`.                                                                                         |
| 10  | "Estado de cuenta" exige `operations:partners:statement`, pero la acción se oculta **sin** bloquear el acceso: el nombre del partner enlaza siempre a `/statement` y `GET /v1/treasury/statements/:partnerId` sólo exige `finance:view` | [partners-table.tsx](../../apps/frontend/modules/partners/components/partners-table.tsx), [treasury.controller.ts](../../apps/backend/src/modules/treasury/treasury.controller.ts) | Confirmado el 2026-10-30: con MANAGER el endpoint responde `200` y muestra saldos del partner. Evaluar como defecto de permisos (S2).         |
| 11  | No hay UI para crear movimientos de inventario (sólo aprobar/cancelar)                                                                                                                                                                  | [moves-view.tsx](../../apps/frontend/modules/inventory/components/moves-view.tsx)                                                                                                  | WAREHOUSE necesita datos preparados por API para el caso WH-05.                                                                               |
| 12  | Base de desarrollo con datos acumulados de seeds previos (facturas `A-900xx`, empresas extra)                                                                                                                                           | `mydb`                                                                                                                                                                             | Los conteos pueden diferir del baseline; validar invariantes, no números exactos.                                                             |
| 13  | La tasa BCV del entorno está **vencida** (`Bs 36,50` del 06/06/2026)                                                                                                                                                                    | sidebar / `GlobalRateDisplay`                                                                                                                                                      | Al registrar un pago se muestra el paso de confirmación de tasa (`StaleRateGate`); no es un defecto, es el comportamiento esperado del flujo. |

## 7. Sesiones ejecutadas

| Fecha      | Rol             |  Casos   | Resultado                                                                                       | Bitácora                                                                             |
| ---------- | --------------- | :------: | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 2026-10-30 | MANAGER         |    24    | 8 OK · 11 FALLA · 5 BLOQ. → tras correcciones: 21 OK · 3 BLOQ.                                  | [2026-10-30-manager.md](./ejecuciones/2026-10-30-manager.md)                         |
| 2026-10-31 | TODOS (6 roles) | 38 rutas | Semilla coherente (44 reglas) · 14 defectos corregidos · flujos venta y compra de punta a punta | [2026-10-31-integridad-y-flujos.md](./ejecuciones/2026-10-31-integridad-y-flujos.md) |

Hallazgos sistémicos de esa sesión (detalle y severidad en la bitácora):

1. **Altas con números como texto** → `400 must be a number` (partners, productos).
2. **Listados vacíos por contrato `{data}` vs array** (pedidos, productos, pagos, empleados).
3. **Altas sin `branchId`** (nota de crédito `400`; cuenta bancaria con `branch_id` NULL e invisible).
4. **Pago con doble conversión** (S1): USD 100 sobre saldo 1.040 deja `paid_amount` 3.650 y saldo -2.610.
5. **Stock inaccesible** para MANAGER/SELLER/ACCOUNTANT (`403` en `/inventory/warehouses`).
6. **Estado de cuenta sin permiso** (`partners:statement` no se exige ni en UI ni en API).

### Correcciones aplicadas (2026-10-30)

| Hallazgo | Cambio                                                                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Los formularios envían números (`partner-dialog`, `products-view`) y los tipos de payload lo reflejan.                                                                                                      |
| 1        | `lib/api/client.ts` normaliza `message` string \| array y los hooks de partners/productos muestran el error del backend.                                                                                    |
| 2        | `productsApi`, `ordersApi`, `hrApi.listEmployees` y `treasuryApi.listPayments` aceptan arreglo u objeto paginado (mismo patrón que `partnersApi`); `ordersApi` mapea `date`→`orderDate` y `total` numérico. |
| 2        | Estados de pedidos alineados al backend (`DRAFT/CONFIRMED/PROCESSING/COMPLETED/CANCELLED`) con fallback; las facturas muestran `CANCELLED` como "Anulada".                                                  |
| 3        | `CreateCreditNoteDto.branchId` pasa a opcional y el servicio exige la sucursal del header; `POST /treasury/bank-accounts` toma `x-branch-id` y lo persiste.                                                 |
| 4        | La asignación de pagos usa la tasa del documento cuando pago y factura comparten moneda.                                                                                                                    |
| 5        | Nuevo `GET /v1/inventory/warehouses/options` con `inventory:products:view`; la pantalla de Stock lo usa para el selector.                                                                                   |
| 6        | `GET /v1/treasury/statements/:partnerId` exige `operations:partners:statement`; la tabla de partners deja de enlazar el nombre sin ese permiso.                                                             |
| —        | Los listados resuelven el nombre del tercero: facturas, pedidos y pagos incluyen `partnerName`; notas de crédito incluyen `type` e `invoiceId`; productos resuelven la categoría.                           |
| —        | El diálogo de préstamo usa combobox de productos y es desplazable (`max-h-[85vh]`).                                                                                                                         |

Cobertura de la corrección: `pnpm --filter backend typecheck`, 1050 tests de backend,
`pnpm --filter frontend typecheck`, 282 tests de frontend y `eslint` sin errores.

### Segunda ronda: TypeScript 7 y pendientes (2026-10-30)

| Cambio                       | Detalle                                                                                                                                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript 7.0.2**         | `@typescript/native` (npm alias de `typescript@7.0.2`) aporta el `tsc`; `typescript` apunta a `npm:@typescript/typescript6@6.0.2` para que `typescript-eslint`, `openapi-typescript` y Next sigan teniendo API de compilador. Aplicado al espacio de trabajo completo. |
| `tsconfig`                   | Backend pasa a `module`/`moduleResolution: nodenext` (TS 7 eliminó `node10`) y se retiró `ignoreDeprecations`; `packages/shared-types` declara `rootDir`; `packages/database` emite declaraciones y su `types` apunta a `dist/index.d.ts`.                             |
| Hallazgo #7 (BI)             | `/dashboard/bi` redirige a `/dashboard`; se eliminó el panel duplicado que rompía en runtime.                                                                                                                                                                          |
| Hallazgos #1/#2/#3 (botones) | Se retiraron los botones sin flujo: "Nueva venta" (Ventas), "Nueva" (Facturación) y "Nuevo pago" (Tesorería).                                                                                                                                                          |
| Hallazgo #5 (movimientos)    | La API normaliza `ENTRADA/SALIDA/TRANSFERENCIA` y `EN_TRAMITE/REJECTED`; el listado incluye producto, SKU, almacén y cantidades. Se corrigió `CreateInventoryMoveDto` (usaba el DTO de respuesta, por lo que `POST /inventory/moves` devolvía 400).                    |
| Préstamos                    | El listado resuelve el nombre del tercero desde el catálogo (sin UUID crudo).                                                                                                                                                                                          |

Cobertura tras la segunda ronda: `tsc` 7.0.2 en los cinco paquetes, 1050 tests de backend, 282 de
frontend, `eslint` sin errores y `pnpm build` (database + shared-types + Nest + Next) correcto.

### Tercera ronda: auditoría de UI pendiente y multimoneda (2026-10-30)

Auditoría de las pantallas que la suite MANAGER no llegó a ejercitar (el backend tiene el flujo y la UI
no) y del requisito **multimoneda** acordado en `S-08`. El plan de ejecución es
[`docs/sdd/specs/S-09-ui-flujos-manager.md`](../sdd/specs/S-09-ui-flujos-manager.md) (épica E9,
tareas `T-09-01…T-09-34`).

Procesos del MANAGER con UI incompleta:

| Proceso              | Estado de la UI                          | Falta                                                    |
| -------------------- | ---------------------------------------- | -------------------------------------------------------- |
| Pedidos              | lista + detalle                          | crear, editar, confirmar, cancelar y facturar            |
| Ventas / Facturación | lista, sin alta                          | formulario de emisión con moneda y tasa                  |
| Tesorería            | pagos listados (sólo se crean desde CxP) | cobro/pago manual y anulación con permiso propio         |
| Cuentas bancarias    | alta                                     | editar, desactivar y moneda de la cuenta                 |
| Clientes             | alta/edición                             | `creditDays`, desactivar y estado de cuenta              |
| Productos            | alta/edición                             | moneda del precio y desactivar                           |
| Monedas y tasas      | `ModuleStub`                             | tasa vigente, historial, override auditado y refresh BCV |
| Bancos e Impuestos   | `ModuleStub`                             | listas reales                                            |
| Reportes             | libros con CSV en moneda funcional       | columnas VES + USD y tasa de corte en pantalla           |

Brechas multimoneda confirmadas: `formatCurrency()` tiene **USD** por defecto (74 de 80 llamadas
de la app muestran el monto con el símbolo equivocado), `formatDual()` sólo se usa en el diálogo de pago de CxP,
ningún formulario permite elegir moneda o ver la tasa aplicada, ningún rol salvo ADMIN/SUPER_ADMIN
tiene `settings:currencies:view` y `/reports/summary` ya devuelve `usd` + `closingRate` sin que ninguna
pantalla lo consuma.

Defectos nuevos que la suite no alcanzó (`DEF-015…DEF-020`, detalle en `S-09` §2.2): la baja de producto
es un no-op silencioso, "anular pago" usa el permiso de facturas, conciliación y cierre diario usan
`treasury:create_account`, y la spec `S-08` documenta un endpoint y un permiso que no existen.

`DEF-024`: los listados de **Ventas** y **Facturación** mostraban **la fecha de hoy en todas las filas**
porque leían `invoice.issueDate`, campo que el API no devuelve (envía `date`). Corregido al implementar
las fichas (2026-10-30): la columna y la ficha muestran la fecha real del documento.

#### Avance de ejecución `S-09` (2026-10-30)

Ya implementado y verificado en vivo con MANAGER:

| Cambio                          | Evidencia                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Moneda obligatoria al formatear | `formatMoney(monto, código)`; 74 llamadas corregidas con el catálogo de monedas. Un monto sin moneda no compila.                           |
| Monto dual en documentos        | Factura USD 119,48 se ve "USD 119,48 · Bs.S 4.361,02"; las facturas en VES muestran sólo su monto (sin equivalente inventado).             |
| Moneda y tasa en el listado     | Facturación muestra columnas _Moneda_ y _Tasa_ y agrega "Total facturado (VES)" en moneda funcional (`total × exchangeRate`).              |
| Tasa en el sidebar              | Badge "Manual · vencida · Bs 36.50 · hace 147 d" desde `GET /v1/health/rates` (fuente + antigüedad + estado).                              |
| Pantalla _Monedas y tasas_      | Deja de ser stub: moneda funcional, tasa vigente con fuente/edad, tabla de monedas, historial y (sólo ADMIN) override y refresh BCV.       |
| RBAC D-02…D-07                  | MANAGER: Compras, Reportes, Monedas, estado de cuenta, `invoices:create`, `payments:void`. ACCOUNTANT: Compras, Monedas, `payments:void`.  |
| `DEF-021` / `DEF-022`           | Las tarjetas de Facturación ya muestran conteos reales y el total se agrega en moneda funcional (antes `NaN` y suma de monedas mezcladas). |

Cobertura: `pnpm typecheck` (6 paquetes), `eslint` sin errores, **1080** tests de backend y **335** de
frontend. La factura creada para la prueba se revirtió por SQL.

Evidencia: [2026-10-30-multimoneda.png](./evidencias/manager/2026-10-30-multimoneda.png) — sidebar con
"Manual · vencida · Bs 36.50 · hace 147 d", menú con _Compras_ y _Monedas_, y Facturación con columna
_Moneda_ y totales en moneda funcional.

#### Fichas de documento `S-10` (2026-10-30)

Primera fase de las vistas de detalle (`E10`): **Facturación** y **Ventas** ya abren su ficha.

| Cambio                               | Evidencia                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /billing/invoices/:id` ampliado | `currencyCode`, sucursal, almacén, pedido de origen, autor, `daysOverdue`, `settlement` (total/pagado/acreditado/retenido/saldo) y `payments/creditNotes/retentions`. |
| `GET /orders/:id` ampliado           | RIF y nombre del tercero, almacén, moneda, autor, SKU/nombre de producto y la factura que generó (`invoiceCode`).                                                     |
| Rutas de ficha                       | `/dashboard/finance/invoices/[id]` y `/dashboard/operations/sales/[id]`; una compra en la ruta de ventas muestra "no corresponde a esta pantalla".                    |
| Acciones en la ficha                 | Postear (sólo borrador), anular con motivo (sólo emitida) e imprimir; ocultas por permiso, deshabilitadas con motivo por estado.                                      |
| `DEF-024` corregido                  | Las columnas de fecha mostraban hoy en todas las filas; ahora muestran la fecha real (`A-90020` = 28/10/2026).                                                        |

Comprobado en vivo: `A-90005` (compra en USD) muestra Proveedor Internacional, retenciones IVA/ISLR y
**saldo USD 800**; `A-90020` abre en Ventas con líneas `TEST-SKU-001 · Test Product` y total en `Bs.S`.
Evidencia: [2026-10-30-ficha-venta.png](./evidencias/manager/2026-10-30-ficha-venta.png).
Cobertura: +5 tests de integración (`document-detail.test.ts`) y +5 de componentes; 1085 backend / 340 frontend.

#### Fichas en Compras, Pedidos e impresión `S-10` (2026-10-30)

| Cambio                                     | Evidencia                                                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ficha de **Compras**                       | `/operations/purchases/:id` abre `A-90003` con "Factura del proveedor 00005555", líneas, saldo y retenciones.                                                                     |
| Enlaces cruzados                           | Compras y Cuentas por pagar enlazan la factura; el pedido enlaza su factura y la factura enlaza su pedido de origen.                                                              |
| Ficha de **Pedidos**                       | `/operations/orders/:id` con líneas, total dual y acciones por estado.                                                                                                            |
| **Facturar pedido** (backend, era un stub) | `POST /orders/:id/invoice` crea la factura con la moneda y tasa del pedido, la enlaza y deja el pedido `COMPLETED`; `409` si se repite. Verificado: `ORD-FICHA-5023` → `A-90021`. |
| **Impresión**                              | `@media print` oculta sidebar, separador, barra superior y acciones; el documento ocupa todo el ancho (probado con `emulateMedia('print')` en la app compilada).                  |
| **JSON fiscal**                            | Acción en la ficha de facturas emitidas, con el JSON del SENIAT en diálogo, copiar y descargar.                                                                                   |

Evidencia: [2026-10-30-ficha-pedido.png](./evidencias/manager/2026-10-30-ficha-pedido.png).
Cobertura: 1084 tests de backend (incluye facturación de pedido y rechazo de doble facturación), 340 de frontend.

#### Tablas de listado estandarizadas `S-11` (2026-10-30)

| Cambio                           | Evidencia                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Primitivos compartidos           | `components/list/list-table.tsx`: `ListCard`, `ListFilters`, `ListTh`, `ListTd`, `ListSkeletonRows`, `ListEmptyRow`, `ListRowActions`. |
| Siete tablas refactorizadas      | Clientes y proveedores, Productos, Stock, Pedidos, Ventas, Compras y Facturación.                                                      |
| Ritmo vertical uniforme          | Alto de fila **52 px** en las siete vistas (antes 39 px sin acciones y 53 px con ellas); encabezado de 40 px.                          |
| Filtros homogéneos               | `Select` de shadcn de 192×36 px en las cinco vistas con filtros; se eliminó el `<select>` nativo de Ventas.                            |
| Columnas responsive declarativas | `hide="md"`/`hide="lg"` en Vence/Moneda/Stock mínimo; verificado a 900 px (Moneda oculta, Vence visible).                              |
| Monto sin moneda corregido       | El límite de crédito de Clientes y proveedores usa `formatMoney(valor, baseCode)` (antes `toFixed(2)`).                                |

Cobertura: `tsc` sin errores, `eslint` 0 errores y **340** tests de frontend. Evidencia:
[2026-10-30-tablas.png](./evidencias/manager/2026-10-30-tablas.png) — Clientes y proveedores con la
tarjeta "Directorio", filas de 52 px, límite de crédito en moneda funcional y menú de acciones único.
Detalle en [`S-11`](../sdd/specs/S-11-estandarizacion-tablas.md).

#### Histórico de procesos `S-12` (2026-10-30)

Cada ficha (pedido, venta, compra y facturación) muestra ahora **quién hizo qué y cuándo**, y la cadena
viaja del pedido a la facturación.

| Cambio                            | Evidencia                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Tabla `document_events`           | Append-only con acción, estados de origen/destino, autor y sucursal; `parent_document_id` enlaza la factura con su pedido. |
| `GET /orders/:id`                 | Devuelve `history` con los pasos del pedido **y** los de su factura.                                                       |
| `GET /billing/invoices/:id`       | Devuelve la **misma** cadena, incluidos los pasos del pedido de origen.                                                    |
| `POST /billing/invoices/:id/void` | Acepta `{ reason }` y lo guarda en el histórico (`Factura anulada: Error en el precio`).                                   |
| `DocumentTimeline`                | Línea de tiempo con icono por acción, transición de estado, fecha con hora y usuario; oculta al imprimir.                  |
| Autor del pedido                  | `orders.user_id` se guarda al crear, así la ficha muestra "Registró" (antes salía `—`).                                    |
| Documentos previos                | La migración siembra el paso de creación de cada pedido y factura existentes con su fecha y autor reales.                  |
| `DEF-025` corregido               | El MANAGER creaba el borrador desde el pedido pero no podía emitirlo: se le otorgó `finance:invoices:post` (S-09, D-03).   |

Comprobado en vivo con el flujo `ORD-HIST-9002` → `A-90021`: 5 pasos (pedido creado, confirmado,
factura creada, pedido facturado, factura emitida) con el mismo autor y los mismos `id` de evento en
ambas fichas. Evidencia:
[2026-10-30-historico.png](./evidencias/manager/2026-10-30-historico.png). Cobertura: **1088** tests de
backend (4 nuevos en `document-history.test.ts`) y **359** de frontend (2 del componente y 2 de
`formatDateTime`). Los datos de la prueba se revirtieron por SQL.

Los formularios de alta (`T-09-15` y `T-09-10`, al final de este documento) alimentan la misma cadena:
el pedido creado desde la UI arranca su histórico con `ORDER_CREATED` firmado por quien lo registró.

#### Formularios de pedido y de factura `T-09-15` / `T-09-10` (2026-10-30)

Ya se puede crear un documento desde la interfaz: **Pedidos → "Nuevo pedido"** y **Facturación →
"Nueva factura"**. Ambos formularios comparten el editor de líneas y dejan el documento en borrador con
su primer paso en el histórico, así que la cadena `S-12` arranca desde la creación.

| Cambio                  | Evidencia                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProductCombobox`       | Búsqueda de producto por SKU o nombre contra el backend (el catálogo no se precarga entero).                                                                    |
| `LineItemsEditor`       | Producto + cantidad + precio (+ IVA en facturas); al elegir el producto se copian precio y tasa.                                                                |
| Moneda y tasa           | Moneda funcional por defecto; al elegir divisa se precarga la tasa vigente y aplica `StaleRateGate`.                                                            |
| Precio en otra moneda   | Si el producto está en USD y el documento en VES, el precio **no se copia**: se pide escribirlo en la moneda del documento.                                     |
| Vista previa de totales | Base + IVA + IGTF (3 %, sólo ventas en divisa) con la misma fórmula del backend.                                                                                |
| Pedido                  | Tipo venta/compra, tercero filtrado por tipo, almacén, fecha, moneda, tasa y líneas; código `ORD-AAAAMMDD-XXXX` generado en la UI.                              |
| Factura                 | Tipo, tercero, almacén, vencimiento opcional (el backend lo deriva de `creditDays`), moneda, tasa, líneas con IVA y número de factura del proveedor en compras. |
| Permisos                | El botón sólo aparece con `operations:orders:create` / `finance:invoices:create`; MANAGER y SELLER los tienen.                                                  |

Comprobado en vivo: pedido `ORD-20261030-KRVP` (Bs.S 7.300,00) creado desde el formulario → confirmado →
facturado, con los tres pasos firmados por Test Manager; y factura `A-90022` (USD 100 + IVA 16 + IGTF
3,48 = **USD 119,48 · Bs.S 4.361,02**) creada desde Facturación y emitida desde su ficha. Los datos se
revirtieron por SQL. Evidencia:
[2026-10-30-formulario-factura.png](./evidencias/manager/2026-10-30-formulario-factura.png).

Cobertura nueva: `computeDocumentTotals` (5 casos, incluido el 119,48 verificado en vivo),
`LineItemsEditor` (3 casos) y `lineFromProduct`. Pendiente `T-09-11`: el frontend todavía no recibe
`partners.creditDays`, así que el vencimiento se deja vacío y lo calcula el backend.

#### Controles de fecha unificados `S-13` (2026-10-31)

Las 27 apariciones de `<input type="date">` en 15 pantallas se sustituyeron por un único `DatePicker`
(`Popover` + `Calendar` de shadcn).

| Cambio                     | Evidencia                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DatePicker`               | Calendario en español (semana de lunes a domingo), valor `YYYY-MM-DD` sin corrimiento por zona horaria. |
| Formularios con `FormData` | Nómina, asientos, vacaciones/egreso y parámetros de nómina siguen enviando el mismo campo vía `hidden`. |
| Rangos                     | El "hasta" bloquea los días anteriores al "desde" (y al revés) y ambos se pueden limpiar.               |
| Validación                 | El período de nómina se valida en el `onSubmit`: un `hidden` no participa en la validación nativa.      |

Comprobado en vivo: en la ficha de facturación el vencimiento abre el calendario en "octubre 2026" y al
elegir el 15 el botón queda en `15/10/2026`; en Reportes el rango muestra `01/10/2026` – `31/10/2026`.
Evidencia: [2026-10-31-date-picker.png](./evidencias/manager/2026-10-31-date-picker.png). Cobertura: 6
pruebas nuevas del control (`date-picker.test.tsx`).

#### Cargo del MANAGER auditado `S-14` (2026-10-31)

El rol creció por decisiones sueltas y tres documentos lo describían distinto (`database-spec.md` §4.2
con 18 permisos, `01-manager.md` diciendo que no emite facturas, y el seed con 42). Se documentó el
cargo completo en [`S-14`](../sdd/specs/S-14-actuaciones-rol-manager.md) y se corrigieron seis
desajustes:

| Cambio                                 | Antes                                                      | Ahora                                                          |
| -------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Kardex visible                         | `GET /inventory/moves` → `403` y menú sin “Movimientos”    | MANAGER ve los movimientos de la sucursal                      |
| Aprobación del ajuste                  | Sólo WAREHOUSE (registraba y aprobaba)                     | MANAGER también aprueba y queda registrado **quién** aprobó    |
| Borrador de factura                    | Creaba el borrador y no podía corregirlo (`PATCH` → `403`) | Edita mientras esté en `DRAFT`                                 |
| Conciliación / caja chica / cierre día | Las tres colgaban de `finance:treasury:create_account`     | Permisos propios (`:reconcile`, `:petty-cash`, `:daily-close`) |
| Tests del cargo                        | —                                                          | `role-manager.test.ts` (12 casos): lo que hace y lo que no     |
| Documentación                          | Tres relatos incompatibles                                 | `database-spec.md`, `01-manager.md` y `S-14` alineados         |

Medido con la API real (45 rutas + 8 escrituras de tesorería): el MANAGER pasó de 42 a **48 permisos**
y de 36 a **37 rutas permitidas**; WAREHOUSE y SELLER siguen recibiendo `403` en todas las escrituras
de tesorería. Evidencia: [2026-10-31-movimientos-manager.png](./evidencias/manager/2026-10-31-movimientos-manager.png)
y [2026-10-31-monedas-manager.png](./evidencias/manager/2026-10-31-monedas-manager.png) (Monedas en
lectura, sin alta ni override).

#### Tasa oficial automática desde BCV `S-15` (2026-10-31)

La sincronización de la tasa estaba rota por cuatro motivos a la vez: el parser devolvía `6` (el `6`
de `class="col-sm-6"`), se leía la portada en vez de la página de tipo de cambio, el contenedor no
podía completar la cadena TLS de BCV y la guarda de variación impedía incluso el override manual.

| Cambio               | Antes                                                 | Ahora                                                             |
| -------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Lectura de la página | Primer número tras `id="dolar"` → **6**               | Bloque del dólar + `strong-tb` → **889,5754**                     |
| URL                  | Portada `bcv.org.ve`                                  | `BCV_API_URL` a la página de tipo de cambio oficial               |
| Certificado          | `UNABLE_TO_VERIFY_LEAF_SIGNATURE` desde el contenedor | Intermedio descargado por AIA y reintento **con verificación**    |
| Repetición           | Reescribía el día en cada corrida                     | `stored` / `unchanged` / `manual-override`                        |
| Override manual      | La guarda de 20 % también lo frenaba                  | Un manual **con motivo** entra siempre y queda auditado           |
| Cron                 | 08:00, sin interruptor ni logs                        | 09:00 y 17:00 (L-V, Caracas), `EXCHANGE_RATE_SYNC_ENABLED` y logs |

Verificado contra la página real: `POST /settings/currencies/refresh` → `201 stored · 889.5754`, la
segunda corrida → `201 unchanged · 889.5754`, y la tabla de Monedas muestra `USD 889,58 · BCV ·
31/10/2026 · hoy`. Evidencia:
[2026-10-31-tasa-bcv-cron.png](./evidencias/manager/2026-10-31-tasa-bcv-cron.png). Cobertura: 29
pruebas (`exchange-rate.service.test.ts` 24 y `cron.service.test.ts` 3, más 2 de los helpers TLS).

**Segunda pasada: el `Bs.S 36,50`.** Esa fila no era una tasa: la moneda funcional vale 1 contra sí
misma y el backend nunca la usa para convertir. Venía de la semilla (`seed-test.ts` declaraba el dólar
como funcional y guardaba `36,50` en VES) y se veía en tres sitios mal acoplados: el badge del sidebar
(`/health/rates` informaba la tasa de la funcional), la pantalla de Monedas (la mostraba como "tasa
vigente" e historial) y **CxP**, que pagaba una factura en divisa con la tasa de la fila de VES. Los
tres quedaron corregidos, la semilla alineada, y una migración (`0024`) borra esas filas en cualquier
entorno. Verificado: pedido en VES → tasa `1`; pedido y factura en USD → `889.5754`; CxP →
`USD 1.040,00 · Bs.S 925.158,42`. Evidencia:
[2026-10-31-cxp-tasa-documento.png](./evidencias/manager/2026-10-31-cxp-tasa-documento.png).

## 8. Índice

1. [00-transversal.md](./00-transversal.md) — sesión, menú, guard de rutas, sucursal, responsive.
2. [01-manager.md](./01-manager.md) — flujos de supervisión y operación.
3. [02-seller.md](./02-seller.md) — flujos de venta.
4. [03-warehouse.md](./03-warehouse.md) — flujos de inventario.
5. [04-accountant.md](./04-accountant.md) — flujos contables y de tesorería.
6. [05-plantilla-ejecucion.md](./05-plantilla-ejecucion.md) — bitácora, defectos y cierre.
7. [ejecuciones/2026-10-30-manager.md](./ejecuciones/2026-10-30-manager.md) — primera sesión ejecutada (MANAGER).
   7.1 [ejecuciones/2026-10-31-integridad-y-flujos.md](./ejecuciones/2026-10-31-integridad-y-flujos.md) — barrido de los seis roles, flujos completos y 14 defectos corregidos (S-16).
8. [../sdd/specs/S-09-ui-flujos-manager.md](../sdd/specs/S-09-ui-flujos-manager.md) — auditoría de UI
   pendiente y plan de ejecución con multimoneda (épica E9).
9. [../sdd/specs/S-10-vistas-detalle-documentos.md](../sdd/specs/S-10-vistas-detalle-documentos.md) —
   plan de fichas de pedido, venta, compra y factura (épica E10).
10. [../sdd/specs/S-11-estandarizacion-tablas.md](../sdd/specs/S-11-estandarizacion-tablas.md) —
    primitivos únicos de listado y estandarización de las siete tablas (épica E11).
11. [../sdd/specs/S-12-historico-procesos-documentos.md](../sdd/specs/S-12-historico-procesos-documentos.md)
    — histórico de procesos con autor y fecha, del pedido a la facturación (épica E12).
12. [../sdd/specs/S-13-controles-de-fecha.md](../sdd/specs/S-13-controles-de-fecha.md) — un único
    control de fecha (Date Picker) en toda la aplicación (épica E13).
13. [../sdd/specs/S-14-actuaciones-rol-manager.md](../sdd/specs/S-14-actuaciones-rol-manager.md) —
    qué hace y qué no hace el MANAGER, y auditoría de la cuenta de prueba (épica E14).
14. [../sdd/specs/S-15-sincronizacion-tasa-bcv.md](../sdd/specs/S-15-sincronizacion-tasa-bcv.md) —
    cron que lee la tasa oficial del dólar en la página del BCV (épica E15).
