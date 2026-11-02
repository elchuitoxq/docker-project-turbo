-- 0027 · Imputación multimoneda de pagos (`S-18`)
--
-- Un cobro/pago pertenece a UNA cuenta y por tanto a UNA moneda; la factura puede estar en otra y su
-- saldo se rebaja en la SUYA. Hasta ahora la imputación sólo guardaba el importe del pago y su valor
-- en moneda funcional, así que el saldo se derivaba dividiendo por la tasa de la factura y la
-- diferencia cambiaria no se registraba en ningún lado.
--
--   invoice_amount            importe imputado en la moneda de la factura (lo que baja el saldo)
--   exchange_rate             tasa del pago usada para la imputación
--   exchange_difference_base  resultado cambiario en moneda funcional
--                             = amount_base − invoice_amount × tasa_factura

ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "invoice_amount" numeric(20, 2);
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(20, 10);
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "exchange_difference_base" numeric(20, 2)
  DEFAULT '0' NOT NULL;

-- Relleno de las imputaciones existentes: si pago y factura comparten moneda el importe baja el
-- saldo a la par; si no, se lleva a la moneda del documento con su tasa congelada.
UPDATE "payment_allocations" pa
   SET "invoice_amount" = CASE
         WHEN p."currency_id" = i."currency_id" THEN pa."amount"
         ELSE round(coalesce(pa."amount_base", 0) / nullif(i."exchange_rate", 0), 2)
       END,
       "exchange_rate" = p."exchange_rate"
  FROM "payments" p, "invoices" i
 WHERE p."id" = pa."payment_id"
   AND i."id" = pa."invoice_id"
   AND pa."invoice_amount" IS NULL;

UPDATE "payment_allocations"
   SET "invoice_amount" = "amount"
 WHERE "invoice_amount" IS NULL;

ALTER TABLE "payment_allocations" ALTER COLUMN "invoice_amount" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "payment_allocations_invoice_idx"
  ON "payment_allocations" ("invoice_id");
