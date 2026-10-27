# Base de Datos - Catálogo de Tablas

> **Estado de este documento:** Catálogo histórico, no definición ejecutable.
> La fuente de verdad de tablas, columnas y relaciones es
> [`packages/database/src/schema.ts`](../packages/database/src/schema.ts), junto
> con las migraciones en `packages/database/drizzle/`. Confirmar allí cualquier
> nombre o tipo antes de escribir consultas o migraciones.
> El estado de implementación y pruebas se mantiene en
> [`PROJECT-STATUS.md`](./PROJECT-STATUS.md). Las tablas y columnas que siguen
> se recopilaron históricamente y algunas entradas aún pueden no reflejar el
> schema actual; en especial, `companies` y `branches` fueron actualizadas tras
> la migración `0003`.

---

## 📋 Resumen de Esquemas

| Esquema              | Tablas | Descripción                                     |
| -------------------- | ------ | ----------------------------------------------- |
| **Security & Audit** | 8      | RBAC, usuarios, permisos, auditoría             |
| **Core**             | —      | Empresas, sucursales, monedas, tasas, partners  |
| **Inventory**        | 7      | Almacenes, productos, stock, movimientos        |
| **Orders & Billing** | 7      | Pedidos, facturas, notas de crédito             |
| **Treasury**         | 7      | Pagos, métodos, cuentas, retenciones            |
| **HR**               | 15     | Empleados, nóminas, contratos                   |
| **Accounting**       | 4      | Plan de cuentas, asientos                       |
| **Loans**            | 2      | Préstamos                                       |
| **Total**            | —      | Consultar `schema.ts` para el inventario actual |

---

## 🔐 Security & Audit

### `audit_logs`

Log de auditoría para todas las operaciones del sistema.

| Columna        | Tipo         | Descripción                         |
| -------------- | ------------ | ----------------------------------- |
| `id`           | uuid         | PK                                  |
| `user_id`      | uuid         | FK → users                          |
| `action`       | varchar(100) | CREATE, UPDATE, DELETE, LOGIN, etc. |
| `entity_table` | varchar(100) | Tabla afectada                      |
| `entity_id`    | uuid         | ID del registro afectado            |
| `old_data`     | jsonb        | Datos anteriores                    |
| `new_data`     | jsonb        | Datos nuevos                        |
| `ip_address`   | varchar(45)  | Dirección IP del cliente            |
| `user_agent`   | text         | User agent del navegador            |
| `created_at`   | timestamp    | Fecha y hora                        |

### `permissions`

Catálogo de permisos granulares del sistema.

| Columna       | Tipo | Descripción                             |
| ------------- | ---- | --------------------------------------- |
| `id`          | uuid | PK                                      |
| `code`        | text | Código único, ej. `settings:users:view` |
| `description` | text | Descripción opcional                    |
| `module`      | text | Módulo del permiso                      |

**Índices:** `code` (unique)

### `roles`

Roles del sistema RBAC.

| Columna       | Tipo    | Descripción                                |
| ------------- | ------- | ------------------------------------------ |
| `id`          | uuid    | PK                                         |
| `name`        | text    | Nombre único (ADMIN, MANAGER, etc.)        |
| `description` | text    | Descripción opcional                       |
| `is_system`   | boolean | Protege roles del sistema; default `false` |

**Índices:** `name` (unique)

### `users`

Usuarios del sistema.

| Columna         | Tipo      | Descripción               |
| --------------- | --------- | ------------------------- |
| `id`            | uuid      | PK                        |
| `name`          | text      | Nombre completo           |
| `email`         | text      | Email único               |
| `password`      | text      | Hash de contraseña bcrypt |
| `refresh_token` | text      | Refresh token opcional    |
| `created_at`    | timestamp | Fecha de creación         |
| `updated_at`    | timestamp | Última actualización      |

**Índices:** `email` (unique)

### `users_roles`

Junction table para relación users ↔ roles.

| Columna   | Tipo | Descripción |
| --------- | ---- | ----------- |
| `user_id` | uuid | FK → users  |
| `role_id` | uuid | FK → roles  |

**PK Compuesta:** `(user_id, role_id)`

### `roles_permissions`

Junction table para relación roles ↔ permissions.

| Columna         | Tipo | Descripción      |
| --------------- | ---- | ---------------- |
| `role_id`       | uuid | FK → roles       |
| `permission_id` | uuid | FK → permissions |

**PK Compuesta:** `(role_id, permission_id)`

### `users_branches`

Acceso multisede - define a qué sucursales tiene acceso cada usuario.

| Columna      | Tipo    | Descripción                              |
| ------------ | ------- | ---------------------------------------- |
| `user_id`    | uuid    | FK → users                               |
| `branch_id`  | uuid    | FK → branches                            |
| `is_default` | boolean | Sucursal predeterminada; default `false` |

**PK Compuesta:** `(user_id, branch_id)`
**Índice parcial:** como máximo una fila `is_default = true` por usuario.

### `user_app_settings`

Configuración personalizada por usuario.

| Columna      | Tipo      | Descripción                   |
| ------------ | --------- | ----------------------------- |
| `id`         | uuid      | PK                            |
| `user_id`    | uuid      | Identificador de usuario      |
| `settings`   | jsonb     | Configuración en formato JSON |
| `updated_at` | timestamp | Última actualización          |

---

## 🏢 Core

### `companies`

Entidad legal/organizacional. El RIF es un dato de empresa, no una clave de
agrupación de sucursales.

