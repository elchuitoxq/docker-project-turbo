ALTER TABLE "partners" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_branch_status_type_created_idx" ON "invoices" USING btree ("branch_id","status","type","created_at");--> statement-breakpoint
UPDATE "partners" SET "is_active" = true WHERE "is_active" IS NULL;