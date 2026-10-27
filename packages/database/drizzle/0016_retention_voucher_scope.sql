-- E3 · H-80: el codigo del comprobante de retencion no puede ser unico global.
--
-- El correlativo de retencion (`RET-aaaa-nnnnnn`) se reserva por sucursal, documento y año; dos
-- sucursales emiten el mismo numero en el mismo ejercicio. La unicidad global de `code` hacia que
-- la segunda sucursal fallara con `duplicate key value violates unique constraint`.

ALTER TABLE "tax_retentions" DROP CONSTRAINT IF EXISTS "tax_retentions_code_unique";--> statement-breakpoint

-- La identidad fiscal real del comprobante es la terna sucursal + tipo + numero.
CREATE UNIQUE INDEX IF NOT EXISTS "tax_retentions_branch_type_voucher_unq"
  ON "tax_retentions" USING btree ("branch_id","type","voucher_number")
  WHERE "voucher_number" IS NOT NULL;
