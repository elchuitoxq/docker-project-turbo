# Ejecución 2026-10-31 · Barrido de integridad y flujos completos

| Campo         | Valor                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Entorno       | Docker Compose local (`mono-backend`, `mono-frontend`, `mono-postgres`)  |
| Base de datos | Reconstruida desde cero (`db:reset` + `db-setup`), semilla `db:seed:dev` |
| Semilla       | `Integridad OK: 44 reglas verificadas` (dos corridas seguidas)           |
| Ejecutor      | Barrido automatizado con Playwright + revisión visual de cada pantalla   |
| Historias     | [`S-16`](../../sdd/specs/S-16-integridad-seeds.md)                       |

## 1. Preparación

1. `db:reset` + `docker compose run --rm db-setup` (migraciones + semilla).
2. La semilla ejecuta el gate de integridad y falla si deja huérfanos.
3. Dos corridas consecutivas del seed no duplican filas (`55` pruebas del paquete `database`).

## 2. Barrido por rol (rutas del menú + URLs escritas a mano)

Se recorrieron las 38 rutas del menú con cada rol, capturando errores de consola, respuestas
`>= 400` de la API y textos con `NaN`, `undefined` o `Invalid Date`.

| Rol         | Rutas permitidas | Resultado                                                            |
| ----------- | ---------------- | -------------------------------------------------------------------- |
| SUPER_ADMIN | 38               | OK                                                                   |
| ADMIN       | 38               | OK                                                                   |
| MANAGER     | 32               | OK · sin acceso a Usuarios, Roles, Auditoría ni Retenciones (fiscal) |
| SELLER      | 10               | OK · CxP, Tesorería, Cierre diario, Compras y RRHH caen en `403`     |
| WAREHOUSE   | 6                | OK · sólo inventario y panel                                         |
| ACCOUNTANT  | 24               | OK · sin ventas ni pedidos                                           |

Criterio verificado: una ruta sin permiso **no** muestra la vista ni un 404, redirige a
`/forbidden?reason=no-permission` con el mensaje del motivo.

## 3. Flujos de escritura ejercitados

### 3.1 Venta (MANAGER)

| Paso | Acción                           | Verificación                                                                |
| ---- | -------------------------------- | --------------------------------------------------------------------------- |
| 1    | Pedido de venta, USD, tasa 36,50 | total `USD 1.500,00`; histórico: 1 movimiento                               |
| 2    | Confirmar                        | estado `Confirmado`; histórico: 2 movimientos (con "Borrador → Confirmado") |
| 3    | Facturar                         | `A-00001` en borrador; histórico: 4 movimientos (pedido + factura)          |
| 4    | Postear                          | estado `Emitida`, IVA e IGTF calculados; histórico: 5 movimientos           |
| 5    | Registrar cobro (transferencia)  | estado `Pagada`, pago `PAY-00004`, evento "Pago registrado"                 |

### 3.2 Compra (MANAGER)

| Paso | Acción                                           | Verificación                                                    |
| ---- | ------------------------------------------------ | --------------------------------------------------------------- |
| 1    | Pedido de compra: el selector filtra proveedores | sólo `Proveedor Internacional` y `Servicios Integrados`         |
| 2    | Confirmar + Facturar + Postear                   | `A-00002`; al postear se emite `RET-IVA-2026-000001`            |
| 3    | Retención en la ficha                            | USD 54,00 = 75 % del IVA de USD 72,00                           |
| 4    | Pagar en Cuentas por pagar                       | `COMP-000001` pasa a `Pagada`; saldo 0                          |
| 5    | Export SENIAT                                    | TXT de IVA con 4 líneas reales; XML de ISLR con 4 `<Retencion>` |

### 3.3 Tesorería y multimoneda

| Pantalla                 | Antes                                        | Después                                             |
| ------------------------ | -------------------------------------------- | --------------------------------------------------- |
| Tesorería (saldos)       | `Bs.S 0,00`, banco vacío                     | `Bs.S 60.225,00`, `Banco Provincial · USD 1.650,00` |
| Facturación (KPI ventas) | 6 emitidas y `158.775,00` (mezclaba compras) | 3 emitidas y `Bs.S 61.393,00`                       |
| Retenciones              | 0 comprobantes                               | 6 comprobantes; base/IVA en USD y retenido en Bs.S  |
| Cargos RRHH              | `Bs.S NaN`                                   | rango `Bs.S 800,00 – 1.200,00`                      |