| Columna      | Tipo      | Descripción                 |
| ------------ | --------- | --------------------------- |
| `id`         | uuid      | PK                          |
| `name`       | text      | Razón social                |
| `tax_id`     | text      | RIF opcional, índice unique |
| `address`    | text      | Dirección                   |
| `phone`      | text      | Teléfono                    |
| `email`      | text      | Correo                      |
| `is_active`  | boolean   | Estado                      |
| `created_at` | timestamp | Fecha de creación           |
| `updated_at` | timestamp | Última actualización        |

### `branches`

Cada sucursal pertenece directamente a una empresa. No hay una tabla
intermedia entre ambas entidades.

| Columna      | Tipo      | Descripción                                |
| ------------ | --------- | ------------------------------------------ |
| `id`         | uuid      | PK                                         |
| `company_id` | uuid      | FK → `companies.id` (`ON DELETE RESTRICT`) |
| `name`       | text      | Nombre de la sucursal                      |
| `address`    | text      | Dirección                                  |
| `phone`      | text      | Teléfono                                   |
| `email`      | text      | Correo                                     |
| `is_active`  | boolean   | Estado; default `true`                     |
| `created_at` | timestamp | Fecha de creación                          |

La migración `0003_explicit_companies_rbac.sql` crea empresas antes de cambiar
la tabla de sucursales: agrupa filas históricas por RIF y asigna una empresa
individual a cada sucursal que no tenía RIF; luego rellena `company_id` y
elimina `branches.tax_id`. Por ello, sucursales con RIF distintos no se
fusionan automáticamente. El vínculo se consulta mediante
`branches.company_id = companies.id`.

### `currencies`

Catálogo de monedas.

| Columna      | Tipo         | Descripción            |
| ------------ | ------------ | ---------------------- |
| `id`         | uuid         | PK                     |
| `code`       | varchar(3)   | Código (USD, VES, EUR) |
| `name`       | varchar(100) | Nombre completo        |
| `symbol`     | varchar(10)  | Símbolo ($, Bs)        |
| `decimals`   | integer      | Decimales a mostrar    |
| `is_active`  | boolean      | Si está activa         |
| `created_at` | timestamp    |                        |

**Índices:** `code` (unique)

### `exchange_rates`

Tasas de cambio (BCV u otras fuentes).

| Columna              | Tipo          | Descripción               |
| -------------------- | ------------- | ------------------------- |
| `id`                 | uuid          | PK                        |
| `source_currency_id` | uuid          | FK → currencies (USD)     |
| `target_currency_id` | uuid          | FK → currencies (VES)     |
| `rate`               | decimal(20,4) | Valor de la tasa          |
| `source`             | varchar(50)   | BCV_SCRAPER, MANUAL, etc. |
| `valid_from`         | date          | Desde cuándo aplica       |
| `created_at`         | timestamp     |                           |

**Índices:** `(source_currency_id, target_currency_id, valid_from)`

### `tax_concepts`

Conceptos de retención de ISLR.

| Columna      | Tipo          | Descripción            |
| ------------ | ------------- | ---------------------- |
| `id`         | uuid          | PK                     |
| `code`       | varchar(50)   | Código                 |
| `name`       | varchar(255)  | Nombre                 |
| `rate`       | decimal(5,2)  | Porcentaje (%)         |
| `sustraendo` | decimal(20,2) | Cantidad a restar (UT) |
| `is_active`  | boolean       | Si está activo         |
| `created_at` | timestamp     |                        |
| `updated_at` | timestamp     |                        |

### `partners`

Clientes y proveedores.

| Columna        | Tipo          | Descripción                              |
| -------------- | ------------- | ---------------------------------------- |
| `id`           | uuid          | PK                                       |
| `type`         | text          | Backend API acepta `CUSTOMER` o `VENDOR` |
| `tax_id`       | varchar(20)   | RIF/Cédula                               |
| `name`         | varchar(255)  | Nombre/Razón Social                      |
| `email`        | varchar(255)  | Email                                    |
| `phone`        | varchar(20)   | Teléfono                                 |
| `address`      | text          | Dirección                                |
| `credit_limit` | decimal(20,2) | Límite de crédito                        |
| `is_active`    | boolean       | Si está activo                           |
| `created_at`   | timestamp     |                                          |
| `updated_at`   | timestamp     |                                          |

**Índices:** `tax_id` (unique), `email`

### `organization_modules`

Módulos activos por organización/sucursal.

| Columna      | Tipo        | Descripción                      |
| ------------ | ----------- | -------------------------------- |
| `id`         | uuid        | PK                               |
| `branch_id`  | uuid        | FK → branches                    |
| `module`     | varchar(50) | billing, treasury, hr, inventory |
| `is_enabled` | boolean     | Si está habilitado               |
| `created_at` | timestamp   |                                  |

---

## 📦 Inventory

### `warehouses`

Almacenes.

| Columna      | Tipo         | Descripción    |
| ------------ | ------------ | -------------- |
| `id`         | uuid         | PK             |
| `branch_id`  | uuid         | FK → branches  |
| `name`       | varchar(255) | Nombre         |
| `address`    | text         | Ubicación      |
| `is_active`  | boolean      | Si está activo |
| `created_at` | timestamp    |                |
| `updated_at` | timestamp    |                |

### `product_categories`

Categorías de productos.

| Columna       | Tipo         | Descripción                    |
| ------------- | ------------ | ------------------------------ |
| `id`          | uuid         | PK                             |
| `name`        | varchar(255) | Nombre                         |
| `description` | text         | Descripción                    |
| `parent_id`   | uuid         | FK → product_categories (self) |
| `created_at`  | timestamp    |                                |

