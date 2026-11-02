# S-21 — Regla de retención de ISLR unificada

| Campo      | Valor                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| Estado     | Implementado                                                                              |
| Prioridad  | P0                                                                                        |
| Alcance    | `apps/backend` (compras), `packages/database` (migración, semilla, gate), `apps/frontend` |
| Depende de | S-03, S-06, S-20                                                                          |
| Fecha      | 2026-10-31                                                                                |

## 1. Contexto

`S-20` dejó administrable el catálogo de conceptos de ISLR y el formulario del proveedor con su
selector, pero al revisar el cálculo apareció que **el concepto no se usaba para nada**:

1. `SupplierRetentionService` calculaba el ISLR con `supplier_retention_settings` (tasa, sustraendo y
   umbral **por empresa**), ignorando el concepto del proveedor.
2. `partners.retention_rate` se guardaba y se mostraba, pero ningún cálculo lo leía.
3. `tax_retention_lines.concept_id` existía y se insertaba **siempre en `null`**: el comprobante no
   decía bajo qué concepto se retuvo.
4. El comprobante tampoco guardaba el porcentaje aplicado, así que no se podía auditar un voucher
   sin recalcularlo.

En la práctica, tres caminos distintos decían cómo retener y sólo uno se aplicaba.

## 2. Regla única

El porcentaje de ISLR del comprobante se resuelve con esta precedencia — **el primero que exista
gana**:

| Orden | Fuente                                       | Porcentaje    | Base mínima / sustraendo | `rule_source` |
| ----- | -------------------------------------------- | ------------- | ------------------------ | ------------- |
| 1     | Concepto del proveedor, **habilitado**       | del concepto  | del concepto             | `CONCEPT`     |
| 2     | Tasa propia del proveedor (`retention_rate`) | de la ficha   | de la empresa            | `PARTNER`     |
| 3     | Parámetros de la empresa                     | de la empresa | de la empresa            | `SETTINGS`    |

Notas:

- Un concepto **deshabilitado** no retiene por sí mismo: cae al siguiente nivel. Así se puede apagar
  un concepto sin dejar a los proveedores sin retención.
- El **IVA** siempre sale de los parámetros de la empresa (75 % ordinario, 100 % contribuyente
  especial) con `rule_source = SETTINGS`: no depende del concepto de ISLR.
- Si la base no alcanza la base mínima o el porcentaje es 0, no se emite comprobante (misma regla que
  antes: un retenido de 0 no es una obligación fiscal y ensucia el correlativo).

## 3. Modelo de datos (`0029_retention_rule_source`)

`tax_retentions` gana dos columnas:

| Columna        | Tipo            | Uso                                        |
| -------------- | --------------- | ------------------------------------------ |
| `applied_rate` | `numeric(20,2)` | Porcentaje realmente aplicado (IVA o ISLR) |
| `rule_source`  | `text`          | `CONCEPT` · `PARTNER` · `SETTINGS`         |

Y `tax_retention_lines.concept_id` deja de ser siempre `null`: guarda el concepto que justificó el
importe, que es lo que exportan el XML de ISLR y el TXT del SENIAT.

## 4. Cambios en el backend

- `resolveIslrRule(partnerId, companyId)` en `supplier-retention.service.ts` implementa la tabla de
  precedencia y devuelve `{ rate, threshold, sustraendo, conceptId, conceptCode, source }`.
- `retainInvoice` usa esa regla y expone en `RetentionResult` el porcentaje aplicado, su origen y el
  concepto (`islrRate`, `islrRuleSource`, `islrConceptId`); `null` cuando no hubo retención.
- `upsertRetention` persiste `applied_rate`, `rule_source` y el `concept_id` de la línea.

## 5. Semilla

`seedPurchaseRetentions` resuelve la retención con **la misma precedencia** que el servicio, en vez de
aplicar siempre la tasa de la empresa, y completa los comprobantes heredados (los que ya existían sin
`applied_rate`) sin emitir duplicados. Eso mantiene la idempotencia y repara bases viejas.

