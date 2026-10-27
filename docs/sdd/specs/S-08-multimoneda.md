# S-08 — Multimoneda con el dólar como referencia

> **Prioridad:** 🔴 P0 transversal · **Depende de:** `S-00` (sucursal) · **Bloquea a:** `S-04` (contabilidad),
> `S-06` (fiscal), `S-05` (tesorería) y todos los reportes.
> **Origen:** requisito del negocio (2026-10-26): _el sistema debe operar en multimoneda tomando el
> precio del dólar como base_.

## 1. Problema

El repo ya tiene la intención de multimoneda, pero **no la garantía**. Lo que existe y lo que falta:

| Pieza                                           | Estado real                                                                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `currencies` (`code`, `symbol`, `isBase`)       | Existe, pero **nada impide dos monedas base** o ninguna                                                                     |
| `exchange_rates` (`currencyId`, `rate`, `date`) | Existe, sin índice único por día ni fuente declarada                                                                        |
| `invoices`                                      | Bien: `currencyId` + `exchangeRate` + `totalBase` + `totalTax` + `totalIgtf` + `total`                                      |
| `payments`                                      | `amount` + `currencyId` + `exchangeRate`… **sin `amountBase`**: no se puede sumar la tesorería sin recalcular fila por fila |
| `tax_retentions`                                | `totalBase`/`totalTax`/`totalRetained` **sin moneda**                                                                       |
| `accounting_entries` / `_lines`                 | `debit`/`credit` en `numeric(20,2)` **sin moneda ni tasa** → el libro no declara en qué moneda está                         |
| Obtención de la tasa                            | `cron.service.ts` hace **scraping HTML** de `bcv.org.ve`; **no hay `@Cron` ni `ScheduleModule`**: nunca corre sola          |
| Disparo manual                                  | `GET /v1/cron/trigger-bcv` — un `GET` que escribe en la BD                                                                  |
| Fallback de tasa                                | `FALLBACK_API_URL` apunta a un dominio **corrupto** (mojibake) de un servicio ajeno                                         |
| Frescura de la tasa                             | `billing.service.ts` `getExchangeRate()` toma la última fila **sin validar antigüedad**                                     |
| IGTF                                            | Se infiere con `exchangeRate > 1` en vez de comparar contra la moneda base                                                  |

**Consecuencia:** hoy se puede facturar en USD y en VES, pero los **reportes y el libro contable no
distinguen**, y la tasa puede quedar congelada semanas sin que nadie lo note.

## 2. Alcance

1. **Una sola moneda funcional** declarada (`currencies.isBase`) y protegida por restricción de BD.
2. **Todo documento con monto guarda tres cosas**: moneda, tasa aplicada y monto en moneda funcional.
3. **Tasa del dólar como referencia**: obtención automática diaria (BCV), con override manual auditado.
4. **Conversión centralizada** en un único servicio; prohibido multiplicar montos a mano.
5. **Libro contable en moneda funcional** con el monto original preservado.
6. **Reportes** siempre agregados en moneda funcional (VES) **con columna paralela obligatoria en USD**
   a la tasa de corte.
7. **UI** con formato por moneda, monto dual y aviso cuando la tasa está vencida.

> **D-01 resuelta (2026-10-26):** moneda funcional = **VES**; el reporte dual **VES + USD** es
> obligatorio, no opcional. Política de tasa = **BCV automática con override manual auditado**.

**No incluye:** revaluación de saldos por variación cambiaria (queda como job posterior), cuentas
bancarias en cripto, ni cobertura de riesgo cambiario.

## 3. Historias de usuario

| ID   | Historia                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------- |
| HU-1 | Como facturador emito en USD o en VES y el sistema guarda la tasa del día y el total en base.       |
| HU-2 | Como tesorero cobro una factura en USD con un pago en VES a otra tasa y el saldo queda correcto.    |
| HU-3 | Como contador veo los asientos en moneda funcional y el monto original de cada documento.           |
| HU-4 | Como gerente veo un reporte sumado en moneda funcional y, si quiero, su equivalente en USD.         |
| HU-5 | Como administrador fijo la tasa a mano un día que BCV no publica, y queda auditado quién y por qué. |

