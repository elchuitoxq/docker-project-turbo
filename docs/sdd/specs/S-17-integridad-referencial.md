# S-17 — Integridad referencial del núcleo (FK reales)

| Campo      | Valor                                                        |
| ---------- | ------------------------------------------------------------ |
| Estado     | Implementado                                                 |
| Prioridad  | P0                                                           |
| Alcance    | `packages/database` (esquema, migración, gate, prueba de BD) |
| Depende de | S-03, S-05, S-12, S-16                                       |
| Fecha      | 2026-10-31                                                   |

## 1. Contexto

`S-16` cerró el agujero de las semillas, pero dejó anotado el riesgo estructural: **las tablas de
documentos no tenían claves foráneas**. La base aceptaba cualquier `uuid` en `invoices.partner_id`,
`payments.method_id`, `invoice_items.product_id`, y el único control era el gate de semillas — que
detecta después, no impide antes. Al auditar la base de desarrollo aparecieron diez relaciones con
huérfanos reales.

Antes de esta spec solo existían **17 FK**, todas en tablas de unión (`users_roles`, `users_branches`,
`roles_permissions`) y en unos pocos maestros. Los módulos de operación, tesorería, contabilidad,
personal y auditoría estaban sin red.

## 2. Objetivo

1. Declarar **todas** las relaciones de referencia como FK en PostgreSQL, con semántica de borrado
   explícita.
2. Espejar esas relaciones en el esquema de Drizzle para que el modelo y la base no divergan.
3. Que las semillas sigan sembrando **desde cero** con las FK activas.
4. Que el gate detecte si alguien agrega una columna de referencia sin FK (o deshabilita una).

## 3. Criterio de borrado

| Acción     | Cuándo                                                      | Ejemplos                                                              |
| ---------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `restrict` | Maestros y documentos: un padre con hijos vivos no se borra | `invoices.partner_id`, `payments.method_id`, `stock.warehouse_id`     |
| `cascade`  | Líneas y dependientes puros: sin el padre no existen        | `invoice_items`, `payment_allocations`, `payroll_item_lines`          |
| `set null` | Vínculos opcionales: el hecho sobrevive, el enlace no       | `*.user_id`, `*.approved_by`, `stock.batch_id`, `payments.invoice_id` |

Se prefiere `restrict` sobre `cascade` en todo lo que representa un documento: borrar un partner no
puede borrar su historial de facturación.

## 4. Alcance de la migración (`0026_foreign_keys_core`)

**148 FK nuevas** (165 en total con las 17 previas), validadas al aplicarse:

| Bloque              | FK  | Ejemplos                                                               |
| ------------------- | --- | ---------------------------------------------------------------------- |
| Operaciones         | 16  | `orders`, `order_items`, `invoices`, `invoice_items`                   |
| Cobros y pagos      | 11  | `payments`, `payment_allocations`                                      |
| Notas y préstamos   | 12  | `credit_notes`, `credit_note_items`, `credit_note_usages`, `loans`     |
| Fiscal              | 9   | `tax_retentions`, `tax_retention_lines`, `partners.islr_concept_id`    |
| Inventario          | 15  | `products`, `product_batches`, `stock`, `inventory_moves(+lines)`      |
| Tesorería           | 16  | `bank_accounts`, `payment_methods`, `bank_statement_*`, `petty_cash_*` |
| Histórico/auditoría | 5   | `document_events`, `audit_logs`, `document_links`                      |
| Contabilidad        | 21  | `accounting_*`, `fiscal_sequences`, `fiscal_exports`                   |
| Personal            | 43  | `employees`, `employee_*`, `payroll_*`                                 |

Detalles de implementación:

- El bloque es **idempotente**: recorre una tabla de pares `(tabla, columna, destino, borrado)` y
  omite la columna si ya tiene una FK, así puede correrse sobre una base parcialmente migrada.
- Los **vínculos opcionales** (`set null`) que apuntaban a filas inexistentes se limpian antes de
  declarar la FK. Es un no-op semántico (el autor ya no existe) y permite migrar bases con residuos.
  Los huérfanos de relaciones **obligatorias** no se tocan: ahí la migración falla y hay que arreglar
  los datos — no se inventan padres.
- Los `*.user_id`, `*.approved_by`, `*.closed_by`, `*.posted_by`, `*.voided_by`, `*.matched_by`,
  `*.imported_by` y `created_by` también son FK a `users`: eran el punto ciego más grande.

Quedan **sin FK a propósito** las columnas polimórficas, porque apuntan a más de una tabla según un
discriminante: `document_events.document_id`/`parent_document_id`, `audit_logs.entity_id`,
`accounting_entries.source_id`, `document_links.source_id`/`target_id`. El gate las excluye
explícitamente y exige FK en **todas** las demás.

