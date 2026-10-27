# S-07 — Frontend restante (módulos sin UI)

| Campo          | Valor                                                      |
| -------------- | ---------------------------------------------------------- |
| **Estado**     | ⬜ Especificada                                            |
| **Prioridad**  | 🟡 P2                                                      |
| **Depende de** | S-01 (contratos), S-04 (asientos), S-05 (estado de cuenta) |
| **Épica**      | E7                                                         |

---

## 1. Problema

Cuatro módulos del backend (notas de crédito, préstamos, auditoría, contabilidad) no tienen ninguna
pantalla y el home del dashboard es un stub. Además faltan pantallas planificadas: stock por almacén,
ficha de empleado y detalle de nómina (estas dos últimas en `S-02`).

## 2. Alcance (por slice independiente)

### A. Notas de crédito (depende de S-04)

- `modules/credit-notes`: `api.ts`, `hooks.ts`, `components/`.
- Pantalla `finance/credit-notes`: listado, alta desde factura, postear, anular, aplicar a factura.
- Regla: el saldo aplicado no puede exceder el total de la NC ni el saldo de la factura.

### B. Préstamos (independiente)

- `modules/loans` con listado, detalle y acciones `approve`, `reject`, `pay`.
- Pantalla `finance/loans` (o `hr/loans` si son adelantos de empleado — **decidir con negocio**;
  el schema `loans` + `loan_items` parece préstamos a terceros/empleados).
- **Decisión tomada (2026-10-27):** `loans` + `loan_items` modela **préstamo de artículos**
  (`productId`, `serialNumber`, `condition`), no préstamos de dinero. Por eso `pay` registra una
  **devolución** y no genera movimiento de tesorería ni asiento contable: el criterio original
  "al pagar, generar movimiento de tesorería y asiento" no aplica a este modelo. Los ítems llevan
  `kind` (`DELIVERED` al crear / `RETURNED` al devolver) y el préstamo pasa a `PAID` con
  `returnDate` solo cuando lo devuelto cubre lo entregado (`H-99`).

### C. Auditoría (depende de S-00)

- Endpoint nuevo `GET /v1/audit?entityTable&entityId&userId&from&to&page&limit` (hoy sólo existe por
  entidad concreta).
- Pantalla `settings/audit`: filtros, tabla con diff expandible y exportación CSV.

### D. Home del dashboard (depende de BI)

- Reemplazar el stub de `app/(dashboard)/dashboard/page.tsx` por 4 KPIs reales (`/bi/kpis`),
  gráfico de ventas (`/bi/chart`) y actividad reciente (`/bi/activity`).
- Selección de rango (hoy/7 días/mes) y respeto del contexto de sucursal (`S-00`).

### E. Inventario: stock por almacén

- Pantalla `inventory/stock` usando `GET /v1/inventory/stock/:warehouseId` con alertas de mínimos.

### F. Ajustes de navegación

- Agregar al sidebar los módulos nuevos con `permission` correcta en `lib/navigation.ts`.
- Mantener sincronizado `lib/permissions.ts` con la seed RBAC.

## 3. Historias de usuario

| ID   | Historia                                                                 |
| ---- | ------------------------------------------------------------------------ |
| HU-1 | Como facturador emito una nota de crédito y la aplico a una factura.     |
| HU-2 | Como gerente apruebo un préstamo y registro su pago.                     |
| HU-3 | Como auditor consulto el historial de cambios de una factura.            |
| HU-4 | Como gerente veo en el home las ventas del día y las cuentas por cobrar. |
| HU-5 | Como almacenero veo el stock por almacén con alertas de mínimo.          |

## 4. Modelo de datos

- **Sin tablas nuevas**: todas existen (`credit_notes`, `loans`, `audit_logs`, `stock`).
- Sólo el endpoint de listado de auditoría requiere índice `audit_logs(entity_table, entity_id, created_at)`.

## 5. Contrato HTTP

| Módulo    | Endpoints                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------- |
| NC        | `/v1/credit-notes` (GET/POST/PATCH), `/:id/post`, `/:id/void`, `/:id/apply/:invoiceId` — ya existen |
| Préstamos | `/v1/loans` (GET/POST), `/:id/approve`, `/:id/reject`, `/:id/pay` — ya existen                      |
| Auditoría | `GET /v1/audit` (nuevo, paginado) + `GET /v1/audit/:entityTable/:entityId` (existe)                 |
| BI        | `kpis`, `chart`, `activity` — existen                                                               |
| Stock     | `GET /v1/inventory/stock/:warehouseId` — existe                                                     |

## 6. UI/UX

- Todas las pantallas: loading, vacío, error, filtros y acción primaria.
- Auditoría con `diff` legible (campo: antes → después) y enlaces al documento origen.
- Home con tarjetas y gráfico; los KPIs deben indicar el rango y la sucursal.

## 7. Reglas de negocio

1. Un módulo visible en el menú exige permiso de lectura del backend.
2. Las acciones se deshabilitan (no se ocultan) cuando el estado no lo permite, con tooltip del motivo.
3. Préstamos: `approve` sólo desde `PENDING`; `pay` registra devoluciones sin permitir devolver
   más de lo entregado y cierra el préstamo (`PAID` + `returnDate`) cuando la devolución cubre lo
   entregado.
4. Auditoría: sólo lectura, sin acciones de edición.
5. El home nunca muestra datos de una sucursal distinta a la activa.

## 8. Criterios de aceptación (Gherkin)

```gherkin
Escenario: NC aplicada a factura
  Dado una NC publicada por 100
  Cuando la aplico a una factura con saldo 300
  Entonces el saldo de la factura pasa a 200
  Y la NC queda marcada como aplicada

Escenario: préstamo devuelto por completo
  Dado un préstamo ACTIVE con 2 artículos entregados
  Cuando registro la devolución de 1
  Entonces el préstamo sigue ACTIVE y el listado muestra 1 / 2

Escenario: préstamo pagado dos veces
  Dado un préstamo PAID
  Cuando intento registrar otra devolución
  Entonces recibe 400 con "Loan must be ACTIVE" y la UI ya no ofrece el botón

Escenario: home con datos reales
  Cuando abro /dashboard
  Entonces veo 4 KPIs con valores numéricos (no guiones)
  Y el rango por defecto es "hoy"
```

## 9. Plan de pruebas

| Tipo          | Caso                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| Unitario      | Hooks de cada módulo (mock MSW)                                         |
| Integración   | NC aplicada; devolución parcial y total de préstamo; auditoría filtrada |
| E2E           | Emitir NC y ver saldo; aprobar y pagar préstamo; home con KPIs          |
| Accesibilidad | Navegación por teclado en tablas y diálogos                             |

## 10. Riesgos

| Riesgo                                 | Mitigación                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Falta de specs de negocio en préstamos | **Resuelto:** el modelo es préstamo de artículos (bienes); documentado en §2.B |
| Auditoría con mucho volumen            | Paginación server-side + índices + límite de rango (máx. 90 días)              |
| Navegación saturada                    | Agrupar en submenús y respetar permisos                                        |
