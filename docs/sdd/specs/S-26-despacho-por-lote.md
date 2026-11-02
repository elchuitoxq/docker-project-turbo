# S-26 — Despacho por lote: vencimiento, bloqueo y excepción FEFO

| Campo      | Valor                                                |
| ---------- | ---------------------------------------------------- |
| Estado     | Implementado                                         |
| Prioridad  | P1                                                   |
| Alcance    | `apps/backend`, `apps/frontend`, `packages/database` |
| Depende de | S-25 (lotes, costo promedio, aprobación en lote)     |
| Fecha      | 2026-11-02                                           |

## 1. Contexto

`S-25` cerró la creación y consulta de lotes, pero dejó tres huecos declarados:

1. el lote sugerido se podía ignorar sin dejar rastro;
2. un lote **vencido** o **bloqueado** se podía despachar igual;
3. la salida de un producto con lotes podía ir **sin lote**, con lo que el descuento no tocaba el lote
   y el vencimiento dejaba de tener sentido.

Un ERP no deja eso en manos del usuario: el vencimiento es un control de calidad y el FEFO es la regla
de rotación. Ambos se validan al **crear** el documento (no al aprobarlo), para que el almacenista vea
el rechazo mientras captura y no cuando el movimiento ya está en la cola de autorización.

El cierre de la deuda añadió dos piezas que faltaban para que esas reglas sean operables:

- **Reserva de lote.** Una salida en borrador aparta la existencia que promete; dos documentos
  simultáneos ya no pueden prometer el mismo lote.
- **Bloqueo automático al vencer.** Un job diario marca `is_active = false` en los lotes vencidos, sin
  esperar a que alguien se acuerde. La baja del stock sigue siendo un ajuste manual con motivo
  `VENCIMIENTO`: sacar mercancía del inventario es una decisión contable.

## 2. Reglas implementadas

| Regla                                           | Respuesta del API                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Producto con lotes y línea sin lote             | `400` «maneja lotes: hay que indicar de qué lote sale»               |
| Lote inexistente (por número)                   | `400` «El lote X no existe para el producto Y»                       |
| Lote bloqueado (`is_active = false`)            | `400` «está bloqueado y no se puede despachar»                       |
| Lote vencido (`expiration_date` anterior a hoy) | `400` «está vencido (AAAA-MM-DD) y no se puede despachar»            |
| Se elige un lote posterior al sugerido por FEFO | `400` con el número del lote que vence antes                         |
| Excepción FEFO sin motivo                       | `400` «hay que indicar el motivo (fefoOverrideReason)»               |
| Excepción FEFO con motivo                       | `201`; el movimiento guarda `fefo_override` y `fefo_override_reason` |

Detalles de criterio:

- **Vence hoy todavía se despacha.** La comparación es por día contra la medianoche local: bloquear el
  mismo día del vencimiento genera mermas evitables.
- **La sugerencia excluye vencidos y bloqueados.** Sugerir un lote que el propio despacho va a rechazar
  sería un callejón sin salida; si no queda ninguno utilizable, no hay sugerencia y manda la regla de
  vencimiento/bloqueo.
- **La excepción es del movimiento, no de la línea.** `fefo_override` + un motivo describen el caso
  (habitualmente «el cliente exige este lote»); se muestra como distintivo en el listado.
- Solo aplica a `SALIDA`. Una transferencia o una entrada no consumen mercancía, así que un lote
  vencido puede seguir entrando al almacén (después se dará de baja con un ajuste por vencimiento, que
  ya exige motivo desde `S-25`).

## 3. Implementación

### 3.1 Base de datos — migración `0032_inventory_batch_dispatch.sql`

| Cambio                                 | Para qué                                        |
| -------------------------------------- | ----------------------------------------------- |
| `inventory_moves.fefo_override`        | Marca el despacho fuera de la regla de rotación |
| `inventory_moves.fefo_override_reason` | Motivo de la excepción, auditable               |

La deuda cerró con la migración `0033_inventory_batch_reservations.sql`:

| Cambio                                                | Para qué                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Tabla `inventory_batch_reservations`                  | Aparta existencia de un lote para un documento en borrador   |
| `status` (`ACTIVE` / `RELEASED`) y `releasedAt`       | La reserva se libera al aprobar o rechazar, y queda auditada |
| Índice `(warehouse_id, product_id, batch_id, status)` | Cálculo rápido de lo reservado al validar y sugerir          |

El bloqueo del lote usa `product_batches.is_active`, que ya existía: deshabilitar un lote es la forma
de bloquearlo sin borrar su historia.

### 3.2 Backend

- `assertDispatchableBatches()`: valida las tres reglas por línea antes de insertar el movimiento.
- `isExpired()`: comparación por día en horario local.
- `resolveFefoBatch()`: primer lote **activo, no vencido y con existencia disponible** en el almacén,
  ordenado por vencimiento (los lotes sin vencimiento van al final). La existencia descuenta las
  reservas activas.
- `reserveDispatchBatches()`: dentro de la misma transacción del alta, toma un candado por
  `(almacén, producto, lote)`, valida stock − reservas y crea la reserva de cada línea.
- `releaseReservations()`: libera la reserva al aprobar (el stock ya bajó) o al rechazar.
- `blockExpiredBatches()`: marca inactivos los lotes con vencimiento anterior a hoy; es idempotente y
  admite filtrar por producto para reintentos.
