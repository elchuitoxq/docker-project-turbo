# Manual de Mantenimiento de Seeds - Base de Datos

## Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Tipos de Seeds](#tipos-de-seeds)
3. [Scripts Disponibles](#scripts-disponibles)
4. [Guía de Uso](#guía-de-uso)
5. [Credenciales de Prueba](#credenciales-de-prueba)
6. [Estructura de Datos](#estructura-de-datos)
7. [Relaciones entre Seeds](#relaciones-entre-seeds)
8. [Resolución de Problemas](#resolución-de-problemas)
9. [Buenas Prácticas](#buenas-prácticas)

---

## Descripción General

Las seeds son scripts que populan la base de datos con datos iniciales necesarios para el funcionamiento del sistema. Existen dos tipos principales:

- **Seed de Producción (`seed-prod`)**: Datos base para despliegue en producción
- **Seed de Testing (`seed-test`)**: Datos aleatorios con relaciones coherentes para pruebas E2E

---

## Tipos de Seeds

### seed-prod.ts

**Propósito**: Despliegue a producción

**Datos que crea**:

| Categoría               | Datos                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| **RBAC**                | 61 permisos organizados por módulo, 6 roles (SUPER_ADMIN, ADMIN, MANAGER, SELLER, WAREHOUSE, ACCOUNTANT) |
| **Monedas**             | USD (base), VES, EUR                                                                                     |
| **Bancos**              | 6 bancos venezolanos (Provincial, Banesco, Mercantil, Venezuela, Exterior, Fondo Común)                  |
| **Métodos de Pago**     | Efectivo USD/VES, POS, Zelle, Transferencia, Pago Móvil, Divisa, Cheque                                  |
| **Usuario Super Admin** | superadmin@empresa.local                                                                                 |

**Características**:

- Idempotente: puede ejecutarse múltiples veces sin duplicar datos
- No genera datos aleatorios (comportamiento determinista)
- No incluye datos de prueba como partners, órdenes o facturas

---

### seed-test.ts

**Propósito**: Testing E2E y desarrollo

**Datos que crea**:

| Categoría             | Cantidad             | Descripción                                 |
| --------------------- | -------------------- | ------------------------------------------- |
| **RBAC**              | 61 permisos, 6 roles | Mismos que producción                       |
| **Sucursales**        | 2                    | Caracas, Maracaibo                          |
| **Almacenes**         | 5                    | Repartidos entre sucursales                 |
| **Usuarios**          | 5                    | Uno por cada rol                            |
| **Partners**          | 5                    | Mezcla de CUSTOMER y SUPPLIER               |
| **Categorías**        | 3                    | Electrónica, Alimentos, Hogar               |
| **Productos**         | 10                   | Con precios y costos variados               |
| **Stock**             | 10                   | Entradas de inventario                      |
| **Empleados**         | 5                    | Con datos de nómina                         |
| **Órdenes**           | 5                    | En diversos estados                         |
| **Facturas**          | 5                    | Con items y estados variados                |
| **Pagos**             | 3                    | Distribuidos entre facturas                 |
| **Departamentos**     | 2                    | Ventas, Operaciones                         |
| **Cuentas Contables** | 2                    | Gastos de Personal, Sueldos y Salarios      |
| **Bancos**            | 3                    | Provincial, Banesco, Mercantil              |
| **Métodos de Pago**   | 5                    | Efectivo USD/VES, POS, Transferencia, Zelle |
| **Cuentas Bancarias** | 4                    | USD y VES por sucursal                      |
| **Tipos de Cambio**   | 1                    | VES/USD                                     |

**Características**:

- Datos deterministas (misma ejecución = mismos datos)
- IDs predecibles para facilitar debugging
- Cada ejecución genera los mismos datos
- Validación post-seed para verificar integridad

---

## Scripts Disponibles

```bash
# Ejecutar seed de producción (datos base)
pnpm --filter database db:seed:prod

# Ejecutar seed de testing (datos completos para E2E)
pnpm --filter database db:seed:test

# Ejecutar seed de testing (alias)
pnpm --filter database db:seed

# Resetear base de datos
pnpm --filter database db:reset

# Migraciones
pnpm --filter database db:migrate

# Studio (Drizzle)
pnpm --filter database db:studio
```

---

## Guía de Uso

### Primer Despliegue a Producción

```bash
# 1. Ejecutar migraciones
pnpm --filter database db:migrate

# 2. Poblar datos base de producción
pnpm --filter database db:seed:prod

# 3. Verificar que el Super Admin fue creado
```

### Preparar Entorno de Testing

```bash
# 1. Ejecutar migraciones
pnpm --filter database db:migrate

# 2. Poblar datos de prueba completos
pnpm --filter database db:seed:test

# 3. Ejecutar tests E2E
pnpm playwright test
```

### Reset Completo

```bash
# 1. Resetear base de datos
pnpm --filter database db:reset

# 2. Ejecutar migraciones
pnpm --filter database db:migrate

# 3. Poblar datos de prueba
pnpm --filter database db:seed:test
```

---

## Credenciales de Prueba

### Seed de Producción

| Email                    | Password       | Rol         | Permisos     |
| ------------------------ | -------------- | ----------- | ------------ |
| superadmin@empresa.local | SuperAdmin123! | SUPER_ADMIN | Acceso total |

**Nota**: Cambiar la contraseña en el primer inicio de sesión.

### Seed de Testing

| Email                      | Password  | Rol        |
| -------------------------- | --------- | ---------- |
| test-admin@test.local      | Test1234! | ADMIN      |
| test-seller@test.local     | Test1234! | SELLER     |
| test-manager@test.local    | Test1234! | MANAGER    |
| test-warehouse@test.local  | Test1234! | WAREHOUSE  |
| test-accountant@test.local | Test1234! | ACCOUNTANT |

---

## Estructura de Datos

### Jerarquía de Organizaciones

```
Organización
  └── Sucursales (branches)
        ├── Usuarios (users)
        ├── Almacenes (warehouses)
        ├── Cuentas Bancarias (bankAccounts)
        └── Empleados (employees)
              └── Nómina (payrollRuns, payrollItems)
```

### Cadena Comercial

```
Partners
  └── Órdenes (orders)
        └── Facturas (invoices)
              └── Pagos (payments)
                    └── Cuentas Bancarias (bankAccounts)
```

### Módulo de Inventario

```
Almacenes (warehouses)
  └── Stock (stock)
        └── Productos (products)
              └── Categorías (productCategories)
```

### Sistema RBAC

```
Permisos (permissions)
  └── Roles (roles)
        └── Usuarios (users)
              └── Sucursales (usersBranches)
```

---

## Relaciones entre Seeds

```
┌─────────────────────────────────────────────────────────────┐
│                      seed-rbac.ts                            │
│  (Base: permisos y roles - ejecutado por ambos seeds)        │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────┐             ┌─────────────────────────┐
│    seed-prod.ts     │             │      seed-test.ts        │
├─────────────────────┤             ├─────────────────────────┤
│ • Monedas (3)        │             │ • Monedas (2)            │
│ • Bancos (6)         │             │ • Sucursales (2)          │
│ • Métodos de pago    │             │ • Almacenes (5)           │
│ • Super Admin        │             │ • Usuarios (5)           │
└─────────────────────┘             │ • Partners (5)           │
                                      │ • Categorías (3)         │
                                      │ • Productos (10)         │
                                      │ • Stock (10)             │
                                      │ • Empleados (5)         │
                                      │ • Órdenes (5)            │
                                      │ • Facturas (5)           │
                                      │ • Pagos (3)              │
                                      │ • Deptos/Cuentas (2 ea)   │
                                      │ • Validación post-seed   │
                                      └─────────────────────────┘
```

---

## Resolución de Problemas

### Error: "permisos no encontrados"

**Causa**: El seed de producción se ejecutó sin haber corrido migraciones.

**Solución**:

```bash
pnpm --filter database db:migrate
pnpm --filter database db:seed:prod
```

### Error: "Cannot find module 'dotenv'"

**Causa**: El wrapper no puede cargar las variables de entorno.

**Solución**: Verificar que el archivo `.env` existe en la raíz del proyecto.

### Error: "Top-level await" en ejecución

**Causa**: Versión de Node incompatible con top-level await.

**Solución**: Usar `tsx` para ejecutar los scripts:

```bash
pnpm --filter database db:seed:test
```

### Seed-test tarda mucho

**Causa**: Generación de muchos datos con validaciones.

**Solución**: Normal en primera ejecución. Las siguientes son más rápidas por la idempotencia.

### Datos duplicados después de ejecutar seed múltiples veces

**Causa**: Los seeds son idempotentes pero algunas tablas junction pueden acumular registros.

**Solución**: Ejecutar reset antes del seed:

```bash
pnpm --filter database db:reset
pnpm --filter database db:migrate
pnpm --filter database db:seed:test
```

---

## Buenas Prácticas

### 1. Orden de Ejecución

Siempre ejecutar migraciones antes de seeds:

```bash
pnpm --filter database db:migrate && pnpm --filter database db:seed:test
```

### 2. Reset antes de Seed en Desarrollo

Para desarrollo limpio:

```bash
pnpm --filter database db:reset && pnpm --filter database db:migrate && pnpm --filter database db:seed:test
```

### 3. No usar datos de producción para tests

Los seeds de test generan datos deterministas. No usar `seed-prod` para testing E2E.

### 4. Verificar credenciales en ambiente

| Ambiente   | Seed      | Usuario                  | Password       |
| ---------- | --------- | ------------------------ | -------------- |
| Producción | seed-prod | superadmin@empresa.local | SuperAdmin123! |
| Testing    | seed-test | test-admin@test.local    | Test1234!      |

### 5. Cambiar passwords en producción

El Super Admin de producción debe cambiar su password después del primer login.

### 6. Mantener coherencia de relaciones

El seed-test está diseñado para mantener referencias válidas entre tablas. No modificar manualmente los datos de test.

---

## Scripts de Mantenimiento

### Verificar integridad de datos

El seed-test incluye validación automática:

- Verifica que existan usuarios, partners y productos
- Valida coherencia de relaciones

### Logs de ejecución

Los seeds imprimen progreso en consola:

```
Seeding test data (deterministic)...
Seeding RBAC...
Inserted 61 permissions
Created role: SUPER_ADMIN with 61 permissions
...
Test data validation passed!
```

### Ejecutar en Docker

```bash
# Desde el contenedor drizzle-studio
docker compose exec drizzle-studio pnpm run db:seed:test

# Ver logs
docker compose logs drizzle-studio
```

---

## Referencias

- Schema de base de datos: `packages/database/src/schema.ts`
- Migraciones: `packages/database/drizzle/`
- Scripts de seeds: `packages/database/src/scripts/`

---

**Última actualización**: Junio 2026
