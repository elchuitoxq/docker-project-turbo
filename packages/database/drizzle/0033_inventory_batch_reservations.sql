-- `S-26` (deuda): reserva de lote en las salidas.
--
-- Una salida en borrador aparta la cantidad prometida del lote. Así dos salidas simultáneas no
-- pueden prometer la misma existencia: la segunda ve la reserva activa de la primera y se rechaza al
-- crear (antes solo se descubría al aprobar). La reserva se libera al aprobar o rechazar el
-- documento; el stock físico sigue siendo la única fuente de verdad para el costo y el conteo.

CREATE TABLE IF NOT EXISTS "inventory_batch_reservations" (
  "id" uuid PRIMARY KEY NOT NULL,
  "move_id" uuid NOT NULL REFERENCES "inventory_moves"("id") ON DELETE CASCADE,
  "move_line_id" uuid REFERENCES "inventory_move_lines"("id") ON DELETE CASCADE,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "batch_id" uuid NOT NULL REFERENCES "product_batches"("id") ON DELETE RESTRICT,
  "quantity" numeric(20, 4) NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamp DEFAULT now(),
  "released_at" timestamp
);

CREATE INDEX IF NOT EXISTS "inventory_batch_reservations_active_idx"
  ON "inventory_batch_reservations" ("warehouse_id", "product_id", "batch_id", "status");

CREATE INDEX IF NOT EXISTS "inventory_batch_reservations_move_idx"
  ON "inventory_batch_reservations" ("move_id");
