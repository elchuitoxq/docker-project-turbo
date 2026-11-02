-- S-12 · Histórico de procesos de los documentos comerciales
--
-- El detalle de un pedido o de una factura no decía quién hizo qué ni cuándo: se veía el estado actual,
-- pero no el camino recorrido. Esta tabla es append-only y guarda cada acción de negocio (creado,
-- confirmado, facturado, emitido, anulado…) con su autor. `parent_document_id` enlaza la factura con su
-- pedido de origen para que la línea de tiempo se lea completa desde cualquiera de los dos documentos.

CREATE TABLE IF NOT EXISTS "document_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"document_code" text,
	"parent_document_id" uuid,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"description" text,
	"metadata" jsonb,
	"user_id" uuid,
	"branch_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_events_document_idx" ON "document_events" USING btree ("document_type","document_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_events_parent_idx" ON "document_events" USING btree ("parent_document_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_events_branch_created_idx" ON "document_events" USING btree ("branch_id","created_at");
--> statement-breakpoint
-- Los documentos que ya existían no tienen histórico: se les siembra su paso de creación con la fecha y
-- el autor reales del documento para que la ficha no aparezca vacía. No se inventan pasos posteriores.
INSERT INTO "document_events" ("id","document_type","document_id","document_code","action","to_status","description","user_id","branch_id","created_at")
SELECT gen_random_uuid(), 'ORDER', o."id", o."code", 'ORDER_CREATED', 'DRAFT', 'Registro previo al histórico', o."user_id", o."branch_id", COALESCE(o."created_at", now())
FROM "orders" o
WHERE NOT EXISTS (SELECT 1 FROM "document_events" e WHERE e."document_type" = 'ORDER' AND e."document_id" = o."id");
--> statement-breakpoint
INSERT INTO "document_events" ("id","document_type","document_id","document_code","parent_document_id","action","to_status","description","user_id","branch_id","created_at")
SELECT gen_random_uuid(), 'INVOICE', i."id", i."code", i."order_id", 'INVOICE_CREATED', 'DRAFT', 'Registro previo al histórico', i."user_id", i."branch_id", COALESCE(i."created_at", now())
FROM "invoices" i
WHERE NOT EXISTS (SELECT 1 FROM "document_events" e WHERE e."document_type" = 'INVOICE' AND e."document_id" = i."id");
