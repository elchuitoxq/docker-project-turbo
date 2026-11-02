# S-25 — Controles de inventario: lotes, costo promedio y aprobación en lote

| Campo      | Valor                                                |
| ---------- | ---------------------------------------------------- |
| Estado     | Implementado                                         |
| Prioridad  | P1                                                   |
| Alcance    | `apps/backend`, `apps/frontend`, `packages/database` |
| Depende de | S-14 (RBAC), S-23 (alta de movimientos)              |
| Fecha      | 2026-11-01                                           |

## 1. Contexto

La deuda que quedó abierta tras `S-23` tenía tres frentes y un conflicto de criterio:

1. **Segregación de funciones.** El almacén podía crear **y** aprobar sus propios ajustes. La solución
   obvia era quitarle `inventory:moves:approve`, pero el usuario dueño del proceso lo rechazó: es el
   **maestro** de ese rol y sin la aprobación no puede cerrar su trabajo. Se aplicó entonces el criterio
   de SAP: **el permiso se conserva** y el control se ejerce con el proceso — motivo obligatorio y
   tolerancia de conteo con escalamiento.
2. **Lotes.** El esquema tenía `product_batches` desde `S-00`, pero nada los creaba ni los consultaba:
   un producto con `has_batches` no podía recibir ni despachar correctamente.
3. **Costo.** `add_stock` recibía el costo unitario de la entrada y **lo descartaba**; el inventario se
   valoraba con el costo del maestro, que nunca cambiaba.

## 2. Decisión de diseño (criterio ERP/SAP)

| Tema                   | Decisión                                                                                           | Motivo                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Permiso de aprobación  | El WAREHOUSE **lo conserva**                                                                       | Es maestro de su almacén; revocarlo rompe la operación diaria (36 movimientos/día en temporada).              |
| Control compensatorio  | `reason_code` obligatorio en `AJUSTE` + segunda aprobación si la diferencia supera la tolerancia   | Es la segregación real: el que cuenta no autoriza el faltante grande, pero sí puede cerrar el conteo normal.  |
| Tolerancia             | `SEGREGATION_TOLERANCE_PERCENT` (10 % por defecto); stock en cero se compara contra base 1         | Un 10 % sobre una existencia chica no es material; dar de alta inventario inexistente siempre escala.         |
| Área de valoración     | La empresa (una sola sociedad), no el almacén                                                      | Es como SAP valúa con una única sociedad: el mismo material no puede valer distinto en cada bodega.           |
| Dónde vive el promedio | `products.cost` (maestro de material)                                                              | Es el costo con el que se valoriza el inventario y se costea la salida; `stock` no lleva costo por fila.      |
| Creación de lotes      | En la **recepción**, a partir del número de lote; alta manual sólo con `inventory:products:create` | Es el momento en que el lote nace físicamente; el operario no tiene por qué ir a un maestro antes de recibir. |
| Salida con lotes       | El selector propone **FEFO** (vence primero) y muestra la existencia del almacén                   | Despachar lo que vence antes es la práctica estándar y evita mermas por vencimiento.                          |
| Aprobación masiva      | Secuencial, con resultado por documento (`{ approved[], failed[] }`)                               | Un documento inválido no puede revertir los ya aprobados (misma semántica que la aprobación masiva de SAP).   |

> **Nota sobre D-09 (S-14):** la recomendación de retirar `inventory:moves:approve` al WAREHOUSE **no se
> aplica**. Queda reemplazada por esta estrategia, decidida explícitamente por el dueño del proceso.

## 3. Implementación

### 3.1 Base de datos — migración `0031_inventory_adjustment_controls.sql`

| Cambio                                     | Para qué                                                            |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `inventory_moves.reason_code`              | Motivo del ajuste, auditable                                        |
| `inventory_moves.requires_second_approval` | Marca el documento que no puede aprobar su creador                  |
| Índice único `(product_id, batch_number)`  | El número de lote es único por producto; la recepción no lo duplica |

### 3.2 Backend

- `ADJUSTMENT_REASONS` (catálogo en código): `CONTEO`, `DAÑO`, `VENCIMIENTO`, `HURTO`,
  `ERROR_DIGITACION`. `createMove` rechaza `AJUSTE` sin motivo o con motivo desconocido.
- `adjustmentExceedsTolerance()`: compara la cantidad contada contra el stock real **antes** de tocar
  nada y marca `requires_second_approval`.
- `approveMove()`: si el documento está escalado y quien aprueba es el creador → **403** con mensaje
  explicativo. Un gerente o administrador sí puede (tienen `inventory:moves:approve`).
- `approveMovesBatch(ids, userId)`: proceso secuencial que devuelve `{ approved, failed }`.
  `POST /v1/inventory/moves/approve-batch`.
- `resolveBatchId()`: traduce el lote que llega en la línea; lo **crea** si viene por número y el
  movimiento ingresa mercancía (entrada, traslado o ajuste); una salida con lote inexistente es `400`.
- `findBatchesByProduct(productId, warehouseId)`: lotes ordenados por FEFO con la existencia del
  almacén. `GET /v1/inventory/products/:id/batches`.
- `createBatch()`: alta manual, `409` si el número ya existe. `POST /v1/inventory/products/:id/batches`.
- `applyMovingAverage()`: recalculado en cada entrada —
  `(qty_antes × costo_actual + qty_entra × costo_entrada) / (qty_antes + qty_entra)`. Las salidas
  consumen el promedio vigente y no lo modifican.
- `insertMoveWithGeneratedCode()`: reintenta el consecutivo si dos altas simultáneas chocan con el
  índice único (antes devolvía 500).

