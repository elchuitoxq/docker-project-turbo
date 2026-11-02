# S-15 — Sincronización automática de la tasa oficial del dólar (BCV)

**Épica:** E15 · Tasa oficial automática
**Prioridad:** 🔴 P0 (sin tasa fresca no se puede facturar en otra moneda)
**Estado:** implementado (2026-10-31)
**Origen:** revisión del 2026-10-31 — "haz un cron en el back para que pueda leer el cambio del dólar
en bolívares desde la página de tipo de cambio oficial del BCV".

---

## 1. Problema

El plan de `S-08` prometía "obtención automática diaria (BCV)" y el código tenía tres problemas que
la hacían imposible:

| #   | Problema                                                                                                                           | Consecuencia                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | El parser buscaba "el primer número que aparezca" después de `id="dolar"`                                                          | Con el HTML actual devolvía **`6`** (el `6` de `class="col-sm-6"`), no la tasa |
| 2   | Se leía `https://www.bcv.org.ve` (portada) en vez de la página de tipo de cambio oficial                                           | La portada cambia de maquetación sin aviso                                     |
| 3   | `www.bcv.org.ve` no envía el certificado intermedio de su cadena TLS                                                               | `fetch` falla con `UNABLE_TO_VERIFY_LEAF_SIGNATURE` **desde el contenedor**    |
| 4   | La guarda de variación (20%) también se aplicaba al override manual, aunque su mensaje pide "confírmalo manualmente con un motivo" | En un entorno con tasa vieja **nadie** podía adoptar la tasa real              |
| 5   | El cron corría una sola vez al día (08:00) y no se podía desactivar ni observar                                                    | Si BCV publica por la tarde, la tasa del día se aplicaba al día siguiente      |

## 2. Solución

### 2.1 Lectura de la página

- URL por configuración: `BCV_API_URL` (por defecto
  `https://www.bcv.org.ve/seccionportal/tipo-de-cambio-oficial-del-bcv`).
- El parser **acota el bloque de la moneda** (`id="dolar"` … hasta el bloque de `euro|yuan|lira|rublo`)
  y dentro busca el valor en `<strong class="strong-tb">889,57540000</strong>`; si no está, acepta el
  primer número **con decimales** del bloque. Nunca toma enteros sueltos del CSS.
- Se aceptan ambos formatos: `889,57540000` (es-VE) y `889.5754`.

### 2.2 Cadena TLS incompleta (sin desactivar la verificación)

El sitio sirve el certificado hoja firmado por `Sectigo Public Server Authentication CA DV R36` pero
**no envía ese intermedio**; en su lugar manda un certificado de otra CA. Browsers lo resuelven
descargándolo por AIA; Node no lo hace.

La solución **no** baja la verificación: si el primer `fetch` falla con un error de cadena,

1. se abre un socket TLS **sólo para leer el certificado** presentado,
2. se lee su AIA (`CA Issuers - URI:http://crt.sectigo.com/…`),
3. se descarga ese intermedio (se cachea por URL en memoria),
4. se reintenta el `GET` **con verificación**, confiando en el bundle de raíces de Node **más** el
   intermedio descargado.

Si el intermedio no se puede obtener, el trabajo falla con un mensaje explícito y **no** se relaja TLS.

### 2.3 Guarda de cordura con antigüedad

- Se compara la tasa nueva contra la última registrada **sólo si esa última tasa es más reciente que
  `EXCHANGE_RATE_MAX_AGE_HOURS`**. Con una tasa de hace 4 días o 5 meses, una devaluación grande es
  legítima y no un error de lectura.
- Un **override manual con motivo** no pasa por la guarda: es exactamente la salida que el mensaje de
  error propone, y queda auditado (`createdBy` + `reason`).

### 2.4 Idempotencia

`syncFromBcv()` devuelve un estado y no ensucia la base:

| Estado            | Cuándo                                                          | Qué hace                                |
| ----------------- | --------------------------------------------------------------- | --------------------------------------- |
| `stored`          | No hay tasa del día o el valor cambió                           | Guarda con `source=BCV`                 |
| `unchanged`       | La tasa del día ya tiene ese mismo valor                        | No escribe nada                         |
| `manual-override` | El día tiene una tasa `MANUAL` **con motivo** (decisión humana) | No la sobrescribe y **no consulta** BCV |

### 2.5 Cron

