-- E7 · Auditoría consultable (T-07-01)
--
-- El visor filtra por entidad, documento, usuario y rango de fechas, y pagina. Sin estos índices la
-- consulta recorre toda la tabla, que sólo crece.

CREATE INDEX IF NOT EXISTS "audit_logs_entity_created_idx"
  ON "audit_logs" USING btree ("entity_table","entity_id","created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_user_created_idx"
  ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_created_idx"
  ON "audit_logs" USING btree ("created_at");