### `products`

Catálogo de productos.

| Columna       | Tipo          | Descripción             |
| ------------- | ------------- | ----------------------- |
| `id`          | uuid          | PK                      |
| `sku`         | varchar(50)   | Código SKU              |
| `barcode`     | varchar(50)   | Código de barras        |
| `name`        | varchar(255)  | Nombre                  |
| `description` | text          | Descripción             |
| `category_id` | uuid          | FK → product_categories |
| `price`       | decimal(20,2) | Precio unitario         |
| `cost`        | decimal(20,2) | Costo                   |
| `currency_id` | uuid          | FK → currencies         |
| `stock_min`   | decimal(20,2) | Stock mínimo            |
| `stock_max`   | decimal(20,2) | Stock máximo            |
| `is_active`   | boolean       | Si está activo          |
| `created_at`  | timestamp     |                         |
| `updated_at`  | timestamp     |                         |

**Índices:** `sku` (unique), `barcode`

### `product_batches`

Lotes de productos.

| Columna           | Tipo          | Descripción         |
| ----------------- | ------------- | ------------------- |
| `id`              | uuid          | PK                  |
| `product_id`      | uuid          | FK → products       |
| `batch_number`    | varchar(50)   | Número de lote      |
| `expiration_date` | date          | Fecha de expiración |
| `cost`            | decimal(20,2) | Costo del lote      |
| `created_at`      | timestamp     |                     |

### `stock`

Inventario por almacén.

| Columna        | Tipo          | Descripción                     |
| -------------- | ------------- | ------------------------------- |
| `id`           | uuid          | PK                              |
| `warehouse_id` | uuid          | FK → warehouses                 |
| `product_id`   | uuid          | FK → products                   |
| `batch_id`     | uuid          | FK → product_batches (nullable) |
| `quantity`     | decimal(20,2) | Cantidad disponible             |
| `reserved`     | decimal(20,2) | Cantidad reservada              |
| `updated_at`   | timestamp     |                                 |

**Índices:** `(warehouse_id, product_id)` (unique)

### `inventory_moves`

Movimientos de inventario (entradas, salidas, transferencias).

| Columna           | Tipo         | Descripción                                    |
| ----------------- | ------------ | ---------------------------------------------- |
| `id`              | uuid         | PK                                             |
| `type`            | varchar(20)  | ENTRY, EXIT, TRANSFER, ADJUSTMENT              |
| `reason`          | varchar(100) | Motivo del movimiento                          |
| `warehouse_id`    | uuid         | FK → warehouses (origen)                       |
| `to_warehouse_id` | uuid         | FK → warehouses (destino, para transferencias) |
| `reference`       | varchar(100) | Referencia externa                             |
| `notes`           | text         | Observaciones                                  |
| `status`          | varchar(20)  | PENDING, APPROVED, REJECTED                    |
| `approved_by`     | uuid         | FK → users                                     |
| `approved_at`     | timestamp    |                                                |
| `created_by`      | uuid         | FK → users                                     |
| `created_at`      | timestamp    |                                                |

### `inventory_move_lines`

Líneas de detalle de movimientos de inventario.

| Columna      | Tipo          | Descripción                     |
| ------------ | ------------- | ------------------------------- |
| `id`         | uuid          | PK                              |
| `move_id`    | uuid          | FK → inventory_moves            |
| `product_id` | uuid          | FK → products                   |
| `batch_id`   | uuid          | FK → product_batches (nullable) |
| `quantity`   | decimal(20,2) | Cantidad                        |
| `cost`       | decimal(20,2) | Costo unitario                  |
| `created_at` | timestamp     |                                 |

---

## 🧾 Orders & Billing

### `orders`

Pedidos (órdenes de venta).

| Columna         | Tipo          | Descripción                           |
| --------------- | ------------- | ------------------------------------- |
| `id`            | uuid          | PK                                    |
| `order_number`  | varchar(50)   | Número sequential (PED-00001)         |
| `partner_id`    | uuid          | FK → partners                         |
| `branch_id`     | uuid          | FK → branches                         |
| `currency_id`   | uuid          | FK → currencies                       |
| `exchange_rate` | decimal(20,4) | Tasa aplicada                         |
| `subtotal`      | decimal(20,2) | Subtotal                              |
| `tax_amount`    | decimal(20,2) | Monto IVA                             |
| `igtf_amount`   | decimal(20,2) | Monto IGTF (3%)                       |
| `total`         | decimal(20,2) | Total                                 |
| `status`        | varchar(20)   | DRAFT, CONFIRMED, INVOICED, CANCELLED |
| `notes`         | text          | Observaciones                         |
| `created_by`    | uuid          | FK → users                            |
| `created_at`    | timestamp     |                                       |
| `updated_at`    | timestamp     |                                       |

**Índices:** `order_number` (unique)

### `order_items`

Ítems de pedido.

| Columna       | Tipo          | Descripción          |
| ------------- | ------------- | -------------------- |
| `id`          | uuid          | PK                   |
| `order_id`    | uuid          | FK → orders          |
| `product_id`  | uuid          | FK → products        |
| `description` | varchar(500)  | Descripción del ítem |
| `quantity`    | decimal(20,2) | Cantidad             |
| `unit_price`  | decimal(20,2) | Precio unitario      |
| `tax_rate`    | decimal(5,2)  | Tasa IVA (%)         |
| `tax_amount`  | decimal(20,2) | Monto IVA            |
| `subtotal`    | decimal(20,2) | Subtotal             |
| `created_at`  | timestamp     |                      |

