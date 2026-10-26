# SDD — Spec-Driven Development del ERP

> **Propósito:** convertir el estado real del monorepo (código + documentación) en un plan
> ejecutable por especificaciones. Cada spec tiene alcance, contrato HTTP, modelo de datos, UI,
> reglas de negocio venezolanas, criterios de aceptación y plan de pruebas.
>
> **Fecha de análisis:** 2026-10-26 · **Base:** `main` @ `2bd0aa0`
> **Estado de partida:** build/lint/typecheck/tests/E2E en verde, 0 vulnerabilidades, CI bloqueante.
> Ver [`docs/update/`](../update/README.md) para el histórico de ese saneamiento.

## Cómo usar este SDD

1. **Leer** [`01-gap-analysis.md`](./01-gap-analysis.md): qué existe, qué falta y qué está roto.
2. **Elegir** una épica de [`03-roadmap.md`](./03-roadmap.md) según prioridad.
3. **Implementar** siguiendo la spec correspondiente en [`specs/`](./specs/). Ninguna spec se
   considera "terminada" si no cumple su _Definition of Done_ (§ en `03-roadmap.md`).
4. **Actualizar** la bitácora de [`docs/update/09-BITACORA.md`](../update/09-BITACORA.md) al cerrar.

## Índice

| Documento                                                                    | Contenido                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`00-contexto-y-metodo.md`](./00-contexto-y-metodo.md)                       | Alcance, fuentes, glosario, principios de trabajo                        |
| [`01-gap-analysis.md`](./01-gap-analysis.md)                                 | Matriz completa backend ↔ frontend ↔ docs y defectos de contrato         |
| [`02-arquitectura-y-convenciones.md`](./02-arquitectura-y-convenciones.md)   | Patrones obligatorios (módulos, RBAC, multi-sucursal, dinero, auditoría) |
| [`03-roadmap.md`](./03-roadmap.md)                                           | Épicas, secuencia, criterios de salida y Definition of Done              |
| [`specs/S-00-aislamiento-sucursal.md`](./specs/S-00-aislamiento-sucursal.md) | Aislamiento por sucursal + auditoría (cimiento P0)                       |
| [`specs/S-01-contratos-p0.md`](./specs/S-01-contratos-p0.md)                 | Arreglar contratos rotos (HR, inventario, billing/finance)               |
| [`specs/S-02-nomina-ve.md`](./specs/S-02-nomina-ve.md)                       | Completar nómina Venezuela (settings, conceptos, liquidación)            |
| [`specs/S-03-compras-cxp.md`](./specs/S-03-compras-cxp.md)                   | Compras reales y cuentas por pagar                                       |
| [`specs/S-04-contabilidad.md`](./specs/S-04-contabilidad.md)                 | UI + cierre contable (plan de cuentas, asientos, mapeos)                 |
| [`specs/S-05-tesoreria-cobranzas.md`](./specs/S-05-tesoreria-cobranzas.md)   | Métodos, cuentas, conciliación y estado de cuenta                        |
| [`specs/S-06-reportes-fiscales.md`](./specs/S-06-reportes-fiscales.md)       | Libros, retenciones TXT/XML y validaciones fiscales                      |
| [`specs/S-07-frontend-restante.md`](./specs/S-07-frontend-restante.md)       | Notas de crédito, préstamos, auditoría y home con BI                     |

## Reglas de Oro del SDD

1. **Una spec = una rama = un PR.** Si la spec es muy grande, se parte en _slices_ verticales
   (API + UI + test) y cada slice es un PR.
2. **No se implementa nada que no esté en una spec** (salvo bug crítico documentado).
3. **Todo comportamiento nuevo** llega con: DTO validado, permiso RBAC, test unitario y
   (si toca dinero o stock) test de integración contra Postgres.
4. **Ninguna spec avanza** si `pnpm turbo run lint typecheck build test:coverage` no está verde.
5. **Los contratos son la verdad**: si el frontend necesita algo distinto, se cambia el backend
   _y_ el `openapi.json`, no se parchea la vista.