## 4. Defectos encontrados

Todos corregidos y documentados en [`S-16` §5](../../sdd/specs/S-16-integridad-seeds.md):
M-14 a M-28 (15 hallazgos, 14 corregidos; M-24 quedó como decisión de rol documentada).

La segunda pasada, ya con las FK activas, añadió **M-29 … M-31** (estado `PARTIAL` sin traducir, línea
de compra con el IVA sumado, autor del evento equivocado y saldo negativo en una compra "pagada"), en
[`S-16` §5](../../sdd/specs/S-16-integridad-seeds.md) y [`S-17` §6](../../sdd/specs/S-17-integridad-referencial.md).

## 5. Regresión ejecutada al cierre

| Comando                         | Resultado       |
| ------------------------------- | --------------- |
| `pnpm turbo run typecheck lint` | 0 errores       |
| `pnpm --filter database test`   | 55 pruebas OK   |
| `pnpm --filter backend test`    | 1135 pruebas OK |
| `pnpm --filter frontend test`   | 385 pruebas OK  |
| `pnpm build`                    | 4/4 tareas OK   |
| `db:reset` + `db-setup` ×2      | 48 reglas OK    |

## 6. Deuda identificada

1. ~~**Sin FK reales** en las tablas de documentos~~ → cerrado en [`S-17`](../../sdd/specs/S-17-integridad-referencial.md)
   (148 FK + 4 reglas nuevas del gate: columnas de referencia sin FK, FK sin validar, huérfanos y saldo negativo).
2. `invoices.status` acepta `CANCELLED` como alias de `VOID` y `PARTIAL` fuera del enum.
3. Bancos e Impuestos siguen siendo stubs de UI.
4. No hay pantalla para **crear** facturas de compra: hoy nacen del pedido de compra.

## 7. Cierre de la regresión multimoneda (`S-18`)

Sesión de certificación del 2026-10-31 sobre `S-18`: factura de venta en dólares abonada en bolívares y
en dólares, más anulación del abono. Detalle normativo en
[`S-18`](../../sdd/specs/S-18-multimoneda-imputacion.md).

> Estado previo: `db:reset` + `db:migrate` + `db:seed:dev` → **52/52 reglas**. Los comandos de base
> corren en el host y necesitan `DATABASE_URL` y `SEED_ENV=development` exportados.

### 7.1 Factura A-00001 · 119,48 USD a tasa 36,50

| Paso                                         | Resultado                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Emisión (100 + IVA 16 + IGTF 3,48)           | `POSTED` · tasa congelada 36,50                                                                          |
| Tasa del día llevada a 40,00                 | override manual aceptado                                                                                 |
| Abono 2.389,60 Bs a `VES-001` (`PAY-000006`) | `invoice_amount` 59,74 · diferencia cambiaria 209,09 · factura `PARTIAL`                                 |
| Abono 59,74 USD a `USD-001` (`PAY-000007`)   | `invoice_amount` 59,74 · diferencia cambiaria 209,09 · factura **`PAID`**                                |
| Saldo de la factura                          | total 119,48 · imputado 119,48 · **saldo 0,00**                                                          |
| Cuenta `USD-001`                             | 5.000,00 → **5.519,74 USD**                                                                              |
| Cuenta `VES-001`                             | 12.000,00 → **14.389,60 Bs**                                                                             |
| Asientos                                     | cada uno: débito 2.389,60 = Clientes 2.180,51 + diferencia cambiaria 209,09                              |
| Histórico                                    | `Cobro PAY-000006 por 2389.6 VES (59.74 USD) del cliente` · `Cobro PAY-000007 por 59.74 USD del cliente` |

### 7.2 Rechazos verificados

| Caso                                   | Respuesta                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Pago en USD sobre cuenta en Bs         | `400 · La cuenta VES-001-123456 está en VES: un cobro/pago en otra moneda descuadra el saldo de la cuenta` |
| Método `TRANSFER` sin cuenta           | `400 · El método de pago afecta el saldo de una cuenta: indica la cuenta bancaria del cobro/pago`          |
| Imputar más que el saldo del documento | `400 · La asignación (...) supera el saldo de la factura (...)`                                            |

### 7.3 Anulación (factura A-00002 · abono 2.000 Bs sobre 59,74 USD)

