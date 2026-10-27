# 03 — Roadmap

## Criterios de orden

1. **Primero lo que rompe** (contratos 404/405 y aislamiento de datos).
2. **Luego lo que habilita dinero** (compras/CxP, tesorería).
3. **Después lo que da control** (contabilidad, reportes fiscales).
4. **Al final lo que da visibilidad** (UI de préstamos, auditoría, home con BI).

## Épicas

| Épica                                         | Spec                                           | Prioridad | Por qué en ese orden                                                                         | Esfuerzo |
| --------------------------------------------- | ---------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- | -------- |
| **E0 · Aislamiento por sucursal + auditoría** | [`S-00`](./specs/S-00-aislamiento-sucursal.md) | 🔴 P0     | Hoy un usuario puede ver datos de otra sucursal; es un riesgo de negocio y de cumplimiento   | M        |
| **E8 · Multimoneda (dólar como referencia)**  | [`S-08`](./specs/S-08-multimoneda.md)          | 🔴 P0     | El libro no declara moneda y la tasa puede quedar congelada: contamina todo documento futuro | L        |
| **E1 · Reparar contratos**                    | [`S-01`](./specs/S-01-contratos-p0.md)         | 🔴 P0     | 8 endpoints de HR + 7 de inventario/billing/reportes devuelven 404/405 en producción         | M        |
| **E2 · Nómina Venezuela completa**            | [`S-02`](./specs/S-02-nomina-ve.md)            | 🟠 P1     | Es el módulo con más contratos rotos y la mayor carga regulatoria                            | L        |
| **E3 · Compras y cuentas por pagar**          | [`S-03`](./specs/S-03-compras-cxp.md)          | 🟠 P1     | Sin CxP no hay ciclo de compras ni retenciones de compra                                     | L        |
| **E4 · Contabilidad y cierre**                | [`S-04`](./specs/S-04-contabilidad.md)         | 🟠 P1     | Los asientos existen pero nadie los opera ni cierra el período                               | M        |
| **E5 · Tesorería y cobranzas**                | [`S-05`](./specs/S-05-tesoreria-cobranzas.md)  | 🟡 P2     | Cierre diario, conciliación y estado de cuenta con fechas                                    | M        |
| **E6 · Reportes fiscales**                    | [`S-06`](./specs/S-06-reportes-fiscales.md)    | 🟡 P2     | Libros y retenciones: obligación legal, depende de E3/E4                                     | M        |
| **E7 · Frontend restante**                    | [`S-07`](./specs/S-07-frontend-restante.md)    | 🟡 P2     | Notas de crédito, préstamos, auditoría y home                                                | M        |

## Secuencia recomendada (slices de ~1 semana)

> **Orden vigente desde el 2026-10-26:** multimoneda (E8) entra antes de contabilidad, y la obligación
> fiscal (E6) va antes de compras/CxP (E3) y tesorería (E5). El número de épica identifica la spec, no
> el turno de ejecución.

```
Semana 1-2  S-00  Guard de sucursal, permisos, migraciones, auditoría y pruebas cruzadas
Semana 3-4  S-08  Multimoneda: moneda funcional, tasas, montos base, MoneyService, IGTF
Semana 5    S-01  Contratos: HR, inventario, billing y partners
Semana 6-7  S-02  Nomina: parametros, conceptos, motor de calculo, liquidacion y pago
Semana 8-9  S-04  Contabilidad: plan de cuentas, asientos, cierre y estados financieros
Semana 10-11 S-06 Fiscal: libro de ventas, IVA/IGTF, retenciones TXT/XML y validaciones
Semana 12-13 S-03 Compras: facturas de proveedor, CxP, retenciones y pagos
Semana 14-15 S-05 Tesoreria: metodos, cuentas, cierre diario, conciliacion y caja chica
Semana 16   S-07  Notas de credito, prestamos, auditoria y home con BI
```

> Las duraciones son orientativas para una persona. Cada bloque debe terminar con el
> **Definition of Done** de [`02-arquitectura-y-convenciones.md`](./02-arquitectura-y-convenciones.md) §10.
>
> El desglose tarea por tarea de cada semana está en
> [`04-plan-de-tareas.md`](./04-plan-de-tareas.md).

## Dependencias entre specs

```
S-00 ──┬── S-01
       ├── S-02
       ├── S-08 ──┬── S-04 ── S-06 (libro de ventas y estados)
       │          ├── S-03 (montos base, retenciones)
       │          └── S-05 (cobros en moneda distinta)
       └── S-05 ── S-06 (validacion de cierres)
S-06 ── S-03 (libro de compras y retenciones de compra necesitan CxP)
S-07 depende de S-01 (contratos) y S-04 (asientos para NC)
```

## Métricas de éxito del plan

| Métrica                                     | Hoy                            | Objetivo                                    |
| ------------------------------------------- | ------------------------------ | ------------------------------------------- |
| Módulos con UI funcional                    | 8 de 22                        | 18 de 22                                    |
| Llamadas del frontend que devuelven 404/405 | ≥ 15                           | 0                                           |
| Endpoints con aislamiento por sucursal      | 0 %                            | 100 % de los de negocio                     |
| Documentos con moneda, tasa y monto base    | parcial (`invoices` sí)        | 100 % de los que mueven dinero              |
| Agregaciones contables en moneda funcional  | 0 % (el libro no tiene moneda) | 100 % en VES + columna USD paralela         |
| Cobertura backend (statements)              | 65 %                           | ≥ 80 %                                      |
| Flujos E2E cubiertos                        | 3 (login, reset, health)       | 9 (incluye facturar en USD y cobrar en VES) |

## Backlog posterior (sin spec aún)

Activos fijos y depreciación · presupuestos · caja chica · notificaciones transaccionales ·
portal de clientes · multi-empresa contable (hoy el contexto es empresa→sucursal pero los asientos
son por sucursal) · app móvil de inventario.
