# S-16 — Integridad de las semillas y barrido funcional de los flujos

| Campo      | Valor                                                |
| ---------- | ---------------------------------------------------- |
| Estado     | Implementado                                         |
| Prioridad  | P0                                                   |
| Alcance    | `packages/database`, `apps/backend`, `apps/frontend` |
| Depende de | S-08, S-09, S-10, S-12, S-14, S-15                   |
| Fecha      | 2026-10-31                                           |

## 1. Contexto

La base de desarrollo llevaba semanas creciendo sin una comprobación de coherencia. Al auditar el
volumen real aparecieron **huérfanos que ninguna FK impedía**: productos, facturas, pagos, cuentas
bancarias, movimientos y tasas apuntando a monedas, bancos o usuarios que ya no existían. Causa raíz
triple:

1. **Sin claves foráneas** en las tablas de documentos (`invoices`, `orders`, `payments`,
   `payroll_runs`…): sólo `NOT NULL` y `code` único. La base acepta cualquier id.
2. **Semillas que mezclaban ids fijos con upserts por código**: `onConflictDoUpdate({ target: code })`
   conserva el id de la fila preexistente, así que los `IDs.usd`/`IDs.bank1` **nunca** se
   materializaban y todas las referencias a ellos quedaban colgando.
3. **Upserts que no hacían nada**: `set: { name: table.name }` compila a `SET name = "table"."name"`;
   la fila no se actualizaba nunca.

Además, el volumen actual (10 facturas, 5 pagos, 8 comprobantes de retención, 44 reglas) hacía
imposible validar a ojo. Esta spec convierte esa validación en **código ejecutable** y arregla las
semillas y los flujos que el barrido visual destapó.

## 2. Objetivo

1. Que las semillas dejen siempre una base **coherente y verificable**, con el volumen actual.
2. Que exista un **gate único** de integridad que corra en la semilla, a mano y en CI.
3. Que los flujos completos (pedido → factura → cobro/pago → retención → reporte fiscal) se puedan
   recorrer de punta a punta en la UI sin callejones sin salida.

## 3. Gate de integridad (`seed-integrity.ts`)

`INTEGRITY_CHECKS` es una lista de consultas SQL; cada una devuelve las filas que **violan** la
regla. `auditIntegrity()` produce el reporte y `assertIntegrity()` lanza si algo falla.

| Módulo       | Reglas | Ejemplos                                                                                                                               |
| ------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Seguridad    | 6      | email único, contraseña hasheada, un rol y una sucursal por usuario                                                                    |
| Multimoneda  | 6      | una sola moneda funcional, la funcional **no** tiene tasas, una tasa/día                                                               |
| Operaciones  | 10     | documentos con moneda, partner y sucursal válidos; saldo ≤ total                                                                       |
| Inventario   | 6      | stock por producto/almacén existente, `inventory_moves.code` único                                                                     |
| Tesorería    | 4      | pagos con método/cuenta/partner válidos; `amount_base` = `amount × tasa`                                                               |
| Contabilidad | 3      | asientos balanceados, cuentas imputables, mapeos completos                                                                             |
| Histórico    | 9      | eventos con usuario válido, **cada compra emitida con IVA tiene comprobante**, cada comprobante tiene línea, correlativo fiscal al día |

Se ejecuta en tres puntos para que no vuelva a pasar:

```bash
pnpm --filter database db:verify        # auditoría manual (dev)
docker compose run --rm db-setup        # semilla: falla si deja la base incoherente
pnpm --filter database test             # CI: gate tras sembrar dos veces (idempotencia)
```

## 4. Correcciones en las semillas

| #   | Corrección                                                                                          |
| --- | --------------------------------------------------------------------------------------------------- |
| 1   | `currencyIds` y `bankIds` se resuelven **por código** después del upsert; nunca se asume el id fijo |
| 2   | Todos los `onConflictDoUpdate` usan `sql\`excluded.<columna_snake_case>\`` (antes eran no-ops)      |
| 3   | La moneda funcional es **VES** y no tiene tasa; el dólar lleva `FIXTURE_USD_RATE = 36,5`            |
| 4   | `bank_accounts.bankId` y los pagos llevan `amountBase = amount × tasa`                              |
| 5   | Se siembran compras (`COMP-000001..3`), nota de crédito, préstamo y movimientos de inventario       |
| 6   | `seedPositions` y `seedDepartments` usan las columnas reales del esquema (sin `isActive`/`level`)   |
| 7   | Los empleados se re-upsertan con cargo, departamento y estado                                       |
| 8   | `seedPurchaseRetentions`: ajustes legales (IVA 75/100 %, ISLR 1 %) + comprobantes **y sus líneas**  |
| 9   | `reset.ts` borra también el esquema `drizzle` (si no, `migrate` cree que todo está aplicado)        |

Migraciones nuevas:

- `0024_purge_base_currency_rates.sql` — borra tasas de la moneda funcional en cualquier entorno.
- `0025_inventory_move_code_unique.sql` — índice único en `inventory_moves.code`.

## 5. Defectos encontrados en el barrido y corregidos

