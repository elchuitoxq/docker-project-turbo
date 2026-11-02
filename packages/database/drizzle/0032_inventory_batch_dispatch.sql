-- `S-26`: control de vencimiento y prioridad FEFO en las salidas.
--
-- El motor de inventario ya ordena los lotes por vencimiento, pero nada impedía despachar un lote
-- vencido ni saltarse el sugerido. El despacho fuera de FEFO queda permitido **con motivo**, porque en
-- la práctica hay causas válidas (pedido de un cliente que exige un lote concreto, lote reservado
-- físicamente, etc.); lo que no puede quedar es sin rastro.

ALTER TABLE "inventory_moves" ADD COLUMN IF NOT EXISTS "fefo_override" boolean DEFAULT false;
ALTER TABLE "inventory_moves" ADD COLUMN IF NOT EXISTS "fefo_override_reason" text;
