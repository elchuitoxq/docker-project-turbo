CREATE TABLE "payroll_period_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"value" numeric(20, 4) NOT NULL,
	"type" text NOT NULL,
	"branch_id" uuid,
	"effective_from" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "payroll_concept_types" DROP CONSTRAINT IF EXISTS "payroll_concept_types_code_unique";--> statement-breakpoint
ALTER TABLE "payroll_settings" DROP CONSTRAINT IF EXISTS "payroll_settings_key_unique";--> statement-breakpoint
ALTER TABLE "payroll_concept_types" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "payroll_concept_types" ADD COLUMN "kind" text DEFAULT 'FIXED' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_concept_types" ADD COLUMN "expression" text;--> statement-breakpoint
ALTER TABLE "payroll_concept_types" ADD COLUMN "affects_integral_salary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_concept_types" ADD COLUMN "is_salarial" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "effective_from" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "payroll_settings" ps SET "company_id" = b."company_id" FROM "branches" b WHERE ps."branch_id" = b."id" AND ps."company_id" IS NULL;--> statement-breakpoint
UPDATE "payroll_concept_types" pct SET "company_id" = b."company_id" FROM "branches" b WHERE pct."branch_id" = b."id" AND pct."company_id" IS NULL;--> statement-breakpoint
UPDATE "payroll_settings" SET "company_id" = (SELECT "id" FROM "companies" ORDER BY "created_at" NULLS LAST LIMIT 1) WHERE "company_id" IS NULL;--> statement-breakpoint
UPDATE "payroll_concept_types" SET "company_id" = (SELECT "id" FROM "companies" ORDER BY "created_at" NULLS LAST LIMIT 1) WHERE "company_id" IS NULL;--> statement-breakpoint
DELETE FROM "payroll_settings" WHERE "company_id" IS NULL;--> statement-breakpoint
DELETE FROM "payroll_concept_types" WHERE "company_id" IS NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_concept_types" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
UPDATE "payroll_item_lines" SET "category" = 'ASSIGNMENT' WHERE "category" = 'INCOME';--> statement-breakpoint
ALTER TABLE "payroll_period_settings" ADD CONSTRAINT "payroll_period_settings_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_period_settings_run_key_unq" ON "payroll_period_settings" USING btree ("run_id","key");--> statement-breakpoint
ALTER TABLE "payroll_concept_types" ADD CONSTRAINT "payroll_concept_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_concept_types_company_code_unq" ON "payroll_concept_types" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_settings_company_unq" ON "payroll_settings" USING btree ("company_id","key","effective_from") WHERE "payroll_settings"."branch_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_settings_branch_unq" ON "payroll_settings" USING btree ("company_id","branch_id","key","effective_from") WHERE "payroll_settings"."branch_id" is not null;--> statement-breakpoint
CREATE INDEX "payroll_settings_lookup_idx" ON "payroll_settings" USING btree ("company_id","key","effective_from");