`CronService` corre **09:00 y 17:00 de `America/Caracas`, de lunes a viernes** (`0 9,17 * * 1-5`):
la corrida de la mañana aplica la publicación de la tarde anterior y la de la tarde recoge la del
mismo día. Se puede desactivar con `EXCHANGE_RATE_SYNC_ENABLED=false`; al arrancar deja una línea de
log con la programación y cada corrida registra `estado · valor · fuente`. Los errores se registran y
**no** tumban el proceso: la tasa anterior sigue vigente y la UI avisa por antigüedad.

## 3. Contrato HTTP

| Endpoint                               | Cambio                                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /v1/settings/currencies/refresh` | Ahora responde `{ status, rate, date, source }` (antes `{ rate, date, source, ageHours, isStale }`) |

Verificado contra la página real (2026-10-31):

```text
POST /v1/settings/currencies/refresh → 201 {"status":"stored","rate":889.5754,"date":"2026-10-31T00:00:00.000Z","source":"BCV"}
POST /v1/settings/currencies/refresh → 201 {"status":"unchanged","rate":889.5754,...}
POST /v1/settings/currencies/refresh → 201 {"status":"manual-override","rate":889.5754,"source":"MANUAL"}
```

## 4. Configuración

| Variable                          | Defecto                                                               | Uso                                                         |
| --------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| `BCV_API_URL`                     | `https://www.bcv.org.ve/seccionportal/tipo-de-cambio-oficial-del-bcv` | Página a leer                                               |
| `EXCHANGE_RATE_SYNC_ENABLED`      | `true`                                                                | Apaga el cron (tests, entornos sin salida a internet)       |
| `EXCHANGE_RATE_MAX_AGE_HOURS`     | `24`                                                                  | Antigüedad que marca la tasa como vencida y corta la guarda |
| `EXCHANGE_RATE_MAX_VARIATION_PCT` | `20`                                                                  | Variación máxima aceptada en una sincronización automática  |

Todas viajan al contenedor por `docker-compose.yml` (`*app-env`).

## 5. UI

`Monedas y tasas` distingue los tres resultados al sincronizar: "Tasa BCV sincronizada: 889,5754",
"La tasa BCV del día ya estaba registrada" o "El día tiene una tasa manual; no se sobrescribe con la
de BCV". La tabla muestra la fila del día con fuente `BCV` y fecha de hoy.

## 6. Criterios de aceptación

```gherkin
Escenario: el cron trae la tasa del día
  Dado que BCV publica 889,5754 y no hay tasa registrada hoy
  Cuando corre la sincronización
  Entonces se guarda una fila con source = BCV, rate = 889,5754 y la fecha de hoy
  Y el log registra "Sincronización BCV: stored · 889.5754 (BCV)"

Escenario: correr dos veces no duplica
  Dado que hoy ya existe la tasa BCV 889,5754
  Cuando la sincronización vuelve a correr
  Entonces responde unchanged y no se escribe ninguna fila

Escenario: el override manual del día manda
  Dado un override manual con motivo para hoy
  Cuando corre la sincronización
  Entonces responde manual-override y no se consulta BCV

Escenario: BCV no envía el intermedio de su certificado
  Dado que la cadena TLS llega incompleta
  Cuando el servicio intenta leer la página
  Entonces descarga el intermedio por AIA y reintenta con verificación
  Y nunca desactiva la validación del certificado

Escenario: tasa anterior muy vieja
  Dado una última tasa de hace 96 horas
  Cuando la tasa nueva se desvía 2300%
  Entonces se guarda (no hay comparación razonable) y queda el aviso en el log
```

## 7. Tareas

| ID      | Tarea                                                                        | Estado |
| ------- | ---------------------------------------------------------------------------- | ------ |
| T-15-01 | Parser acotado al bloque `id="dolar"` (no al primer número de la página)     | ✅     |
| T-15-02 | URL configurable a la página de tipo de cambio oficial                       | ✅     |
| T-15-03 | Completar la cadena TLS por AIA sin desactivar la verificación               | ✅     |
| T-15-04 | `syncFromBcv` idempotente (`stored` / `unchanged` / `manual-override`)       | ✅     |
| T-15-05 | Guarda de variación con antigüedad y override manual con motivo              | ✅     |
| T-15-06 | Cron 09:00 y 17:00 L-V, interruptor y logs de arranque y resultado           | ✅     |
| T-15-07 | Respuesta de `refresh` con estado + mensajes en la UI                        | ✅     |
| T-15-08 | Pruebas: 9 del parser y la sincronización, 3 del cron, 2 de los helpers TLS  | ✅     |
| T-15-09 | Variables en `.env.example` y `docker-compose.yml`                           | ✅     |
| T-15-10 | La moneda funcional no admite tasa (`store` responde `400`)                  | ✅     |
| T-15-11 | `rates/latest` y `/health/rates` informan la moneda de referencia (USD)      | ✅     |
| T-15-12 | Migración `0024` que borra tasas de la moneda funcional en cualquier entorno | ✅     |
| T-15-13 | CxP paga con la tasa de la moneda de la factura, no con la funcional         | ✅     |
| T-15-14 | El pedido toma la tasa vigente cuando no se le envía una                     | ✅     |
| T-15-15 | Semillas: VES es funcional y la tasa `36,50` pertenece al USD                | ✅     |

