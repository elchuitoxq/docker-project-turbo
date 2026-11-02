-- 0036 · Auditoría legible y buscable
--
-- El visor sólo podía decir "el usuario 3f1c2b7e hizo UPDATE": el autor se resolvía por FK (y se
-- perdía al borrar el usuario), la descripción era la ruta HTTP y el `before` del diff nunca existía.
-- Aquí se guarda la foto del autor del hecho, el módulo, el nombre legible de la entidad y la acción,
-- el resultado y el tiempo de la operación.
--
-- `entity_id` pasa a nullable: los eventos de seguridad (inicio de sesión, acceso denegado) no
-- tienen una fila de negocio detrás.

ALTER TABLE "audit_logs" ALTER COLUMN "entity_id" DROP NOT NULL;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_name" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_email" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_roles" text[];
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "module" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entity_label" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "action_label" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "http_method" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "route" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "result" text DEFAULT 'SUCCESS';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "duration_ms" integer;--> statement-breakpoint

-- Relleno del autor en las filas históricas: hasta hoy el nombre sólo existía en `users`.
UPDATE "audit_logs" a
   SET "actor_name" = u."name",
       "actor_email" = u."email"
  FROM "users" u
 WHERE u."id" = a."user_id"
   AND a."actor_name" IS NULL;--> statement-breakpoint

-- Módulo histórico derivado de la tabla auditada, para que el filtro del visor no arranque vacío.
UPDATE "audit_logs"
   SET "module" = CASE "entity_table"
     WHEN 'invoices' THEN 'billing'
     WHEN 'credit_notes' THEN 'billing'
     WHEN 'tax_retentions' THEN 'billing'
     WHEN 'payments' THEN 'treasury'
     WHEN 'bank_accounts' THEN 'treasury'
     WHEN 'inventory_moves' THEN 'inventory'
     WHEN 'warehouses' THEN 'inventory'
     WHEN 'products' THEN 'inventory'
     WHEN 'orders' THEN 'operations'
     WHEN 'partners' THEN 'operations'
     WHEN 'loans' THEN 'operations'
     WHEN 'payroll_runs' THEN 'hr'
     WHEN 'employees' THEN 'hr'
     WHEN 'accounting_entries' THEN 'accounting'
     ELSE "entity_table"
   END
 WHERE "module" IS NULL;--> statement-breakpoint

UPDATE "audit_logs" SET "result" = 'SUCCESS' WHERE "result" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_module_created_idx"
  ON "audit_logs" USING btree ("module","created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_document_created_idx"
  ON "audit_logs" USING btree ("document_code","created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_actor_created_idx"
  ON "audit_logs" USING btree ("actor_name","created_at");
