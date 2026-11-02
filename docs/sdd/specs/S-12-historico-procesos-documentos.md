# S-12 — Histórico de procesos en el detalle de los documentos

| Campo          | Valor                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------- |
| **Estado**     | 🟢 Entregada                                                                                        |
| **Prioridad**  | 🔴 P0 — sin rastro de autoría no se puede auditar quién movió un documento                          |
| **Depende de** | S-10 (fichas de documento), S-00 (auditoría por sucursal)                                           |
| **Épica**      | E12                                                                                                 |
| **Origen**     | Revisión del 2026-10-30: "el detalle debe tener un histórico que viaje del pedido a la facturación" |

---

## 1. Problema

La ficha de un pedido o de una factura mostraba **el estado actual y nada más**. No había forma de
responder las preguntas que un gerente o un contador hace todos los días:

- ¿Quién creó este pedido y quién lo confirmó?
- ¿Cuándo se facturó y con qué documento?
- ¿Quién anuló la factura y por qué?
- Si abro la factura, ¿puedo ver de qué pedido salió y qué le pasó antes?

El `audit_logs` existente no sirve para esto: registra **peticiones HTTP** sobre una lista cerrada de
recursos (pedidos no estaba incluido), no guarda transiciones de estado y no escribe nada cuando una
factura nace desde un pedido, porque no hay una petición HTTP de facturación.

## 2. Alcance

1. **Tabla append-only** `document_events` con acción, estados de origen y destino, autor, sucursal y
   fecha.
2. **Registro** de cada acción de negocio en pedidos y facturas.
3. **Cadena completa**: el histórico se lee igual desde el pedido y desde la factura.
4. **Línea de tiempo** en las cuatro fichas (pedido, venta, compra y facturación).

## 3. Diseño

### 3.1 Modelo

```
document_events
  id                  uuid pk
  document_type       text     ORDER | INVOICE
  document_id         uuid
  document_code       text
  parent_document_id  uuid     ← pedido de origen cuando el evento es de una factura
  action              text     ORDER_CREATED | ORDER_CONFIRMED | … | INVOICE_VOIDED
  from_status         text
  to_status           text
  description         text     ← motivo de anulación, campos editados, factura generada
  metadata            jsonb
  user_id             uuid
  branch_id           uuid
  created_at          timestamp
```

Índices: `(document_type, document_id, created_at)` para la consulta de la ficha,
`(parent_document_id, created_at)` para la cadena y `(branch_id, created_at)` para reportes.

**Nunca se actualiza ni se borra una fila**: el histórico es la evidencia, no un resumen del estado.

### 3.2 Cadena pedido → factura

`parent_document_id` es la pieza que hace que el histórico "viaje":

- La factura creada desde un pedido guarda el `orderId` del pedido en ese campo.
- `GET /orders/:id` devuelve los eventos del pedido **más** los de sus facturas.
- `GET /billing/invoices/:id` resuelve el pedido de origen y devuelve la **misma** cadena.

Así el contador que abre la factura ve los cuatro o cinco pasos completos, y el gerente que abre el
pedido ve hasta la emisión de la factura.

### 3.3 Acciones registradas

| Acción            | Documento | Transición                | Descripción que guarda          |
| ----------------- | --------- | ------------------------- | ------------------------------- |
| `ORDER_CREATED`   | Pedido    | → `DRAFT`                 | `Venta · 3 líneas`              |
| `ORDER_UPDATED`   | Pedido    | estado → estado           | `Campos: warehouseId, date`     |
| `ORDER_CONFIRMED` | Pedido    | `DRAFT` → `CONFIRMED`     | —                               |
| `ORDER_CANCELLED` | Pedido    | estado → `CANCELLED`      | —                               |
| `ORDER_INVOICED`  | Pedido    | `CONFIRMED` → `COMPLETED` | `Factura A-00021`               |
| `INVOICE_CREATED` | Factura   | → `DRAFT`                 | `Generada desde un pedido`      |
| `INVOICE_UPDATED` | Factura   | `DRAFT` → `DRAFT`         | `Campos: items, dueDate`        |
| `INVOICE_POSTED`  | Factura   | `DRAFT` → `POSTED`        | `Folio fiscal 0007` (si existe) |
| `INVOICE_VOIDED`  | Factura   | `POSTED` → `VOID`         | `Factura anulada: Error…`       |

El autor viaja desde el `@CurrentUser()` del controlador; sin usuario (semillas, procesos internos)
el evento queda con `user_id` nulo y la UI muestra "Sistema".

### 3.4 API

El histórico viaja **dentro** del detalle: no hay ruta nueva que autorizar y la ficha hace una sola
petición.

| Endpoint                             | Cambio                                                      |
| ------------------------------------ | ----------------------------------------------------------- |
| `GET /v1/orders/:id`                 | `history: DocumentEventDto[]` (incluye la factura)          |
| `GET /v1/billing/invoices/:id`       | `history: DocumentEventDto[]` (incluye el pedido de origen) |
| `POST /v1/billing/invoices/:id/void` | acepta `{ reason }` y lo guarda en el histórico             |

Internamente `findOne` sigue siendo barato y el histórico se resuelve en `findOneWithHistory`, que es
lo que usan los controladores: las llamadas internas (crear, editar, emitir, anular) no pagan las
consultas del histórico.

### 3.5 UI

