-- E5 · Tesorería y cobranzas (T-05-01 … T-05-07)

-- 1. Métodos de pago: banderas operativas y desactivación.
ALTER TABLE "payment_methods" ADD COLUMN "applies_igtf" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "requires_reference" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "is_cash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
UPDATE "payment_methods" SET "is_cash" = true WHERE "code" LIKE '%CASH%';--> statement-breakpoint
UPDATE "payment_methods" SET "requires_reference" = true WHERE "code" IN ('TRANSFER', 'ZELLE', 'PAGO_MOVIL', 'POS');--> statement-breakpoint

-- 2. Cuentas bancarias por sucursal con saldo inicial.
ALTER TABLE "bank_accounts" ADD COLUMN "bank_id" uuid;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "initial_balance" numeric(20,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "notes" text;--> statement-breakpoint
CREATE INDEX "bank_accounts_branch_idx" ON "bank_accounts" USING btree ("branch_id","is_active");--> statement-breakpoint

-- 3. Cierre diario por sucursal y fecha (snapshot inmutable en `totals`).
CREATE TABLE "daily_closes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"totals" jsonb,
	"notes" text,
	"closed_by" uuid,
	"closed_at" timestamp,
	"reopened_by" uuid,
	"reopened_at" timestamp,
	"reopen_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "daily_closes" ADD CONSTRAINT "daily_closes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_closes_branch_date_unq" ON "daily_closes" USING btree ("branch_id","date");--> statement-breakpoint

-- 4. Conciliación bancaria: importaciones idempotentes por hash y líneas del extracto.
CREATE TABLE "bank_statement_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"file_hash" text NOT NULL,
	"file_name" text,
	"lines_count" integer DEFAULT 0 NOT NULL,
	"imported_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bank_statement_imports_hash_unq" ON "bank_statement_imports" USING btree ("bank_account_id","file_hash");--> statement-breakpoint

CREATE TABLE "bank_statement_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"import_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(20,2) NOT NULL,
	"direction" text DEFAULT 'IN' NOT NULL,
	"reference" text,
	"description" text,
	"matched_payment_id" uuid,
	"matched_at" timestamp,
	"matched_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_statement_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_statement_lines_account_date_idx" ON "bank_statement_lines" USING btree ("bank_account_id","date");--> statement-breakpoint
-- Una línea se concilia con un pago y un pago con una sola línea (H-92).
CREATE UNIQUE INDEX "bank_statement_lines_payment_unq" ON "bank_statement_lines" USING btree ("matched_payment_id") WHERE "matched_payment_id" IS NOT NULL;--> statement-breakpoint

-- 5. Caja chica: fondo fijo con rendiciones y reposiciones.
CREATE TABLE "petty_cash_funds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"currency_id" uuid NOT NULL,
	"amount" numeric(20,2) NOT NULL,
	"balance" numeric(20,2) DEFAULT '0' NOT NULL,
	"responsible_user_id" uuid,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "petty_cash_funds" ADD CONSTRAINT "petty_cash_funds_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "petty_cash_funds_branch_idx" ON "petty_cash_funds" USING btree ("branch_id","status");--> statement-breakpoint

CREATE TABLE "petty_cash_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fund_id" uuid NOT NULL,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(20,2) NOT NULL,
	"description" text,
	"receipt_number" text,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "petty_cash_movements" ADD CONSTRAINT "petty_cash_movements_fund_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."petty_cash_funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "petty_cash_movements_fund_date_idx" ON "petty_cash_movements" USING btree ("fund_id","date");--> statement-breakpoint

-- 6. Conciliación desde el pago.
ALTER TABLE "payments" ADD COLUMN "bank_statement_line_id" uuid;