`StockResponseDto` expone `averageCost`, `totalValue` y `hasBatches`.

### 3.3 Frontend

- `api/batches.ts` + `hooks/use-batches.ts`: consulta de lotes por producto y almacén.
- `move-form-dialog.tsx`: selector de **motivo** (obligatorio en ajuste) y, para productos con lotes,
  selector FEFO en salida/ajuste (con existencia y sugerencia del primer lote disponible) o número de
  lote + vencimiento en la recepción.
- `moves-view.tsx`: casillas de selección sobre los borradores, «seleccionar todo», barra de acción y
  aprobación en lote con resumen (`aprobados` / `fallidos`); el motivo del ajuste y la marca
  «Requiere 2ª aprobación» se ven en el listado.
- `stock-view.tsx`: columnas **Costo prom.** y **Valor** por línea de existencia.

### 3.4 Semilla y gate

- `seedProductBatches()`: producto `HOG-003` con `has_batches` y dos lotes (`L-2026-A` vence 2026-12-31,
  `L-2026-B` vence 2027-06-30); su existencia se reparte entre los lotes.
- `seedInventoryMoves()`: motivo en el ajuste aprobado, un `AJUSTE` en borrador **fuera de tolerancia**
  (para ver el aviso y el 403), y una entrada con lote.
- `seed-integrity.ts`: tres reglas nuevas — todo ajuste registra motivo; ningún ajuste escalado fue
  aprobado por su creador; los productos con lotes tienen lotes y su stock está identificado por lote.
  **Gate: 62 reglas.**

## 4. Verificación

| Caso                                               | Resultado esperado                                                  | Obtenido |
| -------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| Ajuste sin `reasonCode`                            | `400` «Un ajuste necesita motivo»                                   | ✅       |
| Ajuste con motivo inexistente                      | `400` «Motivo de ajuste inválido»                                   | ✅       |
| Ajuste 100 → 105 (5 %)                             | `requiresSecondApproval = false`, lo aprueba el creador             | ✅       |
| Ajuste 100 → 50 (50 %)                             | `requiresSecondApproval = true`; creador `403`; gerente `200`       | ✅       |
| Ajuste desde stock 0                               | siempre escalado                                                    | ✅       |
| Entrada con `batchNumber` nuevo                    | lote creado y stock en ese lote                                     | ✅       |
| Salida con lote inexistente                        | `400` «no existe para el producto»                                  | ✅       |
| Dos entradas con el mismo `batchNumber`            | un solo lote                                                        | ✅       |
| Orden FEFO + existencia por almacén                | `L-VENCE-PRONTO` antes que `L-SIN-VENCER`, cada uno con su cantidad | ✅       |
| 10 @ 100 y luego 10 @ 200                          | `products.cost = 150`; la salida no lo cambia                       | ✅       |
| Entrada sin costo                                  | promedio vigente intacto                                            | ✅       |
| `approve-batch` con un documento inválido          | los válidos se aprueban, el inválido vuelve en `failed`             | ✅       |
| `approve-batch` con ajuste escalado por su creador | `failed`; el gerente sí lo aprueba                                  | ✅       |

**Prueba de extremo a extremo (API, datos sembrados):**

| Paso                                                         | Resultado                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `GET /inventory/products/{HOG-003}/batches?warehouseId=…`    | `L-2026-A` (20) y `L-2026-B` (15), ordenados por vencimiento                           |
| `GET /inventory/stock/{Depósito Sur}`                        | dos líneas, `averageCost = 15.00`, `totalValue = 300.00 / 225.00`, `hasBatches = true` |
| `POST /inventory/moves` (AJUSTE, 500 → 50) por WAREHOUSE     | `INV-2026-00001`, `requiresSecondApproval = true`, motivo `CONTEO`                     |
| `POST …/approve` por el mismo WAREHOUSE                      | `403` «no puede aprobarlo quien lo registró»                                           |
| `POST …/approve` por MANAGER                                 | `200`, estado `APPROVED`, stock 50                                                     |
| `POST /inventory/moves/approve-batch` con los dos borradores | `aprobados = 2`, `fallidos = 0`                                                        |
| `POST /inventory/moves` (ENTRADA 10 @ 30, lote `L-2026-C`)   | `products.cost` 15 → **18,33** = (35×15 + 10×30) / 45                                  |
| `GET …/batches` tras la recepción                            | `L-2026-C` primero (vence 2026-09-30 → FEFO)                                           |

**Suites:** backend **1177** pruebas, database **55**, frontend **408**; `typecheck`/`lint`/`build`
12/12 y 4/4; `db:verify` **62/62** tras `db:reset` + migración + semilla.

## 5. Consecuencias

- El ajuste deja de ser una corrección anónima: sin motivo no se registra y el faltante material necesita
  dos firmas.
- La valoración del inventario sigue al mercado: el costo del maestro es el promedio móvil, no un dato
  congelado.
- Los productos con lotes ya pueden recibirse y despacharse; el listado de stock muestra valor.
- **Deuda cerrada (2026-11-02):** el bloqueo de lote vencido, la regla de rotación, la **reserva de
  lote** y el **bloqueo automático al vencer** se implementaron en
  [`S-26`](./S-26-despacho-por-lote.md) (vencido y bloqueado se rechazan, la excepción FEFO exige motivo,
  dos salidas no prometen la misma existencia y un job diario bloquea los vencidos).
- **Decisión, no pendiente:** el promedio vive en el maestro de material (área de valoración = empresa,
  una sola sociedad). No aplica por sucursal: SAP tampoco permite que el mismo material valga distinto
  por bodega.