## 6. Gate (de 55 a 57 reglas)

| Regla                                                              | Motivo                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Cada comprobante de retención guarda la tasa y la regla que aplicó | sin esto el voucher no se puede auditar ni recalcular       |
| La retención por concepto apunta al concepto que la justificó      | detecta un `rule_source = CONCEPT` sin concepto en la línea |

## 7. UI

- Nueva pantalla **Configuración → Retenciones al proveedor**: IVA ordinario/especial, ISLR por
  defecto, sustraendo y base mínima, con guardado (`PATCH /billing/invoices/supplier-retention-settings`).
  Antes estos parámetros sólo se podían cambiar por API.
- La misma pantalla explica la precedencia y cuántos conceptos habilitados hay, con enlace al maestro.
- El listado de conceptos aclara que el concepto del proveedor manda sobre los parámetros de empresa.

## 8. Criterios de aceptación

1. Proveedor con concepto habilitado ⇒ retención al porcentaje del concepto aunque la empresa tenga
   otro, y el comprobante lo marca `CONCEPT` con el concepto en la línea.
2. Proveedor sin concepto pero con tasa propia ⇒ retención a esa tasa, `PARTNER`.
3. Proveedor sin concepto ni tasa ⇒ parámetros de la empresa, `SETTINGS`.
4. Concepto deshabilitado ⇒ cae a los parámetros de la empresa.
5. Sin retención (base bajo el mínimo o tasa 0) ⇒ no se emite comprobante y no se inventa concepto.
6. El IVA se retiene con los parámetros de la empresa en todos los casos.

## 9. Verificación ejecutada (2026-10-31)

Precedencia probada por API con la empresa a **2 %** y el concepto `ISLR-SER` a **1 %**, sobre compras
de 1.000 + 160:

| Compra    | Proveedor                 | Concepto | Retenido ISLR   | `applied_rate` | `rule_source` | Concepto en la línea |
| --------- | ------------------------- | -------- | --------------- | -------------- | ------------- | -------------------- |
| `A-00007` | Proveedor Internacional   | ISLR-SER | **10,00** (1 %) | 1,00           | `CONCEPT`     | `ISLR-SER`           |
| `A-00008` | Servicios Integrados C.A. | —        | **20,00** (2 %) | 2,00           | `SETTINGS`    | —                    |

Y con la empresa de vuelta en 1 % (`A-00005` con concepto, `A-00006` sin concepto) ambos coinciden en
10,00 pero el origen queda registrado distinto.

| Comprobación                                          | Resultado                                    |
| ----------------------------------------------------- | -------------------------------------------- |
| `db:reset` + 29 migraciones + `db:seed:dev`           | **57/57 reglas**                             |
| Semilla dos veces                                     | sin duplicados; completa comprobantes viejos |
| `pnpm --filter backend test`                          | **1150** pruebas OK (6 nuevas de la regla)   |
| `pnpm --filter database test`                         | 55 pruebas OK                                |
| `pnpm --filter frontend test`                         | 387 pruebas OK                               |
| `pnpm turbo run typecheck lint` / `build`             | 0 errores · 4/4                              |
| Pantalla de retenciones: guardar 1,5 % y volver a 1 % | persistido y confirmado con toast            |

## 10. Riesgos y trabajo futuro

- **Sustraendo en unidades tributarias**: la ley expresa algunos sustraendos en UT y hoy el parámetro
  es un monto en bolívares. Falta resolverlo con la UT vigente (`income_tax_brackets` ya tiene la
  tabla por ejercicio).
- **Personas naturales**: el catálogo usa los porcentajes de personas jurídicas domiciliadas; para
  naturales hay otros porcentajes y requiere validación profesional.
- **Retención sobre pagos parciales**: hoy la retención se emite al publicar la compra, con el total
  de la factura. Falta el caso de retener por cada pago.
- **Nota de crédito sobre la compra**: no revierte la retención ya emitida.
- **Asiento de la retención**: el comprobante no genera asiento contable (deuda abierta de `S-19`).
