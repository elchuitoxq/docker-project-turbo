-- E3 · Compras y cuentas por pagar (T-03-01 … T-03-07)

-- 1. Factura de proveedor y saldo.
ALTER TABLE "invoices" ADD COLUMN "supplier_invoice_number" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "supplier_invoice_date" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_amount" numeric(20,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
UPDATE "invoices" i SET "paid_amount" = COALESCE((
  SELECT SUM(a."amount_base") FROM "payment_allocations" a WHERE a."invoice_id" = i."id"
), 0);--> statement-breakpoint
CREATE INDEX "invoices_payables_idx" ON "invoices" USING btree ("branch_id","type","status","due_date");--> statement-breakpoint

-- 2. Días de crédito del partner.
ALTER TABLE "partners" ADD COLUMN "credit_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- 3. Pago: dirección y retención descontada.
ALTER TABLE "payments" ADD COLUMN "direction" text;--> statement-breakpoint
UPDATE "payments" SET "direction" = CASE WHEN "type" = 'EXPENSE' THEN 'OUT' ELSE 'IN' END;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "direction" SET DEFAULT 'IN';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "direction" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "retention_amount" numeric(20,2) DEFAULT '0' NOT NULL;--> statement-breakpoint

-- 4. Nota de crédito: venta o compra.
ALTER TABLE "credit_notes" ADD COLUMN "type" text DEFAULT 'SALE' NOT NULL;--> statement-breakpoint

-- 5. Retención: vínculo a la factura y número de comprobante.
ALTER TABLE "tax_retentions" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "tax_retentions" ADD COLUMN "voucher_number" text;--> statement-breakpoint
CREATE INDEX "tax_retentions_branch_partner_idx" ON "tax_retentions" USING btree ("branch_id","partner_id","date");--> statement-breakpoint

-- 6. Parámetros de retención por empresa.
CREATE TABLE "supplier_retention_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"iva_retention_rate" numeric(5,2) DEFAULT '75' NOT NULL,
	"iva_retention_rate_special" numeric(5,2) DEFAULT '100' NOT NULL,
	"islr_rate" numeric(5,2) DEFAULT '0' NOT NULL,
	"islr_sustraendo" numeric(20,2) DEFAULT '0' NOT NULL,
	"islr_threshold" numeric(20,2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "supplier_retention_settings" ADD CONSTRAINT "supplier_retention_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_retention_settings_company_unq" ON "supplier_retention_settings" USING btree ("company_id");