### `invoices`

Facturas.

| Columna          | Tipo          | Descripción                         |
| ---------------- | ------------- | ----------------------------------- |
| `id`             | uuid          | PK                                  |
| `invoice_number` | varchar(50)   | Número (A-00001, C-00001)           |
| `type`           | varchar(10)   | A (Activo), C (Compulsa)            |
| `partner_id`     | uuid          | FK → partners                       |
| `branch_id`      | uuid          | FK → branches                       |
| `order_id`       | uuid          | FK → orders (nullable)              |
| `currency_id`    | uuid          | FK → currencies                     |
| `exchange_rate`  | decimal(20,4) | Tasa aplicada                       |
| `subtotal`       | decimal(20,2) | Subtotal                            |
| `tax_amount`     | decimal(20,2) | Monto IVA                           |
| `igtf_amount`    | decimal(20,2) | Monto IGTF                          |
| `total`          | decimal(20,2) | Total                               |
| `status`         | varchar(20)   | DRAFT, ISSUED, VOID                 |
| `control_number` | varchar(20)   | Número de control (Seriales fiscal) |
| ` fiscal_serial` | varchar(20)   | Serial fiscal                       |
| `void_reason`    | text          | Razón de anulación                  |
| `void_at`        | timestamp     | Fecha de anulación                  |
| `void_by`        | uuid          | FK → users                          |
| `issued_at`      | timestamp     | Fecha de emisión                    |
| `created_by`     | uuid          | FK → users                          |
| `created_at`     | timestamp     |                                     |
| `updated_at`     | timestamp     |                                     |

**Índices:** `invoice_number` (unique)

### `invoice_items`

Ítems de factura.

| Columna       | Tipo          | Descripción     |
| ------------- | ------------- | --------------- |
| `id`          | uuid          | PK              |
| `invoice_id`  | uuid          | FK → invoices   |
| `product_id`  | uuid          | FK → products   |
| `description` | varchar(500)  | Descripción     |
| `quantity`    | decimal(20,2) | Cantidad        |
| `unit_price`  | decimal(20,2) | Precio unitario |
| `tax_rate`    | decimal(5,2)  | Tasa IVA (%)    |
| `tax_amount`  | decimal(20,2) | Monto IVA       |
| `subtotal`    | decimal(20,2) | Subtotal        |
| `created_at`  | timestamp     |                 |

### `credit_notes`

Notas de crédito.

| Columna              | Tipo          | Descripción                      |
| -------------------- | ------------- | -------------------------------- |
| `id`                 | uuid          | PK                               |
| `credit_note_number` | varchar(50)   | Número (NC-00001)                |
| `type`               | varchar(20)   | A, C                             |
| `partner_id`         | uuid          | FK → partners                    |
| `branch_id`          | uuid          | FK → branches                    |
| `invoice_id`         | uuid          | FK → invoices (factura asociada) |
| `reason`             | text          | Motivo                           |
| `currency_id`        | uuid          | FK → currencies                  |
| `exchange_rate`      | decimal(20,4) | Tasa                             |
| `subtotal`           | decimal(20,2) | Subtotal                         |
| `tax_amount`         | decimal(20,2) | Monto IVA                        |
| `total`              | decimal(20,2) | Total                            |
| `available_amount`   | decimal(20,2) | Monto disponible para cruzar     |
| `status`             | varchar(20)   | DRAFT, ISSUED, APPLIED, VOID     |
| `created_by`         | uuid          | FK → users                       |
| `created_at`         | timestamp     |                                  |
| `updated_at`         | timestamp     |                                  |

**Índices:** `credit_note_number` (unique)

### `credit_note_items`

Ítems de nota de crédito.

| Columna          | Tipo          | Descripción       |
| ---------------- | ------------- | ----------------- |
| `id`             | uuid          | PK                |
| `credit_note_id` | uuid          | FK → credit_notes |
| `product_id`     | uuid          | FK → products     |
| `description`    | varchar(500)  | Descripción       |
| `quantity`       | decimal(20,2) | Cantidad          |
| `unit_price`     | decimal(20,2) | Precio unitario   |
| `tax_rate`       | decimal(5,2)  | Tasa IVA          |
| `tax_amount`     | decimal(20,2) | Monto IVA         |
| `subtotal`       | decimal(20,2) | Subtotal          |

### `credit_note_usages`

Registro de cómo se usan las notas de crédito.

| Columna          | Tipo          | Descripción       |
| ---------------- | ------------- | ----------------- |
| `id`             | uuid          | PK                |
| `credit_note_id` | uuid          | FK → credit_notes |
| `payment_id`     | uuid          | FK → payments     |
| `amount_applied` | decimal(20,2) | Monto cruzado     |
| `created_at`     | timestamp     |                   |

---

## 💰 Treasury

### `payment_methods`

Métodos de pago.

| Columna             | Tipo         | Descripción                        |
| ------------------- | ------------ | ---------------------------------- |
| `id`                | uuid         | PK                                 |
| `code`              | varchar(20)  | Código (CASH, BANK_TRANSFER, etc.) |
| `name`              | varchar(100) | Nombre                             |
| `currency_id`       | uuid         | FK → currencies                    |
| `requires_document` | boolean      | Requiere documento soporte         |
| `is_active`         | boolean      | Si está activo                     |
| `created_at`        | timestamp    |                                    |

### `bank_accounts`

Cuentas bancarias de la empresa.

