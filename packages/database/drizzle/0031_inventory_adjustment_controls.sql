-- `S-25`: controles del ajuste de inventario (motivo y segunda aprobación) y lotes por producto.
--
-- El almacén conserva `inventory:moves:approve` porque es el maestro de ese rol. El control no se
-- resuelve quitando el permiso, sino como en SAP: motivo obligatorio del ajuste y escalamiento cuando
-- la diferencia supera la tolerancia (ahí sí debe aprobar otra persona).

ALTER TABLE "inventory_moves" ADD COLUMN IF NOT EXISTS "reason_code" text;
ALTER TABLE "inventory_moves" ADD COLUMN IF NOT EXISTS "requires_second_approval" boolean DEFAULT false;

-- El número de lote es único por producto: la recepción lo crea si no existe y no puede duplicarlo.
CREATE UNIQUE INDEX IF NOT EXISTS "product_batches_product_number_unq"
  ON "product_batches" ("product_id", "batch_number");
