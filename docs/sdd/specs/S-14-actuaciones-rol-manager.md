# S-14 — Actuaciones reales del rol MANAGER y auditoría de la cuenta de prueba

**Épica:** E14 · Contrato del cargo MANAGER
**Prioridad:** 🔴 P0 (gobierna qué puede hacer el gerente en todos los flujos)
**Estado:** implementado (2026-10-31)
**Origen:** revisión del 2026-10-31 — “¿cuáles son las actuaciones reales de un manager en un ERP y
está bien armado el cargo de `test-manager@test.local`?”

---

## 1. Problema

El rol MANAGER creció por acumulación de decisiones puntuales (`D-02`…`D-07`, `DEF-025`) y ninguna
fuente lo describía completo. Tres documentos decían cosas distintas:

| Fuente                  | Qué decía                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `database-spec.md` §4.2 | 18 permisos, sin pedidos, sin compras, sin notas de crédito, sin emisión de facturas |
| `qa/01-manager.md`      | “no emite facturas”; menú sin Compras, Monedas ni Reportes                           |
| `seed-rbac.ts` (real)   | 42 permisos, incluidos `finance:invoices:create` y `:post`                           |

Con ese desorden no se podía responder si la cuenta de prueba estaba bien armada, ni detectar los
huecos operativos: el gerente podía crear un borrador de factura que después no podía corregir ni
anular, y no podía ver el kardex del stock que vende.

## 2. Actuaciones reales del cargo (lo que el gerente hace, no los códigos)

| #   | Actuación                                                      | Dónde se ejecuta                                                      |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Supervisar la operación de la sucursal (ventas, cobros, pagos) | Panel con KPIs, gráfico y actividad reciente                          |
| 2   | Mantener el maestro de terceros                                | Clientes y Proveedores: alta, edición, estado de cuenta               |
| 3   | Vender: pedido → confirmar → facturar                          | Pedidos (`create/edit/confirm/cancel/invoice`) y Facturación          |
| 4   | Emitir la factura de la venta                                  | Borrador → emisión (`post`) con tasa congelada e IGTF                 |
| 5   | Comprar y pagar                                                | Compras (origen de CxP), Cuentas por pagar, pagos y anulación de pago |
| 6   | Ajustar la cartera                                             | Notas de crédito (crear, emitir, aplicar, anular) y préstamos         |
| 7   | Administrar el catálogo y responder por el stock               | Productos, stock por almacén y **kardex de movimientos**              |
| 8   | Aprobar el ajuste que registra el almacén                      | Movimientos de inventario: aprobar / rechazar                         |
| 9   | Operar la tesorería                                            | Cuentas bancarias, conciliación, caja chica y cierre diario           |
| 10  | Leer la contabilidad                                           | Cuentas, asientos y períodos (sin contabilizar ni cerrar)             |
| 11  | Leer el personal                                               | Empleados, cargos y departamentos (sin nómina)                        |
| 12  | Leer los maestros                                              | Sucursales, bancos, métodos de pago, impuestos, monedas y tasas       |
| 13  | Reportar                                                       | Reportes en moneda funcional con columna USD                          |

**Lo que el cargo no hace** (y por eso está prohibido en el rol):

| Fuera del cargo                                    | Permiso que lo habilita                                                          | Quién lo tiene     |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------ |
| Administrar usuarios, roles y audit.               | `settings:users:*`, `settings:roles:*`                                           | ADMIN              |
| Fijar o sobreescribir tasas                        | `settings:currencies:manage`                                                     | ADMIN              |
| Modificar empresas, sucursales, bancos e impuestos | `settings:*:manage`                                                              | ADMIN              |
| Anular una factura emitida                         | `finance:invoices:void`                                                          | ADMIN              |
| Contabilizar asientos y cerrar períodos            | `finance:entries:create/post`, `finance:accounts:manage`, `finance:close:manage` | ACCOUNTANT + ADMIN |
| Producir libros y retenciones fiscales             | `finance:retentions:view`                                                        | ACCOUNTANT + ADMIN |
| Procesar nómina y novedades                        | `hr:payroll:*`, `hr:incidents:*`                                                 | ADMIN              |
| Operar en modo consolidado                         | `core:branch:all`                                                                | SUPER_ADMIN        |