| Columna          | Tipo          | Descripción           |
| ---------------- | ------------- | --------------------- |
| `id`             | uuid          | PK                    |
| `bank_id`        | uuid          | FK → banks (catálogo) |
| `account_number` | varchar(50)   | Número de cuenta      |
| `account_type`   | varchar(20)   | CHECKING, SAVINGS     |
| `currency_id`    | uuid          | FK → currencies       |
| `branch_id`      | uuid          | FK → branches         |
| `balance`        | decimal(20,2) | Saldo actual          |
| `is_active`      | boolean       | Si está activa        |
| `created_at`     | timestamp     |                       |
| `updated_at`     | timestamp     |                       |

### `payments`

Pagos registrados.

| Columna             | Tipo          | Descripción              |
| ------------------- | ------------- | ------------------------ |
| `id`                | uuid          | PK                       |
| `payment_number`    | varchar(50)   | Número de pago           |
| `partner_id`        | uuid          | FK → partners            |
| `branch_id`         | uuid          | FK → branches            |
| `payment_method_id` | uuid          | FK → payment_methods     |
| `bank_account_id`   | uuid          | FK → bank_accounts       |
| `currency_id`       | uuid          | FK → currencies          |
| `exchange_rate`     | decimal(20,4) | Tasa                     |
| `amount`            | decimal(20,2) | Monto total              |
| `amount_allocated`  | decimal(20,2) | Monto asignado           |
| `reference`         | varchar(100)  | Referencia bancaria      |
| `notes`             | text          | Observaciones            |
| `status`            | varchar(20)   | PENDING, COMPLETED, VOID |
| `processed_at`      | timestamp     |                          |
| `void_reason`       | text          |                          |
| `void_at`           | timestamp     |                          |
| `void_by`           | uuid          | FK → users               |
| `created_by`        | uuid          | FK → users               |
| `created_at`        | timestamp     |                          |

**Índices:** `payment_number` (unique)

### `payment_allocations`

Asignaciones de pagos a facturas.

| Columna      | Tipo          | Descripción    |
| ------------ | ------------- | -------------- |
| `id`         | uuid          | PK             |
| `payment_id` | uuid          | FK → payments  |
| `invoice_id` | uuid          | FK → invoices  |
| `amount`     | decimal(20,2) | Monto asignado |
| `created_at` | timestamp     |                |

### `tax_retentions`

Retenciones fiscales (IVA, ISLR).

| Columna            | Tipo          | Descripción              |
| ------------------ | ------------- | ------------------------ |
| `id`               | uuid          | PK                       |
| `retention_number` | varchar(50)   | Número                   |
| `type`             | varchar(20)   | IVA_75, IVA_100, ISLR    |
| `partner_id`       | uuid          | FK → partners            |
| `branch_id`        | uuid          | FK → branches            |
| `invoice_id`       | uuid          | FK → invoices (nullable) |
| `currency_id`      | uuid          | FK → currencies          |
| `exchange_rate`    | decimal(20,4) | Tasa                     |
| `total_amount`     | decimal(20,2) | Total sujeto a retención |
| `retention_amount` | decimal(20,2) | Monto retenido           |
| `status`           | varchar(20)   | PENDING, COMPLETED, VOID |
| `comprobante`      | varchar(50)   | Número de comprobante    |
| `created_by`       | uuid          | FK → users               |
| `created_at`       | timestamp     |                          |

### `tax_retention_lines`

Líneas de retención fiscal.

| Columna          | Tipo          | Descripción         |
| ---------------- | ------------- | ------------------- |
| `id`             | uuid          | PK                  |
| `retention_id`   | uuid          | FK → tax_retentions |
| `tax_concept_id` | uuid          | FK → tax_concepts   |
| `base_amount`    | decimal(20,2) | Base imponible      |
| `rate`           | decimal(5,2)  | Tasa (%)            |
| `amount`         | decimal(20,2) | Monto               |

---

## 👥 HR (Recursos Humanos)

### `banks`

Catálogo bancario (códigos SUDEBAN).

| Columna     | Tipo         | Descripción                 |
| ----------- | ------------ | --------------------------- |
| `id`        | uuid         | PK                          |
| `code`      | varchar(10)  | Código SUDEBAN (0102, 0134) |
| `name`      | varchar(255) | Nombre del banco            |
| `is_active` | boolean      | Si está activo              |

### `departments`

Departamentos/áreas.

| Columna       | Tipo         | Descripción     |
| ------------- | ------------ | --------------- |
| `id`          | uuid         | PK              |
| `name`        | varchar(255) | Nombre          |
| `cost_center` | varchar(50)  | Centro de costo |
| `is_active`   | boolean      | Si está activo  |
| `created_at`  | timestamp    |                 |

### `job_positions`

Cargos/Tabuladores salariales.

| Columna         | Tipo          | Descripción      |
| --------------- | ------------- | ---------------- |
| `id`            | uuid          | PK               |
| `department_id` | uuid          | FK → departments |
| `name`          | varchar(255)  | Nombre del cargo |
| `salary_min`    | decimal(20,2) | Salario mínimo   |
| `salary_max`    | decimal(20,2) | Salario máximo   |
| `is_active`     | boolean       | Si está activo   |
| `created_at`    | timestamp     |                  |

### `employees`

Empleados.

