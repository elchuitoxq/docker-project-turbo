ALTER TABLE "exchange_rates" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD COLUMN "reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_one_base_idx" ON "currencies" USING btree ("is_base") WHERE "currencies"."is_base" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_currency_date_unq" ON "exchange_rates" USING btree ("currency_id","date");--> statement-breakpoint
-- Moneda funcional del sistema: VES (decision D-01, S-08). Se limpia la base anterior
-- antes de marcar la nueva para no violar `currencies_one_base_idx`.
UPDATE "currencies" SET "is_base" = false WHERE "is_base" = true AND "code" <> 'VES';--> statement-breakpoint
UPDATE "currencies" SET "is_base" = true WHERE "code" = 'VES';