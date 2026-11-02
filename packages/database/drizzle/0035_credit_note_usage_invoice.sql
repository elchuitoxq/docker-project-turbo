-- 0035 · Aplicación real de notas de crédito (`T-03-07`)
--
-- `credit_note_usages.payment_id` era obligatorio y `apply()` inventaba un pago para poder
-- registrarlo. Ese pago llevaba `method_id = currency_id`: con las FK de `0026` la aplicación de una
-- nota de crédito fallaba con `violates foreign key constraint payments_method_id_fkey`. Además el
-- uso no guardaba la factura, así que “aplicar” no dejaba rastro de qué saldo había bajado.
--
--   payment_id  pasa a nullable: aplicar un crédito no es un cobro.
--   invoice_id  factura contra la que se aplicó el crédito.
--
-- El relleno toma la factura del pago para las filas históricas que sí tenían pago.

ALTER TABLE "credit_note_usages" ALTER COLUMN "payment_id" DROP NOT NULL;

ALTER TABLE "credit_note_usages"
  ADD COLUMN IF NOT EXISTS "invoice_id" uuid REFERENCES "invoices" ("id") ON DELETE CASCADE;

UPDATE "credit_note_usages" u
   SET "invoice_id" = p."invoice_id"
  FROM "payments" p
 WHERE p."id" = u."payment_id"
   AND u."invoice_id" IS NULL;

CREATE INDEX IF NOT EXISTS "credit_note_usages_credit_note_idx"
  ON "credit_note_usages" ("credit_note_id");

CREATE INDEX IF NOT EXISTS "credit_note_usages_invoice_idx"
  ON "credit_note_usages" ("invoice_id");
