# 03 — Roadmap

## Criterios de orden

1. **Primero lo que rompe** (contratos 404/405 y aislamiento de datos).
2. **Luego lo que habilita dinero** (compras/CxP, tesorería).
3. **Después lo que da control** (contabilidad, reportes fiscales).
4. **Al final lo que da visibilidad** (UI de préstamos, auditoría, home con BI).

## Épicas

| Épica                                         | Spec                                           | Prioridad | Por qué en ese orden                                                                       | Esfuerzo |
| --------------------------------------------- | ---------------------------------------------- | --------- | ------------------------------------------------------------------------------------------ | -------- |
| **E0 · Aislamiento por sucursal + auditoría** | [`S-00`](./specs/S-00-aislamiento-sucursal.md) | 🔴 P0     | Hoy un usuario puede ver datos de otra sucursal; es un riesgo de negocio y de cumplimiento | M        |
| **E1 · Reparar contratos**                    | [`S-01`](./specs/S-01-contratos-p0.md)         | 🔴 P0     | 8 endpoints de HR + 7 de inventario/billing/reportes devuelven 404/405 en producción       | M        |
| **E2 · Nómina Venezuela completa**            | [`S-02`](./specs/S-02-nomina-ve.md)            | 🟠 P1     | Es el módulo con más contratos rotos y la mayor carga regulatoria                          | L        |
| **E3 · Compras y cuentas por pagar**          | [`S-03`](./specs/S-03-compras-cxp.md)          | 🟠 P1     | Sin CxP no hay ciclo de compras ni retenciones de compra                                   | L        |
| **E4 · Contabilidad y cierre**                | [`S-04`](./specs/S-04-contabilidad.md)         | 🟠 P1     | Los asientos existen pero nadie los opera ni cierra el período                             | M        |
| **E5 · Tesorería y cobranzas**                | [`S-05`](./specs/S-05-tesoreria-cobranzas.md)  | 🟡 P2     | Cierre diario, conciliación y estado de cuenta con fechas                                  | M        |
| **E6 · Reportes fiscales**                    | [`S-06`](./specs/S-06-reportes-fiscales.md)    | 🟡 P2     | Libros y retenciones: obligación legal, depende de E3/E4                                   | M        |
| **E7 · Frontend restante**                    | [`S-07`](./specs/S-07-frontend-restante.md)    | 🟡 P2     | Notas de crédito, préstamos, auditoría y home                                              | M        |

## Secuencia recomendada (slices de ~1 semana)

```
Semana 1   S-00  R1/R2 (guards de sucursal) + auditoría en escrituras
Semana 2   S-01  HR: endpoints faltantes + nombres de payroll
Semana 3   S-01  Inventario + billing/finance (PATCH, type, paginación)
Semana 4   S-02  Nómina: settings + conceptos (API + pantallas)
Semana 5   S-02  Nómina: liquidación + pago integrado a tesorería
Semana 6   S-03  Compras: facturas de proveedor + CxP
Semana 7   S-03  Retenciones de compra + pagos a proveedor
Semana 8   S-04  Plan de cuentas + asientos manuales (UI)
Semana 9   S-04  Cierre de período + balance/resultados
Semana 10  S-05  Cierre diario, conciliación y estado de cuenta
Semana 11  S-06  Libros de venta/compra + TXT/XML
Semana 12  S-07  Notas de crédito, préstamos, auditoría, home BI
```

> Las duraciones son orientativas para una persona. Cada bloque debe terminar con el
> **Definition of Done** de [`02-arquitectura-y-convenciones.md`](./02-arquitectura-y-convenciones.md) §10.
>
> El desglose tarea por tarea de cada semana está en
> [`04-plan-de-tareas.md`](./04-plan-de-tareas.md).

## Dependencias entre specs

```
S-00 ──┬── S-01
       ├── S-02 ── S-03
       ├── S-04 ── S-06
       └── S-05 ── S-06
S-07 depende de S-01 (contratos) y S-04 (asientos para NC)
```

## Métricas de éxito del plan

| Métrica                                     | Hoy                      | Objetivo                                     |
| ------------------------------------------- | ------------------------ | -------------------------------------------- |
| Módulos con UI funcional                    | 8 de 22                  | 18 de 22                                     |
| Llamadas del frontend que devuelven 404/405 | ≥ 15                     | 0                                            |
| Endpoints con aislamiento por sucursal      | 0 %                      | 100 % de los de negocio                      |
| Cobertura backend (statements)              | 65 %                     | ≥ 80 %                                       |
| Flujos E2E cubiertos                        | 3 (login, reset, health) | 8 (incluye facturar, cobrar, nómina, cierre) |

## Backlog posterior (sin spec aún)

Activos fijos y depreciación · presupuestos · caja chica · notificaciones transaccionales ·
portal de clientes · multi-empresa contable (hoy el contexto es empresa→sucursal pero los asientos
son por sucursal) · app móvil de inventario.