| Columna            | Tipo          | Descripción                  |
| ------------------ | ------------- | ---------------------------- |
| `id`               | uuid          | PK                           |
| `employee_number`  | varchar(50)   | Número de empleado           |
| `department_id`    | uuid          | FK → departments             |
| `position_id`      | uuid          | FK → job_positions           |
| `branch_id`        | uuid          | FK → branches                |
| `tax_id`           | varchar(20)   | Cédula/RIF                   |
| `name`             | varchar(255)  | Nombre completo              |
| `email`            | varchar(255)  | Email personal               |
| `phone`            | varchar(20)   | Teléfono                     |
| `address`          | text          | Dirección                    |
| `hire_date`        | date          | Fecha de ingreso             |
| `termination_date` | date          | Fecha de salida (nullable)   |
| `status`           | varchar(20)   | ACTIVE, INACTIVE, TERMINATED |
| `salary`           | decimal(20,2) | Salario mensual              |
| `currency_id`      | uuid          | FK → currencies              |
| `payment_type`     | varchar(20)   | BANK_TRANSFER, CASH          |
| `created_at`       | timestamp     |                              |
| `updated_at`       | timestamp     |                              |

**Índices:** `employee_number` (unique), `tax_id` (unique)

### `employee_bank_accounts`

Cuentas bancarias de empleados.

| Columna          | Tipo        | Descripción        |
| ---------------- | ----------- | ------------------ |
| `id`             | uuid        | PK                 |
| `employee_id`    | uuid        | FK → employees     |
| `bank_id`        | uuid        | FK → banks         |
| `account_type`   | varchar(20) | CHECKINGS, SAVINGS |
| `account_number` | varchar(50) | Número de cuenta   |
| `is_primary`     | boolean     | Cuenta principal   |
| `created_at`     | timestamp   |                    |

### `employee_contracts`

Contratos LOTTT.

| Columna              | Tipo          | Descripción                     |
| -------------------- | ------------- | ------------------------------- |
| `id`                 | uuid          | PK                              |
| `employee_id`        | uuid          | FK → employees                  |
| `contract_type`      | varchar(50)   | DEFINITE, INDEFINITE, TEMPORARY |
| `start_date`         | date          | Fecha inicio                    |
| `end_date`           | date          | Fecha fin (nullable)            |
| `salary`             | decimal(20,2) | Salario                         |
| `currency_id`        | uuid          | FK → currencies                 |
| `work_days_per_week` | integer       | Días trabajo/semana             |
| `work_hours_per_day` | decimal(4,2)  | Horas/día                       |
| `is_active`          | boolean       | Si está activo                  |
| `created_at`         | timestamp     |                                 |

### `employee_vacations`

Vacaciones.

| Columna        | Tipo      | Descripción     |
| -------------- | --------- | --------------- |
| `id`           | uuid      | PK              |
| `employee_id`  | uuid      | FK → employees  |
| `year`         | integer   | Año             |
| `days_total`   | integer   | Días totales    |
| `days_taken`   | integer   | Días tomados    |
| `days_pending` | integer   | Días pendientes |
| `created_at`   | timestamp |                 |

### `employee_profit_sharing`

Utilidades.

| Columna       | Tipo          | Descripción      |
| ------------- | ------------- | ---------------- |
| `id`          | uuid          | PK               |
| `employee_id` | uuid          | FK → employees   |
| `year`        | integer       | Año              |
| `days_worked` | integer       | Días laborados   |
| `amount`      | decimal(20,2) | Monto utilidades |
| `created_at`  | timestamp     |                  |

### `payroll_runs`

Corridas de nómina.

| Columna            | Tipo          | Descripción                       |
| ------------------ | ------------- | --------------------------------- |
| `id`               | uuid          | PK                                |
| `run_number`       | varchar(50)   | Número de corrida                 |
| `branch_id`        | uuid          | FK → branches                     |
| `department_id`    | uuid          | FK → departments (nullable)       |
| `period_start`     | date          | Inicio período                    |
| `period_end`       | date          | Fin período                       |
| `pay_date`         | date          | Fecha de pago                     |
| `total_gross`      | decimal(20,2) | Total bruto                       |
| `total_deductions` | decimal(20,2) | Total deducciones                 |
| `total_net`        | decimal(20,2) | Total neto                        |
| `status`           | varchar(20)   | DRAFT, PROCESSED, PAID, CANCELLED |
| `processed_at`     | timestamp     |                                   |
| `processed_by`     | uuid          | FK → users                        |
| `created_at`       | timestamp     |                                   |

**Índices:** `run_number` (unique)

### `payroll_items`

Detalle de nómina por empleado.

| Columna             | Tipo          | Descripción        |
| ------------------- | ------------- | ------------------ |
| `id`                | uuid          | PK                 |
| `run_id`            | uuid          | FK → payroll_runs  |
| `employee_id`       | uuid          | FK → employees     |
| `gross_salary`      | decimal(20,2) | Salario bruto      |
| `total_assignments` | decimal(20,2) | Total asignaciones |
| `total_deductions`  | decimal(20,2) | Total deducciones  |
| `net_salary`        | decimal(20,2) | Salario neto       |
| `created_at`        | timestamp     |                    |

### `payroll_item_lines`

Líneas de concepto por ítem de nómina.

| Columna           | Tipo          | Descripción           |
| ----------------- | ------------- | --------------------- |
| `id`              | uuid          | PK                    |
| `payroll_item_id` | uuid          | FK → payroll_items    |
| `concept_type`    | varchar(20)   | ASSIGNMENT, DEDUCTION |
| `concept_name`    | varchar(100)  | Nombre del concepto   |
| `amount`          | decimal(20,2) | Monto                 |
| `created_at`      | timestamp     |                       |

### `payroll_settings`

Configuración de nómina.