## 8. Verificación

- `exchange-rate.service.test.ts` (24 casos) y `cron.service.test.ts` (3): parser con el HTML real,
  cadena incompleta, estados de sincronización y guarda por antigüedad.
- Prueba en vivo desde el contenedor: la página devuelve `889,57540000` y el histórico queda con
  `2026-10-31 · 889,5754 · BCV`.
- Evidencia: [2026-10-31-tasa-bcv-cron.png](../../qa/evidencias/manager/2026-10-31-tasa-bcv-cron.png).

---

## 9. Qué era el `Bs.S 36,50` (segunda pasada, 2026-10-31)

Pregunta del usuario: _«entiendo el USD a 889,58, pero no entiendo la tasa del Bs.S y si está acoplada
a pedidos, compras, ventas y facturación»_.

### 9.1 Respuesta

La fila `VES 36,50` **no era una tasa**: las semillas la creaban porque `seed-test.ts` declaraba al
**dólar** como moneda funcional y guardaba `36,50` en la fila de VES (el tipo de cambio de aquel
momento). Con la regla del producto (D-01: **la moneda funcional es VES**) esa fila sobra: la moneda
funcional **vale 1 contra sí misma** y el backend nunca la usa para convertir —
`BillingService.getExchangeRate()` devuelve `1` sin consultar la tabla.

Lo que sí estaba mal era el **acople** en tres puntos y una consecuencia visible:

| ID   | Defecto                                                                                                                                                 | Corrección                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| M-8  | `/health/rates` (badge del sidebar) informaba la tasa de la **moneda funcional** → "MANUAL · vencida · Bs 36.50", cuando el número útil es el del dólar | Informa `referenceCurrency` (USD) + su fuente y antigüedad          |
| M-9  | En CxP, "Registrar pago" tomaba la tasa de la **fila de VES** para pagar una factura en divisa (`exchangeRate = 36,50`)                                 | Usa la tasa de la **moneda de la factura**; el gate de tasa también |
| M-10 | Un pedido sin `exchangeRate` se guardaba con `1` aunque fuera en dólares                                                                                | El servicio resuelve la tasa vigente de la moneda del pedido        |
| M-11 | `rates/latest` y la pantalla de Monedas mostraban la fila de VES como "tasa vigente" e historial                                                        | Se excluye la moneda funcional; la tarjeta e historial son del USD  |

Y el origen, para que no vuelva:

| ID   | Defecto                                                                                   | Corrección                                                                   |
| ---- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| M-12 | `seed-test.ts` declaraba USD como funcional y sembraba `36,50` en VES; `seed-faker` igual | VES funcional y la tasa `36,50` en USD                                       |
| M-13 | Cualquier entorno con la fila vieja la seguiría mostrando                                 | Migración `0024_purge_base_currency_rates.sql` (borra tasas de la funcional) |

### 9.2 Cómo queda el acople

| Documento                        | Tasa que guarda                                                      | Verificado                           |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| Pedido en VES                    | `1`                                                                  | `ORD-QA-TASA-1 · tasa 1 · total 200` |
| Pedido en USD sin tasa explícita | la vigente del dólar                                                 | `tasa 889.5754`                      |
| Factura de venta USD             | `889.5754` (total `119,48` = 100 + IVA + IGTF; base imponible `100`) | `A-90021`                            |
| Factura de compra USD (CxP)      | `889.5754`                                                           | `A-90022`                            |
| Pago de CxP de factura USD       | tasa del dólar en el diálogo: `USD 1.040,00 · Bs.S 925.158,42`       | captura                              |
| Cualquier documento en VES       | `1`, sin importar la inflación                                       | `formatDual` no duplica              |

> Los documentos **sembrados** conservan su tasa congelada (`1`): son datos históricos del fixture. Los
> documentos nuevos nacen con la tasa correcta.

Evidencias: [2026-10-31-tasa-bcv-cron.png](../../qa/evidencias/manager/2026-10-31-tasa-bcv-cron.png) y
[2026-10-31-cxp-tasa-documento.png](../../qa/evidencias/manager/2026-10-31-cxp-tasa-documento.png).