## 4. Modelo de datos

| Tabla                         | Cambio                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `currencies`                  | Índice único parcial `is_base = true`; `decimals` (2 para VES/USD); seed idempotente con VES y USD |
| `exchange_rates`              | Único `(currency_id, date)`; `source` (`BCV`/`MANUAL`), `createdBy`, `isValidated`                 |
| `payments`                    | **`amountBase`** `numeric(20,2) not null` (backfill: `amount * exchange_rate`)                     |
| `tax_retentions`              | **`currencyId`** + **`exchangeRate`** + `totalRetainedBase`                                        |
| `accounting_entries`          | **`baseCurrencyId`** + `exchangeRate` del período de registro                                      |
| `accounting_entry_lines`      | `debit`/`credit` **en moneda funcional**; nuevas `originalAmount`, `originalCurrencyId` (nullable) |
| `invoices`                    | Ya correcto; sólo se agrega `exchangeRateSource` para trazabilidad                                 |
| **Nueva** `exchange_rate_log` | Auditoría de cambios de tasa: quién, cuándo, valor anterior y nuevo                                |

> **Regla de oro:** ningún documento se recalcula con la tasa de hoy. La tasa se **congela** al emitir.

## 5. Contrato HTTP

```
GET    /v1/settings/currencies                 → monedas + cuál es la base (VES)
GET    /v1/settings/currencies/:code/rate      → ?date= (histórico) · última validada
POST   /v1/settings/currencies/:code/rate      → override manual { rate, date, reason } (auditado)
GET    /v1/settings/currencies/:code/rates     → historial paginado
POST   /v1/settings/currencies/refresh         → fuerza sincronización BCV (permiso admin)
GET    /v1/health/rates                        → estado de la tasa (edad, fuente, última sincronización)
```

- **Todo endpoint de reporte** (`/v1/reports/*`, estados financieros, libros fiscales, resumen de
  gestión) devuelve `base` y `usd` en el mismo payload, más `closingRate` y `closingRateDate`.
- El antiguo `GET /v1/cron/trigger-bcv` **se retira**: mutaba estado por `GET` y no tenía permiso propio.
- Permisos: `settings:currencies:view`, `settings:currencies:manage`, `settings:currencies:override`.
- Errores: `409` si se intenta override con fecha ya cerrada contablemente · `422` si la tasa no pasa
  la validación de cordura (≤ 0 o variación diaria mayor al umbral configurado).

## 6. UI/UX

- `global-rate-display` (ya existe) pasa a mostrar **fuente y antigüedad**: "BCV 36,12 · hace 2 h".
  Si la tasa supera el umbral de antigüedad, se muestra en ámbar y los formularios de emisión avisan.
- Todo monto se muestra con su moneda; en documentos se muestra el **dual**: total en la moneda del
  documento y su equivalente en base.
