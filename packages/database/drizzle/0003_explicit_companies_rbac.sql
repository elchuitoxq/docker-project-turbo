CREATE TABLE "companies" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "tax_id" text,
  "address" text,
  "phone" text,
  "email" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "companies_tax_id_unq" ON "companies" USING btree ("tax_id");
--> statement-breakpoint
INSERT INTO "companies" ("id", "name", "tax_id")
SELECT md5('company:' || "tax_id")::uuid, min("name"), "tax_id"
FROM "branches"
WHERE "tax_id" IS NOT NULL
GROUP BY "tax_id";
--> statement-breakpoint
INSERT INTO "companies" ("id", "name", "address", "phone", "email", "is_active")
SELECT md5('branch-company:' || "id"::text)::uuid, "name", "address", "phone", "email", COALESCE("is_active", true)
FROM "branches"
WHERE "tax_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "company_id" uuid;
--> statement-breakpoint
UPDATE "branches" AS b
SET "company_id" = CASE
  WHEN b."tax_id" IS NOT NULL THEN md5('company:' || b."tax_id")::uuid
  ELSE md5('branch-company:' || b."id"::text)::uuid
END;
--> statement-breakpoint
ALTER TABLE "branches" ALTER COLUMN "company_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_companies_id_fk"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "branches" DROP COLUMN "tax_id";
--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "roles" SET "is_system" = true
WHERE "name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER', 'WAREHOUSE', 'ACCOUNTANT');
--> statement-breakpoint
ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_role_id_roles_id_fk"
FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "users_branches" ALTER COLUMN "is_default" SET DEFAULT false;
--> statement-breakpoint
UPDATE "users_branches" AS ub
SET "is_default" = ranked.is_default
FROM (
  SELECT "user_id", "branch_id",
    row_number() OVER (PARTITION BY "user_id" ORDER BY "is_default" DESC NULLS LAST, "branch_id") = 1 AS is_default
  FROM "users_branches"
) AS ranked
WHERE ub."user_id" = ranked."user_id" AND ub."branch_id" = ranked."branch_id";
--> statement-breakpoint
ALTER TABLE "users_branches" ALTER COLUMN "is_default" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "users_branches_one_default_per_user"
ON "users_branches" USING btree ("user_id") WHERE "is_default" = true;
--> statement-breakpoint
ALTER TABLE "users_branches" ADD CONSTRAINT "users_branches_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "users_branches" ADD CONSTRAINT "users_branches_branch_id_branches_id_fk"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_role_id_roles_id_fk"
FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_permission_id_permissions_id_fk"
FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
