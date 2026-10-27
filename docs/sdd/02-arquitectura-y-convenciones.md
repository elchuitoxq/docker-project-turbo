# 02 — Arquitectura y convenciones obligatorias

Toda spec de este SDD asume estas reglas. Si una implementación las rompe, se rechaza el PR.

## 1. Estructura de un módulo backend

```
apps/backend/src/modules/<modulo>/
├── <modulo>.module.ts        # registrado en app.module.ts
├── <modulo>.controller.ts    # sin lógica de negocio
├── <modulo>.service.ts       # lógica + acceso a datos
├── dto/<modulo>.dto.ts       # class-validator + @ApiProperty
└── <modulo>.service.test.ts  # unitario (mock de db)
```

- **Controladores** sólo orquestan: validan DTO, delegan, documentan con Swagger.
- **Servicios** concentran reglas; sin `any`, sin `console.log` (usar `Logger`).
- Rutas **siempre** bajo `/v1/<recurso>` (excepto `/health`).
- Respuestas: arreglo o DTO explícito; nunca `{ data }` inventado por capa.

## 2. Seguridad (ya implementado — no regresar)

1. Todo endpoint es **privado por defecto** (`APP_GUARD`: throttler → JWT → permisos).
2. Público sólo con `@Public()` y justificado en el PR.
3. Permisos con `@RequirePermissions('modulo:recurso:accion')`; el catálogo vive en
   `packages/database/src/scripts/seed-rbac.ts` y debe reflejarse en
   `apps/frontend/lib/permissions.ts`.
4. Nunca confiar en el JWT para permisos: el guard consulta la BD (cache 30 s).
5. Secretos por entorno; `JWT_SECRET` mínimo 32 caracteres en producción.

## 3. ⚠️ Aislamiento por sucursal — **regla nueva obligatoria**

**Hallazgo (2026-10-26):** el frontend envía la cabecera `x-branch-id`
([`lib/api/client.ts`](../../apps/frontend/lib/api/client.ts)) pero **el backend no la lee**:
no existe interceptor ni filtro por sucursal. Consecuencia: un usuario con acceso a una sucursal
puede leer/escribir datos de otra pasando otro `branchId` (o ninguno).

Reglas a partir de ahora (implementadas en `S-00`):

| Regla  | Detalle                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Todo endpoint con datos de negocio exige `x-branch-id` (o `branchId` en query/body) validado contra `users_branches`.                                                                                                                                                                                                                                                                                                                                |
| **R2** | Si el usuario no tiene la sucursal asignada → `403`. Si el recurso pertenece a otra sucursal → `404` (no filtrar existencia).                                                                                                                                                                                                                                                                                                                        |
| **R3** | Un permiso `*:manage` no implica acceso a sucursales no asignadas; el alcance es siempre por asignación.                                                                                                                                                                                                                                                                                                                                             |
| **R4** | Los endpoints agregados (`stats`, `bi/*`) filtran por la sucursal activa salvo que el permiso sea `*:global`.                                                                                                                                                                                                                                                                                                                                        |
| **R5** | Los **maestros compartidos** (`partners`, `products`, `product_categories`, `banks`, `tax_concepts`, `exchange_rates`) exigen la cabecera pero **no** se filtran por sucursal en lectura; su escritura requiere `core:catalog:manage` (alcance de empresa), nunca `*:manage` de sucursal. Los documentos (`invoices`, `orders`, `payments`, `inventory_moves`, `loans`, `payroll_runs`, `accounting_entries`) sí se estampan y filtran por sucursal. |

## 4. Dinero y fechas

- Montos en `numeric(18,4)` en BD; en la API se serializan como **string** (nunca `number` float).
- Cálculos con `decimal.js`/`dinero` en el servicio, jamás aritmética flotante.
- Fechas en ISO-8601 UTC; los cierres y períodos usan fecha local de Venezuela (UTC-4).

### 4.1 Multimoneda — reglas obligatorias ([`S-08`](./specs/S-08-multimoneda.md))