- Input de tasa manual: motivo obligatorio y confirmación explícita ("afecta a los documentos que se
  emitan a partir de ahora, no a los existentes").
- Reportes: **columnas fijas VES y USD**, con la tasa de corte y su fecha visibles en el encabezado.
  No hay selector que permita ocultar la columna USD.

## 7. Reglas de negocio

1. Existe **exactamente una** moneda base; toda agregación contable se hace en ella.
2. La moneda base **no se cambia** una vez emitido el primer documento; cambiarla exige migración
   contable explícita y aprobación (fuera de alcance).
3. El **dólar es la referencia** de tasa: `exchange_rates.rate` se expresa siempre como _unidades de
   moneda base por 1 USD_; para otras monedas, se guarda su tasa directa y se documenta la convención.
4. IGTF se determina por `currencyId != baseCurrencyId`, **nunca** por `rate > 1`.
5. Redondeo: se calcula con precisión completa y se redondea **sólo al persistir**, con la política
   configurada (por defecto `HALF_UP` a 2 decimales en moneda base).
6. Un pago puede estar en moneda distinta a la factura; la diferencia se resuelve contra la tasa del
   pago y se registra la diferencia cambiaria como línea contable (no se pierde en el redondeo).
7. Ninguna tasa se edita retroactivamente si hay documentos que la usaron: el override crea una fila
   nueva con su propio `date`.
8. **Reporte dual obligatorio:** todo estado financiero, libro fiscal y reporte de gestión se emite
   con dos columnas — **VES (funcional)** y **USD (paralela)** — convirtiendo a **una sola tasa de
   corte** por reporte, de modo que ambas columnas cuadren por construcción.
9. La columna USD del reporte es **informativa**: no altera saldos ni genera asientos. La revaluación
   y la contabilización de la diferencia cambiaria de saldos son un proceso aparte (fuera de alcance).
10. Si un período tiene documentos con tasas distintas, el reporte dual lo declara mostrando la tasa
    de corte usada y, cuando aplica, la tasa promedio ponderada.

## 8. Criterios de aceptación (Gherkin)

```gherkin
Escenario: factura en dólares con total en moneda base
  Dado que la moneda base es VES y la tasa del día es 36,50
  Cuando emito una factura de 100,00 USD
  Entonces la factura guarda currencyId=USD, exchangeRate=36,50 y total=3.650,00 en base

Escenario: cobro en bolívares de una factura en dólares
  Dado una factura de 100,00 USD a tasa 36,50 con saldo pendiente
  Cuando registro un pago de 3.650,00 VES a tasa 37,00
  Entonces el saldo de la factura queda en cero
  Y la diferencia cambiaria se registra como línea contable

Escenario: tasa vencida
  Dado que la última tasa BCV tiene 3 días de antigüedad
  Cuando abro el formulario de emisión
  Entonces veo un aviso de tasa desactualizada
  Y no puedo emitir sin confirmar la tasa a usar

Escenario: dos monedas base
  Dado que ya existe una moneda con isBase=true
  Cuando intento marcar otra como base
  Entonces la operación falla por restricción de base de datos

Escenario: reporte consolidado
  Dado facturas en USD y en VES del mismo período
  Cuando genero el reporte de ventas
  Entonces el total se expresa en VES como moneda funcional
  Y veo la columna paralela en USD a la tasa de corte
  Y ambas columnas cuadran entre sí
  Y el detalle conserva la moneda original de cada documento

Escenario: override manual de tasa
  Dado que BCV no publicó tasa hoy
  Cuando un administrador carga la tasa con motivo
  Entonces la tasa queda con source=MANUAL y createdBy del usuario
  Y los documentos emitidos antes conservan su tasa original
```

## 9. Plan de pruebas

| Nivel       | Caso                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| Unitario    | `MoneyService.convert()` con tasas 1, 36,5 y 0 (error); redondeo HALF_UP       |
| Unitario    | IGTF por `currencyId != base`, incluyendo tasa 1,0 con moneda extranjera       |
| Integración | Factura USD → pago VES a otra tasa → saldo 0 y diferencia cambiaria asentada   |
| Integración | Backfill de `payments.amountBase` cuadra con `amount * exchange_rate`          |
| Integración | Restricción de una sola moneda base (intento de segunda base falla)            |
| Integración | Tasa única por `(currency, date)`; override crea fila nueva sin tocar la vieja |
| Integración | Reporte dual: columnas VES y USD cuadran entre sí con una sola tasa de corte   |
| E2E         | Aviso de tasa vencida bloquea la emisión hasta confirmar                       |

## 10. Riesgos y migración

| Riesgo                                                      | Mitigación                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| El scraping de BCV se rompe cuando cambian el HTML          | Job con reintentos + alerta por antigüedad + override manual auditado           |
| Backfill de `amountBase` con documentos de tasa desconocida | Usar la tasa del documento; si falta, la tasa BCV de esa fecha y marcar la fila |
| Elegir mal la moneda funcional encarece todo después        | **Decisión D-01** documentada y aprobada antes de escribir código (T-08-01)     |
| Asientos históricos sin moneda                              | Migración asume moneda base para lo existente y lo deja documentado             |
| Conversión "a mano" en módulos nuevos                       | `MoneyService` único + regla de revisión: multiplicar montos es rechazo de PR   |
