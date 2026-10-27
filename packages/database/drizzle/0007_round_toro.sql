ALTER TABLE "payments" ADD COLUMN "amount_base" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_retentions" ADD COLUMN "currency_id" uuid;--> statement-breakpoint
ALTER TABLE "tax_retentions" ADD COLUMN "exchange_rate" numeric(20, 10);--> statement-breakpoint
ALTER TABLE "tax_retentions" ADD COLUMN "total_retained_base" numeric(20, 2);--> statement-breakpoint
-- Backfill: el monto en moneda funcional es amount x tasa del documento (M2 de S-08).
UPDATE "payments" SET "amount_base" = ROUND("amount" * "exchange_rate", 2) WHERE "amount_base" = 0;
