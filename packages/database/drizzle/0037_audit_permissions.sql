-- 0037 · Permisos propios de la bitácora de auditoría
--
-- `GET /v1/audit` se protegía con `settings:users:view`: administrar usuarios abría la bitácora y
-- consultar la bitácora exigía un permiso de usuarios. Ahora la lectura y la exportación tienen su
-- propio permiso, y sólo ADMIN/SUPER_ADMIN pueden exportar.

INSERT INTO "permissions" ("id", "code", "description", "module") VALUES
  (gen_random_uuid(), 'settings:audit:view', 'Permission for settings:audit:view', 'settings'),
  (gen_random_uuid(), 'settings:audit:export', 'Permission for settings:audit:export', 'settings')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint

INSERT INTO "roles_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
  JOIN "permissions" p ON p."code" IN ('settings:audit:view', 'settings:audit:export')
 WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "roles_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "roles" r
  JOIN "permissions" p ON p."code" = 'settings:audit:view'
 WHERE r."name" = 'MANAGER'
ON CONFLICT DO NOTHING;
