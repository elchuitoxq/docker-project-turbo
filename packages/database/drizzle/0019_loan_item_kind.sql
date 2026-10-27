-- E7 · Préstamos: distinguir lo entregado de lo devuelto (T-07-03, H-99)
--
-- `loan_items` mezclaba la entrega y la devolución en la misma tabla, así que el préstamo no podía
-- cerrarse nunca: `pay` sólo añadía líneas y el estado se quedaba en ACTIVE para siempre.

ALTER TABLE "loan_items" ADD COLUMN "kind" text DEFAULT 'DELIVERED' NOT NULL;--> statement-breakpoint
UPDATE "loan_items" SET "kind" = 'DELIVERED' WHERE "kind" IS NULL;--> statement-breakpoint
CREATE INDEX "loan_items_loan_kind_idx" ON "loan_items" USING btree ("loan_id","kind");