- `findBatchesByProduct()` expone `isActive`, `expired`, `reservedQuantity` y `availableQuantity`
  (existencia neta) para que la UI pueda deshabilitarlos y mostrar lo apartado.
- El movimiento devuelve `fefoOverride` y `fefoOverrideReason`.
- `CronService.blockExpiredBatches()` ejecuta el bloqueo todos los días a las 00:05
  (`America/Caracas`, `INVENTORY_EXPIRY_BLOCK_ENABLED`).

### 3.3 Frontend

- El selector FEFO muestra los lotes vencidos y bloqueados **deshabilitados** y rotulados («vencido»,
  «bloqueado»), marca el sugerido y muestra la existencia disponible con lo reservado cuando lo hay.
- Si el usuario elige un lote posterior al sugerido aparece el campo **Motivo para no despachar
  L-XXXX** (obligatorio) y el botón de crear queda bloqueado hasta escribirlo.
- El listado de movimientos muestra el distintivo **Fuera de FEFO** con el motivo en el tooltip.

### 3.4 Semilla y gate

- `seedProductBatches()`: dos lotes nuevos — `L-2025-VENCIDO` (vencido, con 8 unidades) y
  `L-BLOQUEADO` (inactivo, con 4)— además de los dos del fixture.
- `seedInventoryMoves()`: `MOV-000009`, salida en borrador que se salta el FEFO **con** su motivo.
- `seed-integrity.ts`: cuatro reglas nuevas — ninguna salida despacha un lote vencido o bloqueado; todo
  despacho fuera de FEFO registra su motivo; ningún documento cerrado conserva una reserva activa; las
  reservas activas no exceden la existencia física. **Gate: 66 reglas.**

## 4. Verificación

| Caso                                                 | Resultado                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| Lote vencido (`expiration_date` de ayer)             | `400` vencido                                                     |
| Lote que vence hoy                                   | `201`, documento en borrador                                      |
| Lote bloqueado                                       | `400` bloqueado                                                   |
| Línea sin lote en producto con lotes                 | `400` hay que indicar el lote                                     |
| Lote por número inexistente                          | `400` no existe para el producto                                  |
| Salto de FEFO sin autorización                       | `400` nombra el lote que vence antes                              |
| Salto de FEFO con motivo vacío                       | `400` exige motivo                                                |
| Salto de FEFO con motivo                             | `201`, `fefoOverride = true` y motivo guardado                    |
| Lote sugerido                                        | `201`, `fefoOverride = false`                                     |
| Sugerencia con un vencido y un bloqueado por delante | propone el lote válido                                            |
| Aprobación de la salida                              | descuenta solo el lote elegido                                    |
| Dos salidas simultáneas sobre el mismo lote          | la segunda `400` «disponible N, solicitado M»                     |
| Rechazo de la primera salida                         | libera la reserva y la segunda ya puede crearse                   |
| Al aprobar, la reserva                               | `RELEASED`; el stock baja y la cantidad vuelve a estar disponible |
| Lote reservado por completo                          | el FEFO sugiere el siguiente lote utilizable, sin excepción       |
| Job de vencimiento                                   | bloquea los vencidos; el que vence hoy y el futuro siguen activos |

**Prueba de extremo a extremo (API, datos sembrados):**

| Paso                                                       | Resultado                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /inventory/products/{HOG-003}/batches?warehouseId=…`  | 4 lotes: `L-2025-VENCIDO` (`expired = true`), `L-2026-A`, `L-2026-B`, `L-BLOQUEADO` (`isActive = false`) |
| `POST /inventory/moves` (SALIDA lote vencido)              | `400` «está vencido (2025-12-31)»                                                                        |
| `POST /inventory/moves` (SALIDA lote bloqueado)            | `400` «está bloqueado»                                                                                   |
| `POST /inventory/moves` (SALIDA `L-2026-B`, sin excepción) | `400` «El lote L-2026-A vence antes y tiene existencia»                                                  |
| `POST` con `fefoOverride` y motivo vacío                   | `400` «hay que indicar el motivo»                                                                        |
| `POST` con `fefoOverride` y motivo                         | `201` `INV-2026-00001` (`fefoOverride = true`)                                                           |
| `POST` con `L-2026-A`                                      | `201` `INV-2026-00002` (`fefoOverride = false`)                                                          |
| `POST` de SALIDA sin lote                                  | `400` «maneja lotes: hay que indicar de qué lote sale»                                                   |
| `db:verify` tras `db:reset` + migración + semilla          | **66/66** reglas                                                                                         |

**Suites:** backend **1195** pruebas (9 nuevas de despacho por lote + 9 de reserva y bloqueo),
database **55**, frontend **416**; `typecheck`/`lint`/`build` 12/12.

## 5. Consecuencias

- No sale mercancía vencida ni de un lote bloqueado; el FEFO deja de ser una sugerencia decorativa y
  pasa a ser una regla con excepción auditada.
- El vencimiento se controla al capturar, no al aprobar: el almacenista corrige en el momento.
- Dos salidas simultáneas no prometen el mismo lote: la reserva se crea y se libera con el documento.
- El lote vencido se bloquea solo cada día; no depende de que alguien recuerde marcarlo.
- **Decisión, no deuda:** el costo promedio vive en el maestro de material (área de valoración =
  empresa, una sola sociedad). No se calcula por sucursal porque SAP tampoco permite que el mismo
  material valga distinto por bodega.