## 3. Auditoría de la cuenta `test-manager@test.local`

| Aspecto       | Esperado                             | Real (2026-10-31)                              | Veredicto      |
| ------------- | ------------------------------------ | ---------------------------------------------- | -------------- |
| Rol           | MANAGER, uno solo                    | `MANAGER` (fila única en `users_roles`)        | ✅             |
| Sucursales    | Las dos del fixture, una por defecto | `Test Branch` (defecto) + `Sucursal Maracaibo` | ✅             |
| Permisos      | Igual al seed                        | 42 = 42 antes del cambio, 48 = 48 ahora        | ✅             |
| Alcance       | Sucursal activa por `x-branch-id`    | 109/208 rutas del backend                      | ✅             |
| Documentación | Un solo relato                       | Tres relatos distintos                         | ❌ → este spec |

La cuenta está bien **asignada**; lo que estaba mal era el **cargo** (faltaban actuaciones del
gerente, sobraba un permiso mal nombrado) y la **documentación**.

## 4. Hallazgos y correcciones

| ID  | Hallazgo                                                                                                                                                             | Corrección                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| M-1 | `inventory:moves:view` faltaba: el ítem “Movimientos” estaba invisible y `GET /inventory/moves` devolvía `403`. El gerente responde por el stock que vende.          | Permiso al MANAGER (kardex legible).                                                                        |
| M-2 | `inventory:moves:approve` faltaba: quien registraba el ajuste (WAREHOUSE) era también quien lo aprobaba.                                                             | Permiso al MANAGER como aprobador. WAREHOUSE se deja igual; la segregación completa queda como `D-09`.      |
| M-3 | `finance:invoices:edit` faltaba: el gerente creaba el borrador desde el pedido y no podía corregirlo (`PATCH /billing/invoices/:id` → `403`), ni anularlo.           | Permiso al MANAGER. La API sólo permite editar `DRAFT` (regla ya existente en `billing.service`).           |
| M-4 | `finance:treasury:create_account` era el gate de conciliación, caja chica y cierre diario: un mismo permiso habilitaba cuatro funciones distintas.                   | Permisos propios `finance:treasury:reconcile`, `:petty-cash` y `:daily-close` (`T-09-21`, regla 6 de S-09). |
| M-5 | `database-spec.md` §4.2 y `qa/01-manager.md` describían un gerente que ya no existe (18 permisos, “no emite facturas”, menú incompleto).                             | Ambos documentos alineados al seed; este spec pasa a ser la fuente del cargo.                               |
| M-6 | `qa/01-manager.md` MG-04 esperaba que “Estado de cuenta” no apareciera, pero `D-06` ya otorgó `operations:partners:statement`.                                       | Caso corregido: el menú muestra **Estado de cuenta** y bloquea la navegación sólo sin el permiso.           |
| M-7 | Al aprobar un movimiento, `inventory_moves.approved_by` quedaba en `NULL`: no se sabía quién aprobó (el servicio aceptaba el usuario y el controlador no lo pasaba). | El controlador pasa `@CurrentUser()`; verificado: `approved_by = test-manager@test.local`.                  |

### Decisiones tomadas (y las que se dejan abiertas)

| ID   | Decisión                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-08 | Conciliar, caja chica y cierre diario usan permisos propios; `create_account` queda para cuentas bancarias y métodos de pago. El cierre diario **no** reutiliza `finance:close:manage` (ese es el cierre contable).                                                                                                                                                                                                                                                        |
| D-09 | El almacén conserva `moves:approve` por compatibilidad con el flujo WH-06 ya ejecutado; el gerente se agrega como aprobador. **Cierre (2026-11-01):** la recomendación de retirarlo **no se aplica** — el WAREHOUSE es maestro del rol y sin aprobar no cierra su trabajo. La segregación se resuelve en el proceso (`S-25`): motivo obligatorio en el ajuste y segunda aprobación obligatoria cuando la diferencia supera la tolerancia, que es donde el permiso importa. |
| D-10 | Anular una factura emitida sigue siendo exclusivo de ADMIN: es un acto fiscal, y quien emite no debe poder borrar su propio error.                                                                                                                                                                                                                                                                                                                                         |
| D-11 | Nómina, novedades de personal y libros fiscales quedan fuera del rol: son datos sensibles/fiscales con responsable propio (ADMIN y ACCOUNTANT).                                                                                                                                                                                                                                                                                                                            |