| ID   | Pantalla / flujo          | Defecto                                                                                                                                                    | Corrección                                                                 |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| M-14 | `/finance/retentions`     | Llamaba a `/accounting/retentions` (404) y leía una forma inexistente                                                                                      | Reescrita contra `/treasury/retentions` + export TXT/XML                   |
| M-15 | Facturación (KPI)         | "Total facturado" sumaba borradores y anuladas; "Anuladas" las ignoraba                                                                                    | Sólo `POSTED/PAID/PARTIAL` cuentan y se convierte a moneda funcional       |
| M-16 | BI (`/bi/kpis             | chart                                                                                                                                                      | activity`)                                                                 | Sumaba `total` de monedas distintas y no filtraba por sucursal | `total × exchange_rate`, `payments.amount_base`, `@CurrentBranch` |
| M-17 | RRHH cargos/departamentos | Leía columnas inexistentes → `Bs.S NaN` e "Inactivo"                                                                                                       | Alineado al esquema real                                                   |
| M-18 | Tesorería                 | Saldo total en 0 y banco vacío: la UI leía `balance`, el DTO es `currentBalance`                                                                           | DTO enriquecido con `bankName`/`currencyCode`; saldo por moneda convertido |
| M-19 | Guard de rutas            | `/forbidden` existe, pero el guard no distinguía "sin permiso" de 404                                                                                      | Verificado: redirige a la pantalla 403 con motivo                          |
| M-20 | Cuentas por pagar         | `finance:payables:view` era alias de `finance:invoices:view` → el vendedor entraba al CxP                                                                  | Permiso propio + `@RequirePermissions` en los endpoints                    |
| M-21 | Ficha de factura          | Mostraba el saldo pero **no** dejaba cobrar                                                                                                                | `PaymentDialog` compartido CxC/CxP + acción "Registrar cobro"              |
| M-22 | Histórico de la factura   | Terminaba en la emisión: el cobro/pago no dejaba evento                                                                                                    | `PAYMENT_REGISTERED`/`PAYMENT_VOIDED` al registrar y anular                |
| M-23 | Correlativos              | `PAY-00005` convivía con `PAY-000001` (anchos distintos)                                                                                                   | Ancho único de 6 dígitos                                                   |
| M-24 | Retenciones (rol)         | MANAGER paga al proveedor y no ve el comprobante: se verificó que lo ve **en la ficha de la compra**; el libro fiscal sigue siendo del ACCOUNTANT (`S-14`) | Sin cambio de permisos; documentado                                        |
| M-25 | Retenciones (moneda)      | Base e IVA de una compra en USD se etiquetaban como Bs.S                                                                                                   | Base/IVA en la moneda del documento; retenido en funcional                 |
| M-26 | Semilla de retenciones    | Ajustes con ISLR 0 % y ninguna compra con comprobante                                                                                                      | Ajustes legales sembrados + comprobantes IVA/ISLR                          |
| M-27 | Export SENIAT             | TXT y XML salían en 0/vacíos: leen `tax_retention_lines`, no la cabecera                                                                                   | La semilla inserta la línea de cada comprobante                            |
| M-28 | Cotización de pedido      | Los KPI/estadísticas de facturación mezclaban ventas y compras                                                                                             | `GET /billing/invoices/stats?type=`                                        |
| M-29 | Ficha de compra           | Estado `PARTIAL` se mostraba como enum crudo; la línea sumaba el IVA en su total; el comprobante repetía el número                                         | `statusLabel('PARTIAL')`, línea = cantidad × precio, voucher una sola vez  |
| M-30 | Semilla de eventos        | El histórico atribuía al vendedor documentos registrados por el contador                                                                                   | El autor del evento es el autor del documento                              |

## 6. Criterios de aceptación

1. `db-setup` termina con `Integridad OK: 44 reglas verificadas` y sin huérfanos.
2. Sembrar dos veces seguidas no duplica filas ni cambia ids (`seed.test.ts`).
3. Un pedido de venta se puede: crear → confirmar → facturar → postear → **cobrar**, y su histórico
   muestra los cinco pasos con usuario y hora.
4. Un pedido de compra se puede: crear → confirmar → facturar → postear, y **genera el comprobante
   de retención** visible en la ficha y en `/finance/retentions`.
5. El TXT de IVA y el XML de ISLR del SENIAT contienen importes reales para el rango exportado.
6. TESORERÍA: el saldo total se expresa en moneda funcional y las cuentas muestran banco y moneda.
7. Ningún rol ve en el menú ni por URL directa una pantalla sin permiso: cae en `/forbidden` (403).

## 7. Verificación ejecutada

| Comprobación                                                   | Resultado                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm typecheck`                                               | 6/6 paquetes OK                                                 |
| `pnpm lint`                                                    | 0 errores                                                       |
| `pnpm --filter database test`                                  | 55 pruebas (incluye el gate de integridad y doble siembra)      |
| `pnpm --filter backend test`                                   | 1135 pruebas OK                                                 |
| `pnpm --filter frontend test`                                  | 385 pruebas OK                                                  |
| `pnpm build`                                                   | 4/4 tareas OK                                                   |
| Barrido visual (ADMIN, MANAGER, SELLER, ACCOUNTANT, WAREHOUSE) | sin errores de consola, sin 4xx/5xx inesperados, sin `NaN`      |
| Flujo venta completo por UI                                    | ORD → A-00001 → PAY-00004, histórico con 5 hitos                |
| Flujo compra completo por UI                                   | ORD → A-00002 → `RET-IVA-2026-000001` (USD 54,00 = 75 % de IVA) |
| Export SENIAT                                                  | 4 líneas TXT y 4 `<Retencion>` en el XML                        |

## 8. Riesgos abiertos

- ~~**Sin FK reales** en las tablas de documentos~~ → **resuelto en [`S-17`](./S-17-integridad-referencial.md)**:
  148 FK del núcleo con semántica de borrado explícita y tres reglas del gate que impiden volver atrás.
- `invoices.status` admite `CANCELLED` (alias heredado de `VOID`) y `EPayroll`/`PARTIAL` fuera del
  enum de TypeScript. Propuesta: normalizar en una migración con `UPDATE`.
- Bancos e Impuestos siguen siendo stubs de UI (`T-09-26`).