| Columna      | Tipo         | Descripción   |
| ------------ | ------------ | ------------- |
| `id`         | uuid         | PK            |
| `branch_id`  | uuid         | FK → branches |
| `key`        | varchar(100) | Clave         |
| `value`      | jsonb        | Valor         |
| `updated_at` | timestamp    |               |

### `payroll_concept_types`

Tipos de conceptos de nómina.

| Columna      | Tipo         | Descripción              |
| ------------ | ------------ | ------------------------ |
| `id`         | uuid         | PK                       |
| `code`       | varchar(50)  | Código                   |
| `name`       | varchar(100) | Nombre                   |
| `type`       | varchar(20)  | ASSIGNMENT, DEDUCTION    |
| `is_taxable` | boolean      | Si es afecto a impuestos |
| `is_active`  | boolean      | Si está activo           |

### `payroll_incidents`

Novedades/incidencias de nómina.

| Columna               | Tipo          | Descripción                  |
| --------------------- | ------------- | ---------------------------- |
| `id`                  | uuid          | PK                           |
| `employee_id`         | uuid          | FK → employees               |
| `concept_type_id`     | uuid          | FK → payroll_concept_types   |
| `date`                | date          | Fecha                        |
| `quantity`            | decimal(10,2) | Cantidad (días, horas)       |
| `amount`              | decimal(20,2) | Monto                        |
| `status`              | varchar(20)   | PENDING, PROCESSED           |
| `processed_in_run_id` | uuid          | FK → payroll_runs (nullable) |
| `notes`               | text          | Observaciones                |
| `created_at`          | timestamp     |                              |

### `employee_salary_history`

Histórico de salarios.

| Columna          | Tipo          | Descripción       |
| ---------------- | ------------- | ----------------- |
| `id`             | uuid          | PK                |
| `employee_id`    | uuid          | FK → employees    |
| `old_salary`     | decimal(20,2) | Salario anterior  |
| `new_salary`     | decimal(20,2) | Salario nuevo     |
| `reason`         | varchar(255)  | Motivo del cambio |
| `effective_date` | date          | Fecha de vigencia |
| `created_at`     | timestamp     |                   |

---

## 📒 Accounting

### `accounting_accounts`

Plan de cuentas.

| Columna      | Tipo         | Descripción                                |
| ------------ | ------------ | ------------------------------------------ |
| `id`         | uuid         | PK                                         |
| `code`       | varchar(50)  | Código de cuenta                           |
| `name`       | varchar(255) | Nombre                                     |
| `type`       | varchar(20)  | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| `parent_id`  | uuid         | FK → accounting_accounts (self)            |
| `is_active`  | boolean      | Si está activa                             |
| `created_at` | timestamp    |                                            |

**Índices:** `code` (unique)

### `accounting_entries`

Asientos contables.

| Columna        | Tipo          | Descripción        |
| -------------- | ------------- | ------------------ |
| `id`           | uuid          | PK                 |
| `entry_number` | varchar(50)   | Número de asiento  |
| `date`         | date          | Fecha              |
| `description`  | text          | Descripción        |
| `reference`    | varchar(100)  | Referencia         |
| `total_debit`  | decimal(20,2) | Total débitos      |
| `total_credit` | decimal(20,2) | Total créditos     |
| `is_balanced`  | boolean       | Si está balanceado |
| `created_by`   | uuid          | FK → users         |
| `created_at`   | timestamp     |                    |

**Índices:** `entry_number` (unique)

### `accounting_entry_lines`

Líneas de asiento contable.

| Columna       | Tipo          | Descripción              |
| ------------- | ------------- | ------------------------ |
| `id`          | uuid          | PK                       |
| `entry_id`    | uuid          | FK → accounting_entries  |
| `account_id`  | uuid          | FK → accounting_accounts |
| `debit`       | decimal(20,2) | Débito                   |
| `credit`      | decimal(20,2) | Crédito                  |
| `description` | varchar(255)  | Descripción línea        |
| `created_at`  | timestamp     |                          |

### `accounting_maps`

Mapas contables (reglas automáticas).

| Columna        | Tipo        | Descripción                       |
| -------------- | ----------- | --------------------------------- |
| `id`           | uuid        | PK                                |
| `source_table` | varchar(50) | Tabla origen (invoices, payments) |
| `source_event` | varchar(50) | Evento (CREATE, POST, VOID)       |
| `description`  | text        | Descripción                       |
| `is_active`    | boolean     | Si está activo                    |
| `created_at`   | timestamp   |                                   |

---

## 💳 Loans

### `loans`

Préstamos (给自己 o a terceros).

| Columna            | Tipo          | Descripción                                           |
| ------------------ | ------------- | ----------------------------------------------------- |
| `id`               | uuid          | PK                                                    |
| `loan_number`      | varchar(50)   | Número                                                |
| `type`             | varchar(20)   | TO_EMPLOYEE, FROM_PARTNER                             |
| `partner_id`       | uuid          | FK → partners (nullable)                              |
| `employee_id`      | uuid          | FK → employees (nullable)                             |
| `branch_id`        | uuid          | FK → branches                                         |
| `principal`        | decimal(20,2) | Principal                                             |
| `interest_rate`    | decimal(5,2)  | Tasa interés (%)                                      |
| `total_amount`     | decimal(20,2) | Monto total                                           |
| `paid_amount`      | decimal(20,2) | Monto pagado                                          |
| `remaining_amount` | decimal(20,2) | Monto pendiente                                       |
| `installments`     | integer       | Número de cuotas                                      |
| `start_date`       | date          | Fecha inicio                                          |
| `status`           | varchar(20)   | PENDING, APPROVED, ACTIVE, PAID, DEFAULTED, CANCELLED |
| `created_by`       | uuid          | FK → users                                            |
| `created_at`       | timestamp     |                                                       |
| `updated_at`       | timestamp     |                                                       |

