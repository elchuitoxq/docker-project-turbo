-- E6 · Reportes fiscales (T-06-01, T-06-05)

CREATE TABLE "fiscal_sequences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_sequences_branch_doc_year_unq" ON "fiscal_sequences" USING btree ("branch_id","document_type","year");--> statement-breakpoint

CREATE TABLE "fiscal_exports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"format" text NOT NULL,
	"period_from" timestamp,
	"period_to" timestamp,
	"sequence_number" integer,
	"hash" text NOT NULL,
	"size_bytes" integer,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "fiscal_exports_branch_created_idx" ON "fiscal_exports" USING btree ("branch_id","created_at");--> statement-breakpoint

-- Los libros y el resumen fiscal se consultan por sucursal y fecha (T-06-02).
CREATE INDEX "invoices_branch_date_idx" ON "invoices" USING btree ("branch_id","date");--> statement-breakpoint
CREATE INDEX "tax_retentions_branch_date_idx" ON "tax_retentions" USING btree ("branch_id","date");
