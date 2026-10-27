ALTER TABLE "audit_logs" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_moves" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
CREATE INDEX "audit_logs_branch_created_idx" ON "audit_logs" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_moves_branch_date_idx" ON "inventory_moves" USING btree ("branch_id","date");--> statement-breakpoint
CREATE INDEX "loans_branch_idx" ON "loans" USING btree ("branch_id");
--> statement-breakpoint
-- Backfill: el movimiento hereda la sucursal del almacen de origen o del destino.
UPDATE "inventory_moves" AS m
SET "branch_id" = COALESCE(
  (SELECT w."branch_id" FROM "warehouses" AS w WHERE w."id" = m."from_warehouse_id"),
  (SELECT w."branch_id" FROM "warehouses" AS w WHERE w."id" = m."to_warehouse_id")
)
WHERE m."branch_id" IS NULL;