**Índices:** `loan_number` (unique)

### `loan_items`

Cuotas de préstamo.

| Columna              | Tipo          | Descripción            |
| -------------------- | ------------- | ---------------------- |
| `id`                 | uuid          | PK                     |
| `loan_id`            | uuid          | FK → loans             |
| `installment_number` | integer       | Número de cuota        |
| `due_date`           | date          | Fecha vencimiento      |
| `principal_amount`   | decimal(20,2) | Principal              |
| `interest_amount`    | decimal(20,2) | Interés                |
| `total_amount`       | decimal(20,2) | Total cuota            |
| `paid_amount`        | decimal(20,2) | Monto pagado           |
| `status`             | varchar(20)   | PENDING, PAID, OVERDUE |
| `paid_at`            | timestamp     |                        |
| `created_at`         | timestamp     |                        |

---

## 🔗 Document Links

### `document_links`

Enlaces polimórficos entre documentos.

| Columna        | Tipo        | Descripción                                 |
| -------------- | ----------- | ------------------------------------------- |
| `id`           | uuid        | PK                                          |
| `source_table` | varchar(50) | Tabla origen                                |
| `source_id`    | uuid        | ID origen                                   |
| `target_table` | varchar(50) | Tabla destino                               |
| `target_id`    | uuid        | ID destino                                  |
| `link_type`    | varchar(50) | Type (ORDER_INVOICE, INVOICE_PAYMENT, etc.) |
| `created_at`   | timestamp   |                                             |

---

## 📊 Vistas y Funciones

### Funciones de utility

| Nombre                                         | Descripción                       |
| ---------------------------------------------- | --------------------------------- |
| `get_account_statement(partnerId, currencyId)` | Estado de cuenta de partner       |
| `calculate_payroll(runId)`                     | Calcula nómina completa           |
| `void_invoice(invoiceId, reason)`              | Anula factura con lógica completa |

---

## 🔗 Relaciones Principales

```
users ───< users_roles >─── roles ───< roles_permissions >─── permissions
users ───< users_branches >─── branches
companies ───< branches

branches ───< orders
branches ───< invoices
branches ───< payments

partners ───< orders
partners ───< invoices
partners ───< payments

orders ───< order_items
orders >──── invoices (1:1)

invoices ───< invoice_items
invoices ───< payment_allocations >─── payments
invoices ───< tax_retentions

employees ───< payroll_runs ───< payroll_items ───< payroll_item_lines
employees ───< employee_vacations
employees ───< employee_profit_sharing
employees ───< loans
```

---

## ↩️ Rollback de migraciones recientes (TX-06)

Cada migración de este bloque se puede deshacer con el SQL inverso. Todas son **aditivas**
(`ADD COLUMN`, `CREATE INDEX`, `CREATE TABLE`) salvo `0016`, que elimina una restricción y crea un
índice único; ninguna borra datos, así que el rollback no pierde información.

| Migración | Qué hace                                                                                                                          | Rollback                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0016`    | Quita el UNIQUE global de `tax_retentions.code` y crea el único por sucursal+tipo+comprobante                                     | `DROP INDEX tax_retentions_branch_type_voucher_unq;` y `ALTER TABLE tax_retentions ADD CONSTRAINT tax_retentions_code_unique UNIQUE (code);` (falla si ya hay números repetidos entre sucursales)               |
| `0017`    | Banderas de `payment_methods`, `bank_accounts` (`bank_id`, `initial_balance`, `notes`), `daily_closes`, conciliación y caja chica | `DROP TABLE daily_closes, bank_statement_lines, bank_statement_imports, petty_cash_movements, petty_cash_funds;` y `ALTER TABLE … DROP COLUMN` de cada columna añadida                                          |
| `0018`    | Índices de `audit_logs`                                                                                                           | `DROP INDEX audit_logs_entity_created_idx, audit_logs_user_created_idx, audit_logs_created_idx;`                                                                                                                |
| `0019`    | `loan_items.kind` (`DELIVERED`/`RETURNED`) + índice                                                                               | `DROP INDEX loan_items_loan_kind_idx;` y `ALTER TABLE loan_items DROP COLUMN kind;` (se pierde la distinción entre entrega y devolución: los préstamos cerrados volverían a `ACTIVE` si se recalcula el estado) |

**Si un despliegue falla a mitad de una migración:** `drizzle-kit migrate` es transaccional por
archivo, así que la tabla queda como estaba; se corrige el SQL y se reaplica. Si el problema es de
datos (p. ej. `0016` con números repetidos), el orden es: corregir los comprobantes duplicados,
reintentar el índice y recién entonces desplegar el código que depende de él.

## 🚀 Scripts de Base de Datos

| Script                 | Ubicación                    | Descripción              |
| ---------------------- | ---------------------------- | ------------------------ |
| `seed-rbac.ts`         | `packages/database/scripts/` | Seed de roles y permisos |
| `drizzle-kit generate` | CLI                          | Genera migraciones SQL   |
| `drizzle-kit migrate`  | CLI                          | Ejecuta migraciones      |

### Comandos

```bash
# Generar migraciones desde schema
pnpm --filter database db:generate

# Ejecutar migraciones
pnpm --filter database db:migrate

# Seed roles y permisos
pnpm --filter database db:seed:rbac
```
