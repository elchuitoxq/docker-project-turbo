ALTER TABLE "accounting_entries" ADD COLUMN "base_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN "exchange_rate" numeric(20, 10) DEFAULT '1';--> statement-breakpoint
ALTER TABLE "accounting_entry_lines" ADD COLUMN "original_amount" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "accounting_entry_lines" ADD COLUMN "original_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "amount_base" numeric(20, 2) DEFAULT '0';--> statement-breakpoint
-- Backfill: la moneda funcional de los asientos historicos es la base del sistema.
UPDATE "accounting_entries"
SET "base_currency_id" = (SELECT "id" FROM "currencies" WHERE "is_base" = true LIMIT 1)
WHERE "base_currency_id" IS NULL;--> statement-breakpoint
-- Backfill de asignaciones: monto aplicado en moneda funcional segun la tasa del pago.
UPDATE "payment_allocations" AS pa
SET "amount_base" = ROUND(pa."amount" * p."exchange_rate", 2)
FROM "payments" AS p
WHERE pa."payment_id" = p."id" AND pa."amount_base" = 0;