| Comprobación        | Resultado                                                     |
| ------------------- | ------------------------------------------------------------- |
| Factura tras anular | `POSTED` · pagado 0,00                                        |
| Asiento del pago    | `CANCELLED` (se conserva la traza, deja de sumar en el mayor) |
| Cuenta `VES-001`    | vuelve a 14.389,60 Bs (movimientos `POSTED` solamente)        |
| Histórico           | `Pago PAY-000009 anulado`                                     |

### 7.4 UI verificada

Diálogo de cobro de `A-00002`: la cuenta se elige primero y manda la moneda. Con `VES-001` el monto
sugerido es **2.389,6** y el desglose `Bs.S 2.389,60`; al cambiar a `USD-001` pasa a **59,74** y
`USD 59,74 · Bs.S 2.389,60`. La etiqueta del campo sigue la moneda de la cuenta (`Monto (VES)` /
`Monto (USD)`).

### 7.5 Regresión de cierre

| Comando                                  | Resultado       |
| ---------------------------------------- | --------------- |
| `pnpm turbo run typecheck lint`          | 0 errores · 4/4 |
| `pnpm --filter database test`            | 55 pruebas OK   |
| `pnpm --filter backend test`             | 1140 pruebas OK |
| `pnpm --filter frontend test`            | 385 pruebas OK  |
| `pnpm turbo run build`                   | 4/4 tareas OK   |
| `db:verify` con los documentos de prueba | 52/52 reglas    |

### 7.6 Deuda que queda abierta

1. ~~El asiento de la **factura** sólo se genera desde el endpoint manual y sin desglose de IVA/IGTF~~ →
   cerrado en [`S-19`](../../sdd/specs/S-19-asiento-fiscal-factura.md): posteo al emitir, anulación al
   anular y desglose base/IVA/IGTF.
2. El IGTF se calcula en la factura; falta el del pago en efectivo en divisa.
3. ~~`bank_account → cuenta contable`: hoy todo va a `1.1.1.002`~~ → cerrado en `S-19`
   (`bank_accounts.accounting_account_id`, columna y selector en la UI, semilla enlazada).
4. No hay pantalla de conciliación contable (mayor vs tesorería vs extracto) ni endpoint de recálculo
   masivo de saldos.
5. Asientos pendientes: retenciones, notas de crédito y costo de ventas.

## 8. Asiento fiscal y banco por cuenta contable (`S-19`)

Segunda pasada de la misma sesión, ya sobre el libro completo. Detalle normativo en
[`S-19`](../../sdd/specs/S-19-asiento-fiscal-factura.md).

| Verificación                                                  | Resultado                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `db:reset` + 28 migraciones + semilla                         | **55/55 reglas**                                                                      |
| Factura `A-00004` (100 + IVA 16 + IGTF 3,48 USD a tasa 36,50) | Clientes 4.361,02 · Ingresos 3.650,00 · IVA débito 584,00 · IGTF 127,02 · cuadrado    |
| Cobro 1.000 Bs a `VES-001`                                    | pata del banco en `1.1.1.002` · Clientes 1.000,10 · FX 0,10                           |
| Cobro 64,69 USD a `USD-001` (factura `A-00003`)               | pata del banco en `1.1.1.003` · Clientes 2.587,60 · FX 226,41                         |
| Anular factura con asiento                                    | asiento en `CANCELLED`                                                                |
| UI **Cuentas bancarias**                                      | columna "Cuenta contable" (`1.1.1.003` / `1.1.1.002`) y selector limitado a `1.1.1.*` |
| `pnpm turbo run typecheck lint` / `build`                     | 0 errores · 4/4                                                                       |
| `pnpm --filter backend test` / `database` / `frontend`        | 1144 · 55 · 385 pruebas OK                                                            |

## 9. Maestros de Configuración que eran stubs (`S-20`)

Las rutas `/dashboard/settings/banks` y `/dashboard/settings/tax-concepts` mostraban el cartel de
módulo pendiente aunque el backend estaba completo. Detalle en
[`S-20`](../../sdd/specs/S-20-maestros-bancos-impuestos-ui.md).

| Verificación                                  | Resultado                                                       |
| --------------------------------------------- | --------------------------------------------------------------- |
| `/settings/banks`                             | 3 bancos sembrados (0108, 0137, 0105), alta/edición y toggle UI |
| `/settings/tax-concepts`                      | 6 conceptos de ISLR con su porcentaje                           |
| Alta y borrado de un concepto desde la UI     | creado y eliminado; la tabla vuelve a 6                         |
| Ficha del proveedor `Proveedor Internacional` | selector "Concepto de ISLR" con `ISLR-SER` (1 %)                |
| Semilla `seedTaxConcepts()`                   | 6 conceptos, idempotente al resembrar                           |
| `pnpm --filter frontend test`                 | 387 pruebas OK                                                  |