## 5. Contrato HTTP afectado

| Endpoint                                                   | Antes                             | Ahora                                                |
| ---------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `GET /v1/inventory/moves`, `/moves/:id`                    | `inventory:moves:view`            | igual (MANAGER ahora lo tiene)                       |
| `POST /v1/inventory/moves/:id/approve\|reject`             | `inventory:moves:approve`         | igual (MANAGER ahora lo tiene) y guarda quién aprobó |
| `PATCH /v1/billing/invoices/:id`                           | `finance:invoices:edit`           | igual (MANAGER ahora lo tiene)                       |
| `POST /v1/treasury/reconciliation/import`                  | `finance:treasury:create_account` | `finance:treasury:reconcile`                         |
| `POST /v1/treasury/reconciliation/:id/match`               | `finance:treasury:create_account` | `finance:treasury:reconcile`                         |
| `POST /v1/treasury/reconciliation/:id/unmatch`             | `finance:treasury:create_account` | `finance:treasury:reconcile`                         |
| `POST /v1/treasury/petty-cash` (+ movimientos, cierre)     | `finance:treasury:create_account` | `finance:treasury:petty-cash`                        |
| `POST /v1/treasury/daily-close/:date/close\|reopen`        | `finance:treasury:create_account` | `finance:treasury:daily-close`                       |
| `POST /v1/treasury/bank-accounts`, `PATCH /:id`, `methods` | `finance:treasury:create_account` | sin cambio                                           |

Respuestas verificadas tras el cambio (sonda real, 2026-10-31):

```text
test-manager@test.local     400 400 400 400 404 400 400 400   (permiso OK, payload inválido)
test-accountant@test.local  400 400 400 400 404 400 400 400   (permiso OK, payload inválido)
test-warehouse@test.local   403 403 403 403 403 403 403 403
test-seller@test.local      403 403 403 403 403 403 403 403
```

## 6. Criterios de aceptación

```gherkin
Escenario: el gerente ve el kardex
  Dado una sesión MANAGER
  Cuando abro Inventario → Movimientos
  Entonces veo el listado de movimientos de la sucursal sin 403

Escenario: el gerente corrige el borrador que creó
  Dado un borrador de factura creado por el gerente
  Cuando guardo una corrección
  Entonces la factura cambia y el histórico registra "editada" con mi usuario y la hora

Escenario: conciliar no depende de crear cuentas
  Dado un usuario con finance:treasury:reconcile y sin create_account
  Cuando importa un extracto
  Entonces la importación se acepta (sin 403)

Escenario: el cierre diario no abre el cierre contable
  Dado un MANAGER con finance:treasury:daily-close
  Cuando intenta cerrar un período contable
  Entonces recibe 403 porque finance:close:manage no está en su cargo
```

## 7. Tareas (WBS §1.11)

| ID      | Tarea                                                                | Estado |
| ------- | -------------------------------------------------------------------- | ------ |
| T-14-01 | Dar de alta el cargo como documento único (`S-14`)                   | ✅     |
| T-14-02 | `inventory:moves:view` + `inventory:moves:approve` para MANAGER      | ✅     |
| T-14-03 | `finance:invoices:edit` para MANAGER                                 | ✅     |
| T-14-04 | Separar conciliación, caja chica y cierre diario de `create_account` | ✅     |
| T-14-05 | Prueba de contrato del cargo (`role-manager.test.ts`)                | ✅     |
| T-14-06 | Alinear `database-spec.md` §4.2/§4.5 y `qa/01-manager.md`            | ✅     |
| T-14-07 | Editar borradores de factura desde la ficha (UI de `T-09-11`)        | ⏳     |

## 8. Verificación

- `pnpm --filter database test:unit` → `role-manager.test.ts` (12 casos).
- Sonda real contra la API con los cuatro usuarios de prueba (matriz de 45 rutas + 8 escrituras de
  tesorería).
- `pnpm typecheck`, `pnpm lint`, `pnpm build` y las suites completas sin cambios de comportamiento
  fuera de los permisos anteriores.
