-- E4 · Contabilidad (T-04-01 … T-04-04)

-- 1. Plan de cuentas: imputabilidad explícita y vocabulario único de tipos (H-73).
ALTER TABLE "accounting_accounts" ADD COLUMN "is_postable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "accounting_accounts" SET "is_postable" = false
WHERE "id" IN (SELECT "parent_id" FROM "accounting_accounts" WHERE "parent_id" IS NOT NULL);--> statement-breakpoint
UPDATE "accounting_accounts" SET "type" = CASE upper("type")
  WHEN 'ACTIVO' THEN 'ASSET'
  WHEN 'ASSET' THEN 'ASSET'
  WHEN 'PASIVO' THEN 'LIABILITY'
  WHEN 'LIABILITY' THEN 'LIABILITY'
  WHEN 'PATRIMONIO' THEN 'EQUITY'
  WHEN 'EQUITY' THEN 'EQUITY'
  WHEN 'INGRESO' THEN 'REVENUE'
  WHEN 'REVENUE' THEN 'REVENUE'
  WHEN 'INCOME' THEN 'REVENUE'
  WHEN 'EGRESO' THEN 'EXPENSE'
  WHEN 'EXPENSE' THEN 'EXPENSE'
  WHEN 'COSTO' THEN 'COST'
  WHEN 'COST' THEN 'COST'
  WHEN 'ORDEN' THEN 'ORDER'
  WHEN 'ORDER' THEN 'ORDER'
  ELSE upper("type")
END;--> statement-breakpoint

-- 2. Asientos: origen, posteo e idempotencia por documento.
ALTER TABLE "accounting_entries" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN "posted_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD COLUMN "posted_by" uuid;--> statement-breakpoint
UPDATE "accounting_entries" SET "posted_at" = COALESCE("created_at", "date") WHERE "status" = 'POSTED';--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_entries_source_unq" ON "accounting_entries" USING btree ("source_type","source_id") WHERE "accounting_entries"."source_type" is not null and "accounting_entries"."source_id" is not null;--> statement-breakpoint
CREATE INDEX "accounting_entries_branch_date_idx" ON "accounting_entries" USING btree ("branch_id","date");--> statement-breakpoint
CREATE INDEX "accounting_entry_lines_account_idx" ON "accounting_entry_lines" USING btree ("account_id");--> statement-breakpoint

-- 3. Cierre de período.
CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"closed_at" timestamp,
	"closed_by" uuid,
	"reopened_at" timestamp,
	"reopened_by" uuid,
	"reopen_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_company_year_month_unq" ON "accounting_periods" USING btree ("company_id","year","month");