| Regla   | Detalle                                                                                                                                                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1**  | La moneda funcional es **VES** (`currencies.isBase = true`, garantizada por restricción de BD). Toda agregación contable y de reportes se hace en ella. **Decisión D-01, 2026-10-26.**                                                                                                        |
| **M2**  | Todo documento con monto persiste **tríada**: `currencyId`, `exchangeRate` aplicado y monto en moneda base (`amountBase`/`totalBase`).                                                                                                                                                        |
| **M3**  | La tasa se **congela al emitir**. Nunca se recalcula un documento con la tasa de hoy.                                                                                                                                                                                                         |
| **M4**  | La conversión ocurre **sólo** en `MoneyService`. Multiplicar un monto a mano (o con `parseFloat`) es motivo de rechazo del PR.                                                                                                                                                                |
| **M5**  | El **dólar es la referencia**: `exchange_rates.rate` = unidades de moneda base por 1 USD; otras monedas guardan su tasa directa con la convención documentada.                                                                                                                                |
| **M6**  | IGTF se decide por `currencyId != baseCurrencyId`, **nunca** por `rate > 1`.                                                                                                                                                                                                                  |
| **M7**  | Redondeo: precisión completa en el cálculo, redondeo sólo al persistir (`HALF_UP`, 2 decimales en base).                                                                                                                                                                                      |
| **M8**  | Un pago en moneda distinta a la factura genera **diferencia cambiaria** como línea contable, no como residuo de redondeo.                                                                                                                                                                     |
| **M9**  | La tasa puede venir de BCV o de un override humano; el override exige motivo, permiso `settings:currencies:override` y queda en `exchange_rate_log`.                                                                                                                                          |
| **M10** | **Reporte dual obligatorio:** todo estado financiero, libro fiscal y reporte de gestión lleva columnas **VES** (funcional) y **USD** (paralela, a una sola tasa de corte), con `closingRate` y su fecha en el encabezado. La columna USD es informativa: no altera saldos ni genera asientos. |

## 5. Auditoría

- Toda escritura sobre dinero o stock deja registro en `audit_logs`
  (`entityTable`, `entityId`, `action`, `changes`, `userId`, `ipAddress`).
- `audit_logs` es append-only: sin `UPDATE`/`DELETE` desde la aplicación.

## 6. Migraciones y datos

- Cambios de schema **solo** vía `pnpm --filter database db:generate` (revisar SQL).
- Migraciones inmutables una vez aplicadas; nuevos cambios = nueva migración.
- Seeds deterministas e idempotentes (patrón de `seed-core`/`seed-test`).
- Prohibido tocar datos de producción desde scripts de seed (`assertDevelopmentDatabase`).

## 7. Contrato y tipos

- `pnpm openapi:export` → `pnpm sync:types` son obligatorios al cambiar un DTO.
- El frontend consume `@mi-monorepo/shared-types`; no se declaran tipos a mano si existen en OpenAPI.

## 8. Frontend

- Un `modules/<feature>/` con `api.ts` (cliente), `hooks.ts` (react-query), `components/`, `types.ts`.
- Estado de servidor con React Query; estado de UI con Zustand; **nunca** duplicar datos del servidor
  en Zustand.
- Permisos de UI vía `usePermission`/`PermissionsGate`; el gating de UI **no** reemplaza el del backend.
- Cada pantalla nueva: loading, empty state, error state y acción principal clara.
- i18n: toda cadena visible nueva se agrega a `lib/i18n/locales/{es-VE,en-US}.json`.

## 9. Pruebas

| Nivel                       | Obligatorio cuando                              |
| --------------------------- | ----------------------------------------------- |
| Unitario de servicio        | Siempre (mock de `db`)                          |
| Integración contra Postgres | Toca dinero, stock, asientos o secuencias       |
| E2E Playwright              | Flujo crítico (login, facturar, cobrar, cerrar) |
| Contrato (OpenAPI)          | Cambia un DTO público                           |

Umbrales de cobertura actuales (no bajar): backend 65/50/68/66 · frontend 47/48/44/50 ·
database 80/65/60/78.

## 10. Definition of Done (aplica a toda spec)

1. `pnpm turbo run lint typecheck build test:coverage` verde.
2. `pnpm audit` sin vulnerabilidades nuevas.
3. Migración revisada + seed idempotente si aplica.
4. OpenAPI + `shared-types` regenerados.
5. Permisos agregados a seed **y** a `lib/permissions.ts`.
6. Tests nuevos según §9 y comentario en el PR con la evidencia de ejecución.
7. `docs/API-CONTRACTS.md` y `docs/update/09-BITACORA.md` actualizados.
8. Rollback descrito (migración reversible o feature flag).