**Defecto corregido:** `formatMoney(x, 'Bs.S')` lanzaba `RangeError: Invalid currency code` (Intl
sólo acepta ISO); las celdas de importes usan `VES`.

## 10. Retención de ISLR unificada (`S-21`)

El concepto del proveedor no participaba del cálculo: el ISLR salía siempre de los parámetros de la
empresa y la línea del comprobante guardaba `concept_id = null`. Detalle en
[`S-21`](../../sdd/specs/S-21-regla-retencion-islr.md).

Precedencia certificada por API con la empresa en **2 %** y `ISLR-SER` en **1 %**:

| Compra    | Proveedor                 | Retenido | `applied_rate` | `rule_source` | Concepto en la línea |
| --------- | ------------------------- | -------- | -------------- | ------------- | -------------------- |
| `A-00007` | Proveedor Internacional   | 10,00    | 1,00           | `CONCEPT`     | `ISLR-SER`           |
| `A-00008` | Servicios Integrados C.A. | 20,00    | 2,00           | `SETTINGS`    | —                    |

| Comprobación                              | Resultado                                     |
| ----------------------------------------- | --------------------------------------------- |
| `db:reset` + 29 migraciones + semilla     | **57/57 reglas**                              |
| Semilla dos veces                         | sin duplicados y completa comprobantes viejos |
| Pantalla **Retenciones al proveedor**     | guarda 1,5 % y vuelve a 1 % desde la UI       |
| `pnpm --filter backend test`              | 1150 pruebas OK (6 nuevas)                    |
| `pnpm --filter database` / `frontend`     | 55 · 387 pruebas OK                           |
| `pnpm turbo run typecheck lint` / `build` | 0 errores · 4/4                               |

## 11. Sustraendo de ISLR en UT (`S-22`)

Con el concepto ya mandando en la retenci�n, faltaba que el sustraendo pudiera expresarse en
**unidades tributarias**, que es como lo escribe la ley. Detalle en
[`S-22`](../../sdd/specs/S-22-sustraendo-unidad-tributaria.md).

Prueba por API con la UT sembrada en **43,00 Bs** (desde 02/06/2025) y el concepto `ISLR-SER` con
sustraendo **0,10 UT**, sobre una compra de 1.000 + 160:

| Paso                           | Resultado                                                |
| ------------------------------ | -------------------------------------------------------- |
| 1.000 � 1 %                    | 10,00                                                    |
| Sustraendo 0,10 UT � 43 Bs     | -4,30                                                    |
| **Retenido en el comprobante** | **5,70** � `applied_rate` 1,00 � `rule_source` `CONCEPT` |

| Comprobaci�n                              | Resultado                          |
| ----------------------------------------- | ---------------------------------- |
| `db:migrate` + semilla (30 migraciones)   | **59/59 reglas**                   |
| UI: sustraendo `0,5` unidad **UT**        | persistido y visible en el maestro |
| `pnpm --filter backend test`              | 1155 pruebas OK (4 nuevas de UT)   |
| `pnpm --filter database` / `frontend`     | 55 � 387 pruebas OK                |
| `pnpm turbo run typecheck lint` / `build` | 0 errores � 4/4                    |

## 12. Tasa del fixture alineada a la tasa oficial (`889,58`)

La semilla congelaba **36,50 Bs/USD**; se cambi� a **889,58** para que los importes en bol�vares de la
demostraci�n se parezcan a los reales. Detalle en
[`S-08` �11.1](../../sdd/specs/S-08-multimoneda.md).

| Comprobaci�n                         | Resultado                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `exchange_rates`                     | USD `889,5800000000` � fuente `TEST` � 31/10/2026                                        |
| Facturas sembradas                   | `INV-000001` 580,00 USD ? **Bs.S 515.956,40**; `INV-000004` 1.160,00 ? Bs.S 1.031.912,80 |
| Cobros sembrados                     | `PAY-000001` 464,00 USD ? `amountBase` **412.765,12**                                    |
| Comprobantes de retenci�n            | `COMP-000001` IVA 120,00 ? `total_retained_base` **106.749,60** (tasa refrescada)        |
| Pantalla de monedas                  | `USD 889,58` � `31/10/2026 � hoy`, sin aviso de tasa vencida                             |
| Total facturado (VES) en Facturaci�n | `Bs.S 1.512.164,40`                                                                      |

