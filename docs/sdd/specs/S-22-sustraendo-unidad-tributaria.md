# S-22 — Sustraendo de ISLR en unidades tributarias

| Campo      | Valor                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| Estado     | Implementado                                                            |
| Prioridad  | P1                                                                      |
| Alcance    | `apps/backend` (compras, ajustes), `packages/database`, `apps/frontend` |
| Depende de | S-03, S-21                                                              |
| Fecha      | 2026-10-31                                                              |

## 1. Contexto

`S-21` dejó la retención de ISLR resuelta por concepto, pero con una limitación heredada: **el
sustraendo se expresaba siempre en bolívares**. La ley venezolana expresa varios sustraendos del ISLR
en **unidades tributarias (UT)**, y el valor de la UT cambia por providencia. Sin ese valor:

- un concepto con sustraendo legal en UT no se podía cargar tal cual (había que convertirlo a mano y
  reescribirlo cada vez que cambiara la UT);
- el sistema no tenía dónde guardar el valor de la UT, así que el cálculo no era reproducible hacia
  atrás;
- el comprobante no permitía distinguir si el sustraendo era un monto fijo o una cantidad de UT.

## 2. Objetivo

1. Guardar el valor de la UT con su vigencia, sin reescribir el pasado.
2. Permitir que un concepto exprese su sustraendo en **Bs** o en **UT**.
3. Convertir el sustraendo en UT con la UT **vigente a la fecha del documento** al retener.
4. Que el comprobante siga siendo explicable: la tasa y la regla ya se guardaban (`S-21`).

## 3. Modelo de datos (`0030_tax_unit`)

| Objeto                         | Cambio                                                              |
| ------------------------------ | ------------------------------------------------------------------- |
| `tax_units` (nueva)            | `value numeric(20,2)`, `effective_from timestamp` (único), `source` |
| `tax_concepts.sustraendo_unit` | `text` con `BS` por defecto; admite `UT`                            |

La vigencia única evita dos valores para el mismo día y deja la traza de dónde salió el número.

## 4. Cálculo

```
sustraendo_bs = concepto.sustraendo_isr          cuando sustraendo_unit = 'BS'
sustraendo_bs = concepto.sustraendo × UT(fecha)  cuando sustraendo_unit = 'UT'

retención = max(0, base × porcentaje/100 − sustraendo_bs)
```

`UT(fecha)` es la última fila de `tax_units` con `effective_from <= fecha`. Si todavía no hay ninguna
UT cargada, **no se inventa un valor**: el sustraendo en UT se toma como 0 y se retiene el porcentaje
completo (mejor retener de más —y que el negocio lo corrija— que retener de menos contra el fisco).

## 5. Cambios por capa

| Capa      | Cambio                                                                                |
| --------- | ------------------------------------------------------------------------------------- |
| Migración | `0030_tax_unit.sql`: tabla `tax_units` + `tax_concepts.sustraendo_unit`               |
| Esquema   | `taxUnits` y `sustraendoUnit` en `schema.ts`                                          |
| Servicio  | `resolveUnitValue(date)` y conversión dentro de `resolveIslrRule`                     |
| API       | `sustraendoUnit` en create/update/response de conceptos                               |
| Semilla   | `seedTaxUnit()` con el valor documentado (43 Bs desde 02/06/2025)                     |
| Gate      | 2 reglas nuevas (59 en total): UT positiva y sustraendo en UT con UT cargada          |
| UI        | Selector **Bs / UT** junto al sustraendo y la lista muestra `X UT` cuando corresponde |

## 6. Criterios de aceptación

1. Un concepto con sustraendo `0,10 UT` y una UT de 43 Bs resta **4,30 Bs** de la retención.
2. Un concepto con sustraendo en Bs no consulta la UT y resta el monto tal cual.
3. Si la UT no está cargada, el sustraendo en UT vale 0 y el comprobante no se emite si el resultado
   queda en cero.
4. `resolveUnitValue` devuelve la UT vigente a la fecha, no la última cargada.
5. La UI permite cambiar la unidad y el listado la refleja.

## 7. Verificación ejecutada (2026-10-31)

Semilla con **UT = 43,00 Bs** desde 02/06/2025. Concepto `ISLR-SER` (1 %) con sustraendo **0,10 UT** y
compra de 1.000 + 160:

| Cálculo                        | Resultado                                                |
| ------------------------------ | -------------------------------------------------------- |
| 1.000 × 1 %                    | 10,00                                                    |
| Sustraendo 0,10 UT × 43 Bs     | −4,30                                                    |
| **Retenido en el comprobante** | **5,70** · `applied_rate` 1,00 · `rule_source` `CONCEPT` |

| Comprobación                               | Resultado                                      |
| ------------------------------------------ | ---------------------------------------------- |
| `db:migrate` + `db:seed:dev`               | 30 migraciones · **59/59 reglas**              |
| UT sembrada dos veces                      | sin duplicar (`onConflictDoNothing` por fecha) |
| UI: cambiar ISLR-HON a `0,5` unidad **UT** | persistido y visible en el maestro             |
| `pnpm --filter backend test`               | **1155** pruebas OK (4 nuevas de UT)           |
| `pnpm --filter database` / `frontend`      | 55 · 387 pruebas OK                            |
| `pnpm turbo run typecheck lint` / `build`  | 0 errores · 4/4                                |

## 8. Riesgos y trabajo futuro

- **El valor de la UT hay que mantenerlo**: hoy sólo está sembrado el valor documentado de 2025. Falta
  una pantalla para cargar la UT (o tomarla del cron de providencias) y una **alerta cuando la UT
  vigente tiene más de un año**, igual que la de la tasa BCV.
- **UT para el umbral**: `base_min` sigue en bolívares; la ley también lo expresa en UT en algunos
  supuestos.
- **Personas naturales**: los porcentajes siguen siendo los de personas jurídicas domiciliadas.
- **Retención por pago** y **reversión por nota de crédito**: sin cambios respecto de `S-21`.
- **Asiento contable de la retención**: sigue pendiente (`S-19`).