`DocumentTimeline` (`modules/documents/components/document-timeline.tsx`) dibuja una línea vertical con
un icono por acción, la etiqueta legible, la transición de estado, la descripción y la firma
`30/10/2026, 20:43 · Test Manager`. Los pasos que pertenecen al **otro** documento de la cadena llevan
su código (`Factura A-90021`, `Pedido ORD-000001`) y un enlace para saltar a él. En impresión se oculta
(`data-print="hide"`): el papel es para el cliente o el proveedor, no para la auditoría interna.

## 4. Tareas

| ID      | Tarea                                                                                 | Artefactos                                            | Verificación                                                   | Talla | Estado |
| ------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | ----- | ------ |
| T-12-01 | Tabla `document_events` + migración `0023` (con siembra de los documentos existentes) | `packages/database/src/schema.ts`, `drizzle/0023_*`   | tabla creada con sus tres índices y un paso base por documento | M     | ✅     |
| T-12-02 | `DocumentEventsService`: registro tolerante a fallos y cadena completa                | `modules/documents/*`                                 | la cadena se lee desde ambos extremos                          | L     | ✅     |
| T-12-03 | Eventos en pedidos (crear, editar, confirmar, cancelar, facturar)                     | `orders.service.ts`, `orders.controller.ts`           | cada acción deja una fila con su autor                         | M     | ✅     |
| T-12-04 | Eventos en facturas (crear, editar, emitir, anular con motivo)                        | `billing.service.ts`, `billing.controller.ts`         | anulación guarda el motivo                                     | M     | ✅     |
| T-12-05 | `history` en los dos `GET /:id`                                                       | `dto/*.dto.ts`, `findOneWithHistory`                  | mismo arreglo de eventos en pedido y factura                   | S     | ✅     |
| T-12-06 | `DocumentTimeline` en las cuatro fichas                                               | `document-timeline.tsx`, fichas de pedido y factura   | fecha con hora, usuario y enlace cruzado                       | M     | ✅     |
| T-12-07 | Autor del pedido en `orders.user_id` (la ficha muestra "Registró")                    | `orders.service.ts`                                   | ficha con "Registró: Test Manager"                             | S     | ✅     |
| T-12-08 | `finance:invoices:post` para MANAGER (`DEF-025`)                                      | `seed-rbac.ts`                                        | el MANAGER cierra el flujo hasta la emisión                    | S     | ✅     |
| T-12-09 | Pruebas de integración y de componente                                                | `test/document-history.test.ts`, `documents.test.tsx` | 4 + 2 pruebas nuevas                                           | M     | ✅     |

**Complemento 2026-10-30:** con los formularios de alta (`T-09-15` y `T-09-10`) la cadena empieza en la
UI: el pedido creado desde "Nuevo pedido" nace con `ORDER_CREATED` firmado, y la factura creada desde
"Nueva factura" arranca con `INVOICE_CREATED` (y `parentDocumentId` si viene de un pedido).

## 5. Decisiones

- **Tabla propia en vez de `audit_logs`.** El log de auditoría registra peticiones; el histórico
  registra hechos de negocio. Mezclarlos haría que la evidencia de cumplimiento dependiera de cómo se
  llamó al endpoint.
- **El histórico va embebido en el detalle.** Una ruta aparte obligaría a otra petición, otro permiso y
  otro estado de carga en la ficha, para un dato que siempre se muestra junto al documento.
- **`parent_document_id` en la factura, no una tabla de relaciones.** Un pedido se factura una sola vez
  (`T-10-12`), así que la cadena es lineal y una columna basta.
- **La escritura del evento nunca rompe la transacción.** Si falla el registro, se loguea y la acción
  del usuario sigue en pie: perder un renglón de histórico es menos grave que perder una factura.
- **Los documentos anteriores se siembran con su paso de creación.** La migración inserta un
  `ORDER_CREATED` / `INVOICE_CREATED` con la fecha y el autor reales de cada documento existente
  ("Registro previo al histórico"). No se inventan los pasos intermedios: la ficha muestra el punto de
  partida en vez de una línea vacía, y a partir de ahí cada acción nueva queda firmada.

## 6. Verificación

| Comprobación                                  | Resultado                                                  |
| --------------------------------------------- | ---------------------------------------------------------- |
| Flujo completo `ORD-HIST-9002` → `A-90021`    | 5 pasos con fecha, hora y autor                            |
| Histórico del pedido vs. de la factura        | mismos `id` de evento (una sola cadena)                    |
| Ficha de factura muestra los pasos del pedido | sí, con distintivo `Pedido ORD-HIST-9002` y enlace         |
| Autor del pedido                              | "Registró: Test Manager" y evento con `userName`           |
| Anulación con motivo                          | `Factura anulada: Error en el precio`                      |
| Impresión                                     | la línea de tiempo se oculta (`data-print="hide"`)         |
| Documentos previos a la épica                 | siembra de su paso de creación con fecha y autor reales    |
| Pruebas                                       | backend **1088** (4 nuevas) · frontend **359** (10 nuevas) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | 6/6 · 0 errores · 4/4                                      |

**Gate de salida E12:** toda acción sobre un pedido o una factura deja una fila con su autor y su
fecha; el detalle de cualquiera de los dos documentos muestra la cadena completa desde la creación del
pedido hasta la emisión (o anulación) de la factura; y el histórico no se puede reescribir.