**Dos defectos corregidos en el camino:**

1. La fila de la tasa se fechaba con `setUTCHours(0)`, as� que al oeste de Greenwich ca�a en el d�a
   siguiente y la UI la marcaba vencida (`-1 d�as`), bloqueando la emisi�n. Ahora se ancla al d�a local.
2. Al resembrar, los comprobantes ya emitidos conservaban la tasa vieja (36,50) aunque la factura
   hubiera cambiado: el relleno idempotente ahora refresca importes y tasa.

## 13. Movimientos de inventario (`S-23`)

La ruta `/dashboard/inventory/moves` s�lo listaba: no hab�a formulario de alta, el cliente enviaba un
vocabulario que el API rechaza, el tipo **Ajuste** no exist�a en el backend y cancelar un borrador
fallaba por falta de motivo. Detalle en [`S-23`](../../sdd/specs/S-23-movimientos-inventario.md).

| Movimiento aplicado  | Stock antes | Stock despu�s |
| -------------------- | ----------- | ------------- |
| `ENTRADA` de 5       | 30          | **35**        |
| `SALIDA` de 2        | 35          | **33**        |
| `TRANSFERENCIA` de 1 | 33 / 0      | **32 / 1**    |
| `AJUSTE` contado 20  | 32          | **20**        |
| `AJUSTE` contado 0   | 1           | **0**         |

| Comprobaci�n                              | Resultado                                            |
| ----------------------------------------- | ---------------------------------------------------- |
| Tarjetas del listado (semilla nueva)      | Entrada 2 � Salida 2 � Transferencia 1 � Ajuste 1    |
| Alta de entrada desde el formulario       | toast "Movimiento creado en borrador�" y listado 6?7 |
| Tipo Ajuste en el formulario              | etiquetas "Almac�n a ajustar" y "Contado"            |
| `pnpm --filter backend test`              | 1162 pruebas OK (7 nuevas de movimientos)            |
| `pnpm --filter database` / `frontend`     | 55 � 387 pruebas OK                                  |
| `pnpm turbo run typecheck lint` / `build` | 0 errores � 4/4                                      |

**Defecto encontrado en la prueba visual:** con el formulario abierto el bot�n "Crear movimiento"
quedaba fuera del viewport (el di�logo no scrolleaba) y era imposible enviarlo. Se agreg�
`max-h-[90vh] overflow-y-auto` al `DialogContent`.

## 14. Controles de inventario: motivo, tolerancia, lotes y costo promedio (`S-25`)

Se revisó la deuda declarada tras `S-23` y se descartó la recomendación de retirar
`inventory:moves:approve` al WAREHOUSE: el almacén es maestro de su rol y sin la aprobación no cierra
su trabajo. El control se ejerció como en SAP: motivo obligatorio, tolerancia de conteo con escalamiento
y valuación de media móvil en el maestro de material.

| Comprobación                                   | Resultado                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Ajuste sin motivo / con motivo inexistente     | `400` con el catálogo de motivos en el mensaje                             |
| Ajuste 100 → 105 (5 %)                         | dentro de tolerancia: lo aprueba el creador                                |
| Ajuste 100 → 50 (50 %)                         | `requiresSecondApproval`; creador `403`; gerente `200`                     |
| Ajuste desde stock 0                           | siempre escalado                                                           |
| Lotes del producto por lotes (`GET …/batches`) | `L-2026-A` (20) y `L-2026-B` (15), ordenados por vencimiento               |
| Entrada con `batchNumber` nuevo                | lote `L-2026-C` creado y stock en ese lote                                 |
| FEFO tras la recepción                         | `L-2026-C` primero (vence 2026-09-30)                                      |
| Costo promedio                                 | 15,00 → **18,33** = (35×15 + 10×30) / 45                                   |
| Stock en pantalla                              | columnas «Costo prom.» y «Valor» (300,00 / 225,00)                         |
| Listado de movimientos                         | casillas, «seleccionar todo», motivo del ajuste y «Requiere 2ª aprobación» |
| `approve-batch` con dos borradores             | `aprobados = 2`, `fallidos = 0`                                            |
| `db:reset` + `db:migrate` + `db:seed:dev`      | semilla completa y **62/62** reglas de integridad                          |
| `pnpm --filter backend test`                   | 1177 pruebas OK (22 nuevas de controles de inventario)                     |
| `pnpm --filter database` / `frontend`          | 55 / 408 pruebas OK                                                        |
| `pnpm turbo run typecheck lint` / `build`      | 0 errores · 12/12 y 4/4                                                    |