## 5. Esquema de Drizzle

`schema.ts` declara las mismas 148 relaciones con `.references(...)`, para que el modelo describa la
base y un futuro `drizzle-kit` no las vea como faltantes. Cinco columnas necesitan tipo explícito
(`AnyPgColumn`) por ser autorreferencias o ciclos:

- `accounting_accounts.parent_id`, `departments.parent_id`, `product_categories.parent_id` (self)
- `payments.bank_statement_line_id` ↔ `bank_statement_lines.matched_payment_id` (ciclo)

## 6. Efecto sobre las semillas y las pruebas

| Ajuste                                                                                         | Motivo                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ensureTestUser()` en `apps/backend/src/test/factories.ts`                                     | Los servicios registran autor: un uuid inventado ya no es válido. Se reutiliza por email porque los archivos corren en paralelo y cualquiera puede haber truncado. |
| `purchases-payables`, `treasury-operations` usan ese usuario                                   | Antes pasaban `faker.string.uuid()` como `userId`                                                                                                                  |
| `payroll-posting`, `payroll-void`, `payroll-settings` crean un empleado real                   | `payroll_items.employee_id` es FK                                                                                                                                  |
| `prepare-test-databases.ts` recrea la base de prueba si la migración no puede validar residuos | Las bases `testdb_*` son descartables; arrastrar huérfanos de corridas viejas deja el entorno roto                                                                 |

Además, con la base ya bajo FK, la semilla destapó dos incoherencias funcionales que estaban ocultas
por la caché `paid_amount`:

| ID   | Hallazgo                                                                                                                                | Corrección                                                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-31 | `COMP-000003` estaba `PAID` con saldo **−104** (pagaba el total además de las retenciones) y `INV-000001` tenía 780 imputados sobre 580 | Pagos reales a proveedor (`PAY-000004/5`), imputaciones corregibles (`onConflictDoUpdate`) y `recalculateInvoiceBalances()` que deriva `paid_amount` y el estado de las imputaciones. Nueva regla: ninguna factura con saldo negativo |

La semilla de desarrollo **no necesitó cambios**: ya insertaba en orden de dependencia y resolvía los
ids por código desde `S-16`.

## 7. Criterios de aceptación

1. `DROP SCHEMA public` + migrar + sembrar deja `Integridad OK: 48 reglas verificadas`.
2. Insertar un documento con un `partner_id` inexistente falla con `violates foreign key constraint`.
3. Borrar un pedido con factura falla (`RESTRICT`); borrar una factura borra sus líneas (`CASCADE`).
4. Todas las FK quedan `convalidated` (validadas contra los datos).
5. Ninguna columna de referencia queda sin FK salvo las seis polimórficas declaradas.

## 8. Verificación ejecutada

| Comprobación                                           | Resultado                               |
| ------------------------------------------------------ | --------------------------------------- |
| `db:reset` + `db-setup` (desde cero)                   | 27 migraciones · semilla OK · 48 reglas |
| Semilla dos veces seguidas                             | misma base, sin duplicados              |
| `select count(*) from pg_constraint where contype='f'` | 165 (148 nuevas + 17 previas)           |
| FK sin validar                                         | 0                                       |
| Inserción con padre inexistente                        | rechazada                               |
| Borrado de pedido con factura                          | rechazado (`RESTRICT`)                  |
| Borrado de factura con líneas                          | líneas eliminadas (`CASCADE`)           |
| `pnpm --filter database test`                          | 55 pruebas OK                           |
| `pnpm --filter backend test`                           | 1135 pruebas OK                         |
| `pnpm --filter frontend test`                          | 385 pruebas OK                          |
| `pnpm turbo run typecheck lint` / `pnpm build`         | 0 errores · 4/4                         |

## 9. Riesgos y trabajo futuro

- **Rendimiento**: cada FK crea un índice implícito en el lado hijo solo si existe; PostgreSQL _no_
  indexa automáticamente la columna hija. Las columnas más consultadas (`invoices.branch_id`,
  `invoices.partner_id`, `payments.branch_id`, `payments.invoice_id`) ya tenían índice por los listados;
  las de bajo tráfico (`*.created_by`, `*.matched_by`) se dejan sin índice a propósito.
- **`ON UPDATE`**: se mantiene `NO ACTION`; los ids son inmutables (`uuidv7`) y no se reescriben.
- Las columnas polimórficas podrían migrarse a tablas de unión (`document_links`) si se necesita
  integridad ahí; hoy son el precio de un modelo genérico de eventos.
- La migración falla a propósito si una relación obligatoria tiene huérfanos: en un entorno con datos
  reales habrá que limpiar antes. El gate de `S-16` lista exactamente qué filas sobran.
