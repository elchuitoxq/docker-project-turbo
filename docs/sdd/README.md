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
3. **Ejecutar** las tareas de esa épica desde [`04-plan-de-tareas.md`](./04-plan-de-tareas.md),
   marcando cada una al completarla.
4. **Implementar** siguiendo la spec correspondiente en [`specs/`](./specs/). Ninguna spec se
   considera "terminada" si no cumple su _Definition of Done_ (§ en `02-arquitectura-y-convenciones.md`).
5. **Actualizar** la bitácora de [`docs/update/09-BITACORA.md`](../update/09-BITACORA.md) al cerrar.

## Índice

| Documento                                                                                      | Contenido                                                                                          |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`00-contexto-y-metodo.md`](./00-contexto-y-metodo.md)                                         | Alcance, fuentes, glosario, principios de trabajo                                                  |
| [`01-gap-analysis.md`](./01-gap-analysis.md)                                                   | Matriz completa backend ↔ frontend ↔ docs y defectos de contrato                                   |
| [`02-arquitectura-y-convenciones.md`](./02-arquitectura-y-convenciones.md)                     | Patrones obligatorios (módulos, RBAC, multi-sucursal, dinero, auditoría)                           |
| [`03-roadmap.md`](./03-roadmap.md)                                                             | Épicas, secuencia, criterios de salida y Definition of Done                                        |
| [`04-plan-de-tareas.md`](./04-plan-de-tareas.md)                                               | WBS: 100 tareas con dependencias, verificación y registro de avance                                |
| [`specs/S-00-aislamiento-sucursal.md`](./specs/S-00-aislamiento-sucursal.md)                   | Aislamiento por sucursal + auditoría (cimiento P0)                                                 |
| [`specs/S-01-contratos-p0.md`](./specs/S-01-contratos-p0.md)                                   | Arreglar contratos rotos (HR, inventario, billing/finance)                                         |
| [`specs/S-02-nomina-ve.md`](./specs/S-02-nomina-ve.md)                                         | Completar nómina Venezuela (settings, conceptos, liquidación)                                      |
| [`specs/S-03-compras-cxp.md`](./specs/S-03-compras-cxp.md)                                     | Compras reales y cuentas por pagar                                                                 |
| [`specs/S-04-contabilidad.md`](./specs/S-04-contabilidad.md)                                   | UI + cierre contable (plan de cuentas, asientos, mapeos)                                           |
| [`specs/S-05-tesoreria-cobranzas.md`](./specs/S-05-tesoreria-cobranzas.md)                     | Métodos, cuentas, conciliación y estado de cuenta                                                  |
| [`specs/S-06-reportes-fiscales.md`](./specs/S-06-reportes-fiscales.md)                         | Libros, retenciones TXT/XML y validaciones fiscales                                                |
| [`specs/S-07-frontend-restante.md`](./specs/S-07-frontend-restante.md)                         | Notas de crédito, préstamos, auditoría y home con BI                                               |
| [`specs/S-08-multimoneda.md`](./specs/S-08-multimoneda.md)                                     | Multimoneda con el dólar como referencia (transversal P0)                                          |
| [`specs/S-09-ui-flujos-manager.md`](./specs/S-09-ui-flujos-manager.md)                         | UI de los flujos operativos del MANAGER con multimoneda de base (P0)                               |
| [`specs/S-10-vistas-detalle-documentos.md`](./specs/S-10-vistas-detalle-documentos.md)         | Fichas de pedido, venta, compra y factura con acciones en contexto (P0)                            |
| [`specs/S-11-estandarizacion-tablas.md`](./specs/S-11-estandarizacion-tablas.md)               | Tablas de listado con un único juego de primitivos visuales (P2)                                   |
| [`specs/S-12-historico-procesos-documentos.md`](./specs/S-12-historico-procesos-documentos.md) | Histórico de procesos con autor y fecha, del pedido a la facturación (P0)                          |
| [`specs/S-13-controles-de-fecha.md`](./specs/S-13-controles-de-fecha.md)                       | Un único control de fecha (Date Picker) en las 15 pantallas (P2)                                   |
| [`specs/S-14-actuaciones-rol-manager.md`](./specs/S-14-actuaciones-rol-manager.md)             | Cargo del MANAGER: qué hace, qué no, y auditoría de la cuenta (P0)                                 |
| [`specs/S-15-sincronizacion-tasa-bcv.md`](./specs/S-15-sincronizacion-tasa-bcv.md)             | Cron que lee la tasa oficial del dólar en la página del BCV (P0)                                   |
| [`specs/S-16-integridad-seeds.md`](./specs/S-16-integridad-seeds.md)                           | Semillas coherentes, gate de integridad y barrido funcional de flujos (P0)                         |
| [`specs/S-17-integridad-referencial.md`](./specs/S-17-integridad-referencial.md)               | Claves foráneas reales del núcleo: 148 FK, semántica de borrado y gate (P0)                        |
| [`specs/S-18-multimoneda-imputacion.md`](./specs/S-18-multimoneda-imputacion.md)               | Imputación multimoneda: cuenta = moneda, saldo en moneda del documento y diferencia cambiaria (P0) |
| [`specs/S-19-asiento-fiscal-factura.md`](./specs/S-19-asiento-fiscal-factura.md)               | Asiento fiscal de la factura (IVA/IGTF) y banco por cuenta contable (P0)                           |
| [`specs/S-20-maestros-bancos-impuestos-ui.md`](./specs/S-20-maestros-bancos-impuestos-ui.md)   | Maestros de bancos y conceptos de impuesto con su UI y su semilla (P1)                             |
| [`specs/S-21-regla-retencion-islr.md`](./specs/S-21-regla-retencion-islr.md)                   | Retención de ISLR unificada: concepto → tasa → empresa, con traza (P0)                             |
| [`specs/S-22-sustraendo-unidad-tributaria.md`](./specs/S-22-sustraendo-unidad-tributaria.md)   | Sustraendo de ISLR en UT, con la unidad tributaria por vigencia (P1)                               |
| [`specs/S-23-movimientos-inventario.md`](./specs/S-23-movimientos-inventario.md)               | Alta de entradas, salidas, transferencias y ajustes de inventario (P0)                             |
| [`specs/S-24-guia-interactiva-permisos.md`](./specs/S-24-guia-interactiva-permisos.md)         | Guía interactiva que explica cada submódulo según los permisos otorgados (P1)                      |
| [`specs/S-25-controles-inventario.md`](./specs/S-25-controles-inventario.md)                   | Lotes con FEFO, costo promedio móvil y aprobación en lote sin quitar permisos (P1)                 |
| [`specs/S-26-despacho-por-lote.md`](./specs/S-26-despacho-por-lote.md)                         | Despacho por lote: vencimiento, bloqueo, reserva, excepción FEFO con motivo y job diario (P1)      |

## Reglas de Oro del SDD

1. **Una spec = una rama = un PR.** Si la spec es muy grande, se parte en _slices_ verticales
   (API + UI + test) y cada slice es un PR.
2. **No se implementa nada que no esté en una spec** (salvo bug crítico documentado).
3. **Todo comportamiento nuevo** llega con: DTO validado, permiso RBAC, test unitario y
   (si toca dinero o stock) test de integración contra Postgres.
4. **Ninguna spec avanza** si `pnpm turbo run lint typecheck build test:coverage` no está verde.
5. **Los contratos son la verdad**: si el frontend necesita algo distinto, se cambia el backend
   _y_ el `openapi.json`, no se parchea la vista.