**Defecto encontrado y corregido durante la prueba:** dos altas de movimiento simultáneas calculaban el
mismo consecutivo y la segunda rompía el índice único con un `500`. Ahora el alta reintenta con el
siguiente número (mismo criterio que el «número bloqueado» de SAP).

## 15. Despacho por lote: vencimiento y excepción FEFO (`S-26`)

Se cerró la deuda de S-25 sobre el despacho: el FEFO era una sugerencia y un lote vencido o bloqueado
se podía sacar igual. Las tres reglas se validan al **crear** el movimiento, no al aprobarlo.

| Comprobación                              | Resultado                                                           |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `GET …/products/HOG-003/batches`          | 4 lotes con `expired` / `isActive`: vencido, A, B y bloqueado       |
| Salida con lote vencido                   | `400` «está vencido (2025-12-31)»                                   |
| Salida con lote que vence hoy             | `201` (el día del vencimiento todavía se despacha)                  |
| Salida con lote bloqueado                 | `400` «está bloqueado»                                              |
| Salida sin lote en producto con lotes     | `400` «maneja lotes: hay que indicar de qué lote sale»              |
| Salida saltándose el FEFO                 | `400` nombrando el lote que vence antes                             |
| Excepción FEFO con motivo vacío           | `400` «hay que indicar el motivo»                                   |
| Excepción FEFO con motivo                 | `201` con `fefoOverride` y el motivo guardado                       |
| Listado de movimientos                    | distintivo **Fuera de FEFO** en `MOV-000009` y en el creado por API |
| `db:reset` + migración + semilla          | **64/64** reglas de integridad                                      |
| `pnpm --filter backend test`              | 1186 pruebas OK (9 nuevas de despacho por lote)                     |
| `pnpm --filter database` / `frontend`     | 55 / 416 pruebas OK                                                 |
| `pnpm turbo run typecheck lint` / `build` | 0 errores · 12/12                                                   |

**Nota de entorno:** la suite completa falló una vez en `supplier-retention-rule.test.ts` y pasó al
repetirse (flaky de carga con la base compartida, no relacionado con estos cambios); se repitió la suite
completa y quedó en verde.

**Deuda de esta sección:** la reserva de lote y el bloqueo automático al vencer se cerraron en la
sección 16; el gate subió a 66 reglas.

## 16. Cierre de la deuda de `S-26`: reserva de lote y bloqueo automático

Se cerraron las dos deudas que quedaban abiertas: dos salidas simultáneas ya no pueden prometer el mismo
lote (reserva por documento) y el lote vencido se bloquea solo con un job diario. El promedio por
sucursal se mantiene como **decisión** (una sola sociedad, área de valoración = empresa), no como
pendiente.

| Comprobación                                            | Resultado                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| Dos salidas sobre el mismo lote (10 disponibles, 6 y 5) | la primera `201`; la segunda `400` «disponible 4, solicitado 5» |
| Rechazo de la primera salida                            | libera la reserva y la segunda ya se puede crear                |
| Aprobación de la salida                                 | reserva `RELEASED`, stock 10 → 6 y cantidad disponible de nuevo |
| Lote reservado por completo                             | el FEFO sugiere el siguiente lote utilizable, sin excepción     |
| `GET …/products/:id/batches`                            | expone `reservedQuantity` y `availableQuantity` neta            |
| Job diario (00:05 America/Caracas)                      | bloquea vencidos; el que vence hoy y el futuro siguen activos   |
| Segunda ejecución del job                               | idempotente: no vuelve a reportar los ya bloqueados             |
| `db:reset` + migración `0033` + semilla + `db:verify`   | **66/66** reglas de integridad                                  |
| `pnpm --filter backend test`                            | 1195 pruebas OK (9 nuevas de reserva y bloqueo)                 |
| `pnpm --filter database` / `frontend`                   | 55 / 416 pruebas OK                                             |
| `pnpm turbo run typecheck lint` / `build`               | 0 errores · 12/12                                               |
