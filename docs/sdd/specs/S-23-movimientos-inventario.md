# S-23 — Alta de movimientos de inventario

| Campo      | Valor                                                              |
| ---------- | ------------------------------------------------------------------ |
| Estado     | Implementado                                                       |
| Prioridad  | P0                                                                 |
| Alcance    | `apps/frontend` (inventario), `apps/backend` (inventario), semilla |
| Depende de | S-07, S-11, S-16                                                   |
| Fecha      | 2026-10-31                                                         |

## 1. Contexto

La pantalla de **Inventario → Movimientos** sólo listaba, aprobaba y rechazaba. El backend tenía
`POST /v1/inventory/moves` desde el principio, pero **no existía ningún formulario para crear un
movimiento**: entradas, salidas, transferencias y ajustes sólo podían nacer por API o por la semilla.

Al revisar la ruta aparecieron cuatro defectos juntos:

| #   | Defecto                                                                                                                                  | Por qué importaba                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Ningún formulario de alta                                                                                                                | El módulo no se podía operar desde la aplicación                        |
| 2   | `movesApi.create` enviaba `type: 'IN'` y `warehouseId`, vocabulario que el API no acepta (`ENTRADA` + `toWarehouseId`/`fromWarehouseId`) | Aunque hubiera formulario, habría respondido `400 type must be one of…` |
| 3   | La UI ofrecía el tipo **Ajuste** pero el backend no lo soportaba (el `enum` del DTO sólo tenía entrada, salida y transferencia)          | Tarjeta y filtro de un tipo que nunca podría existir                    |
| 4   | El menú **Cancelar** llamaba `POST /moves/:id/reject` con cuerpo vacío, y la ruta exige `reason`                                         | Cancelar un borrador fallaba con `400 reason must be a string`          |

## 2. Qué se implementó

### 2.1 Formulario de alta (`MoveFormDialog`)

- Tipo: **Entrada**, **Salida**, **Transferencia** o **Ajuste**, con una línea de ayuda que explica
  qué hace cada uno.
- Almacenes según el tipo: destino en la entrada; origen en salida y ajuste; ambos en la transferencia
  (el destino no ofrece el almacén de origen ya elegido).
- Líneas de producto con `ProductCombobox`, cantidad y costo unitario opcional; se pueden agregar y
  quitar, y se bloquea el producto repetido.
- Nota libre.
- El movimiento nace en **borrador**: el stock sólo se mueve al aprobarlo, así la captura y la
  autorización quedan separadas (`inventory:moves:create` y `inventory:moves:approve`).

### 2.2 Ajuste por conteo físico

`AJUSTE` se agregó al DTO y al `approveMove`. La semántica es la de un inventario físico real: **la
cantidad de la línea es la contada** y el servicio deja el stock en ese número.

```
delta = cantidad_contada − stock_actual
delta > 0 → addStock(almacén, producto, delta)
delta < 0 → subtractStock(almacén, producto, |delta|)
```

Ventaja frente a pedirle al usuario una cantidad firmada: no hay que calcular la diferencia a mano ni
equivocarse de signo, y el comprobante queda con el número que el operario contó. Se agregó
`currentStock(almacén, producto, lote)` al servicio, reutilizable para mostrar el stock contra el que
se está ajustando.

### 2.3 Contrato del cliente corregido

`movesApi.create` traduce el vocabulario de la UI al del API y arma los almacenes según el tipo:
`ENTRADA` (destino), `SALIDA` y `AJUSTE` (origen), `TRANSFERENCIA` (ambos). `cancel` ahora envía un
motivo.

### 2.4 Semilla

Antes sólo había dos entradas, así que las tarjetas de salida, transferencia y ajuste salían en **0**.
Ahora la semilla trae los cuatro tipos aprobados más un **borrador** para poder aprobar/rechazar desde
la interfaz sin crear datos.

## 3. Criterios de aceptación

1. Se puede crear una entrada, una salida, una transferencia y un ajuste desde la pantalla.
2. El movimiento nace `EN_TRAMITE` y el stock no cambia hasta aprobarlo.
3. Un ajuste deja el stock en la cantidad contada, suba o baje, y no lo altera si coincide.
4. Transferencia con origen = destino se rechaza antes de enviar.
5. Cancelar un borrador funciona (envía motivo).
6. Un ajuste sin almacén y un movimiento sin líneas se rechazan con mensaje claro.

## 4. Verificación ejecutada (2026-10-31)

Efecto de cada tipo sobre el stock, por API (producto `ELEC-001`, almacenes Caracas y Maracaibo):

| Movimiento                | Stock antes | Stock después |
| ------------------------- | ----------- | ------------- |
| `ENTRADA` de 5            | 30          | **35**        |
| `SALIDA` de 2             | 35          | **33**        |
| `TRANSFERENCIA` de 1      | 33 / 0      | **32 / 1**    |
| `AJUSTE` contado 20       | 32          | **20**        |
| `AJUSTE` contado 0 (baja) | 1           | **0**         |

| Rechazos                          | Resultado                                                     |
| --------------------------------- | ------------------------------------------------------------- |
| `AJUSTE` sin almacén              | `400 · fromWarehouseId is required for AJUSTE moves`          |
| Movimiento sin líneas             | `400 · Un movimiento necesita al menos una línea de producto` |
| Vocabulario viejo de la UI (`IN`) | `400` (documenta que el mapeo del cliente era imprescindible) |

| UI (navegador)                          | Resultado                                                    |
| --------------------------------------- | ------------------------------------------------------------ |
| Tarjetas del listado                    | Entrada 2 · Salida 2 · Transferencia 1 · Ajuste 1            |
| Alta de una entrada desde el formulario | toast "Movimiento creado en borrador…" y el listado pasa a 7 |
| Tipo **Ajuste** en el formulario        | etiquetas "Almacén a ajustar" y "Contado"                    |

**Defecto encontrado durante la prueba visual:** con el formulario abierto, el botón **Crear
movimiento** quedaba fuera del viewport y no se podía pulsar. Se le puso `max-h-[90vh] overflow-y-auto`
al `DialogContent`.

| Comando                                    | Resultado                                     |
| ------------------------------------------ | --------------------------------------------- |
| `pnpm --filter backend test`               | **1162** pruebas OK (7 nuevas de movimientos) |
| `pnpm --filter database test` / `frontend` | 55 · 387 pruebas OK                           |
| `pnpm turbo run typecheck lint` / `build`  | 0 errores · 4/4                               |
| `db:verify`                                | 59/59 reglas                                  |

## 5. Deuda que queda

- **Aprobación en lote**: el listado aprueba de a uno; falta selección múltiple.
- **Lotes y series**: el formulario no elige lote (`batchId`); el servicio lo acepta y el ajuste lo
  respeta, pero no hay selector.
- **Ajuste con costo**: al subir stock sin costo el valor del inventario no se recalcula; el costo
  promedio sigue sin implementarse.
- **Trazabilidad contable**: el movimiento de inventario no genera asiento (misma deuda de `S-19` con
  costo de ventas).
- **Rechazo con motivo desde la UI**: el cliente ya envía un motivo por defecto, pero no se pide al
  usuario.
