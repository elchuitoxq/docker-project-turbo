CREATE TABLE "accounting_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"branch_id" uuid,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "accounting_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"description" text NOT NULL,
	"reference" text,
	"branch_id" uuid,
	"status" text DEFAULT 'POSTED',
	"created_at" timestamp DEFAULT now(),
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "accounting_entry_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" numeric(20, 2) DEFAULT '0',
	"credit" numeric(20, 2) DEFAULT '0',
	"description" text
);
--> statement-breakpoint
CREATE TABLE "accounting_maps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid,
	"module" text NOT NULL,
	"transaction_type" text,
	"category_id" uuid,
	"product_id" uuid,
	"payment_method_id" uuid,
	"debit_account_id" uuid,
	"credit_account_id" uuid,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_table" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb,
	"user_id" uuid,
	"ip_address" text,
	"user_agent" text,
	"document_code" text,
	"document_status" text,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"account_number" text,
	"type" text NOT NULL,
	"currency_id" uuid NOT NULL,
	"branch_id" uuid,
	"current_balance" numeric(20, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "banks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"tax_id" text,
	"phone" text,
	"email" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_note_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"price" numeric(20, 2) NOT NULL,
	"total" numeric(20, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_usages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"invoice_id" uuid,
	"partner_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"currency_id" uuid NOT NULL,
	"exchange_rate" numeric(20, 6) NOT NULL,
	"status" text DEFAULT 'DRAFT',
	"total_base" numeric(20, 2) DEFAULT '0',
	"total_tax" numeric(20, 2) DEFAULT '0',
	"total_igtf" numeric(20, 2) DEFAULT '0',
	"total" numeric(20, 2) DEFAULT '0',
	"date" timestamp DEFAULT now(),
	"user_id" uuid,
	"parent_payment_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "credit_notes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"is_base" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"branch_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"source_table" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_table" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "employee_bank_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"account_number" text NOT NULL,
	"account_type" text DEFAULT 'CHECKING',
	"currency_id" uuid,
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_benefits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"monthly_salary" numeric(20, 2) NOT NULL,
	"integral_salary" numeric(20, 2) NOT NULL,
	"days" integer DEFAULT 15,
	"amount" numeric(20, 2) NOT NULL,
	"accumulated_amount" numeric(20, 2) DEFAULT '0',
	"type" text DEFAULT 'REGULAR',
	"paid" boolean DEFAULT false,
	"payment_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_contracts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"trial_period_end" timestamp,
	"weekly_hours" numeric(10, 2) DEFAULT '40',
	"notes" text,
	"status" text DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_profit_sharing" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"days_to_pay" integer NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"payment_date" timestamp,
	"status" text DEFAULT 'PENDING',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_salary_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"previous_salary" numeric(20, 2) NOT NULL,
	"new_salary" numeric(20, 2) NOT NULL,
	"currency_id" uuid,
	"reason" text,
	"effective_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_vacations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"total_days" integer NOT NULL,
	"days_taken" integer DEFAULT 0,
	"days_pending" integer NOT NULL,
	"status" text DEFAULT 'PENDING',
	"start_date" timestamp,
	"end_date" timestamp,
	"return_date" timestamp,
	"payment_date" timestamp,
	"amount" numeric(20, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"identity_card" text NOT NULL,
	"email" text,
	"phone" text,
	"position_id" uuid,
	"department_id" uuid,
	"branch_id" uuid,
	"hire_date" timestamp DEFAULT now(),
	"termination_date" timestamp,
	"termination_reason" text,
	"salary_currency_id" uuid,
	"base_salary" numeric(20, 2) NOT NULL,
	"pay_frequency" text DEFAULT 'BIWEEKLY',
	"payment_method" text DEFAULT 'BANK_TRANSFER',
	"bank_id" uuid,
	"bank_name" text,
	"account_number" text,
	"account_type" text DEFAULT 'CHECKING',
	"status" text DEFAULT 'ACTIVE',
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "employees_identity_card_unique" UNIQUE("identity_card")
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"currency_id" uuid NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"date" timestamp DEFAULT now(),
	"source" text DEFAULT 'MANUAL'
);
--> statement-breakpoint
CREATE TABLE "inventory_move_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"move_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" numeric(20, 4) NOT NULL,
	"cost" numeric(20, 2)
);
--> statement-breakpoint
CREATE TABLE "inventory_moves" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'APPROVED' NOT NULL,
	"source" text DEFAULT 'SYSTEM' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"rejection_reason" text,
	"from_warehouse_id" uuid,
	"to_warehouse_id" uuid,
	"date" timestamp DEFAULT now(),
	"note" text,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invoice_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"price" numeric(20, 2) NOT NULL,
	"cost" numeric(20, 2),
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"total" numeric(20, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"exchange_rate" numeric(20, 10) NOT NULL,
	"type" text DEFAULT 'SALE',
	"invoice_number" text,
	"user_id" uuid,
	"order_id" uuid,
	"status" text DEFAULT 'DRAFT',
	"fiscal_status" text DEFAULT 'PENDING',
	"total_base" numeric(20, 2) DEFAULT '0',
	"total_tax" numeric(20, 2) DEFAULT '0',
	"total_igtf" numeric(20, 2) DEFAULT '0',
	"total" numeric(20, 2) DEFAULT '0',
	"date" timestamp DEFAULT now(),
	"due_date" timestamp,
	"warehouse_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "job_positions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"currency_id" uuid,
	"base_salary_min" numeric(20, 2) DEFAULT '0',
	"base_salary_max" numeric(20, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "job_positions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "loan_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"serial_number" text,
	"condition" text DEFAULT 'GOOD'
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE',
	"start_date" timestamp DEFAULT now(),
	"due_date" timestamp,
	"return_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "loans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" numeric(20, 4) NOT NULL,
	"price" numeric(20, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"type" text DEFAULT 'SALE',
	"status" text DEFAULT 'PENDING',
	"total" numeric(20, 2) DEFAULT '0',
	"exchange_rate" numeric(20, 10) DEFAULT '1',
	"currency_id" uuid,
	"date" timestamp DEFAULT now(),
	"user_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "orders_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "organization_modules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module_key" text NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"branch_id" uuid
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"tax_id" text NOT NULL,
	"address" text,
	"phone" text,
	"type" text DEFAULT 'CUSTOMER',
	"taxpayer_type" text DEFAULT 'ORDINARY',
	"retention_rate" numeric(3, 0) DEFAULT '0',
	"is_special_taxpayer" boolean DEFAULT false,
	"credit_limit" numeric(20, 2) DEFAULT '0',
	"islr_concept_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "partners_tax_id_unique" UNIQUE("tax_id")
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_method_accounts" (
	"method_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	CONSTRAINT "payment_method_accounts_method_id_bank_account_id_pk" PRIMARY KEY("method_id","bank_account_id")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_digital" boolean DEFAULT false,
	"currency_id" uuid,
	"branch_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invoice_id" uuid,
	"partner_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"method_id" uuid NOT NULL,
	"status" text DEFAULT 'POSTED',
	"type" text DEFAULT 'INCOME',
	"amount" numeric(20, 2) NOT NULL,
	"currency_id" uuid NOT NULL,
	"exchange_rate" numeric(20, 10) NOT NULL,
	"bank_account_id" uuid,
	"payroll_run_id" uuid,
	"reference" text,
	"metadata" jsonb,
	"date" timestamp DEFAULT now(),
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payroll_concept_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"is_system" boolean DEFAULT false,
	"branch_id" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payroll_concept_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payroll_incidents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1',
	"amount" numeric(20, 2),
	"status" text DEFAULT 'PENDING',
	"processed_in_run_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_item_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"concept_code" text NOT NULL,
	"concept_name" text NOT NULL,
	"category" text NOT NULL,
	"base" numeric(20, 2) DEFAULT '0',
	"rate" numeric(10, 4) DEFAULT '0',
	"amount" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"base_amount" numeric(20, 2) NOT NULL,
	"bonuses" numeric(20, 2) DEFAULT '0',
	"deductions" numeric(20, 2) DEFAULT '0',
	"net_total" numeric(20, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"branch_id" uuid NOT NULL,
	"frequency" text NOT NULL,
	"currency_id" uuid NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_amount" numeric(20, 2) DEFAULT '0',
	"status" text DEFAULT 'DRAFT',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payroll_runs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payroll_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"value" numeric(20, 4) NOT NULL,
	"type" text NOT NULL,
	"branch_id" uuid,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payroll_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"module" text NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "product_batches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_number" text NOT NULL,
	"expiration_date" timestamp,
	"cost" numeric(20, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"cost" numeric(20, 2) DEFAULT '0',
	"price" numeric(20, 2) DEFAULT '0',
	"is_exempt" boolean DEFAULT false,
	"tax_rate" numeric(5, 2) DEFAULT '16.00',
	"type" text DEFAULT 'PHYSICAL',
	"min_stock" numeric(20, 2) DEFAULT '0',
	"has_batches" boolean DEFAULT false,
	"currency_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "roles_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "roles_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"id" uuid PRIMARY KEY NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" numeric(20, 4) DEFAULT '0',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_concepts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"retention_percentage" numeric(5, 2) NOT NULL,
	"base_min" numeric(20, 2) DEFAULT '0',
	"sustraendo" numeric(20, 4) DEFAULT '0',
	"is_enabled" boolean DEFAULT true,
	CONSTRAINT "tax_concepts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_retention_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"retention_id" uuid NOT NULL,
	"invoice_id" uuid,
	"payment_id" uuid,
	"base_amount" numeric(20, 2) NOT NULL,
	"tax_amount" numeric(20, 2) DEFAULT '0',
	"retained_amount" numeric(20, 2) NOT NULL,
	"concept_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tax_retentions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"period" text NOT NULL,
	"type" text NOT NULL,
	"total_base" numeric(20, 2) NOT NULL,
	"total_tax" numeric(20, 2) DEFAULT '0',
	"total_retained" numeric(20, 2) NOT NULL,
	"xml_content" text,
	"date" timestamp DEFAULT now(),
	"user_id" uuid,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tax_retentions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_app_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"refresh_token" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users_branches" (
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"is_default" boolean DEFAULT false,
	CONSTRAINT "users_branches_user_id_branch_id_pk" PRIMARY KEY("user_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE "users_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "users_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"address" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_accounts_code_branch_idx" ON "accounting_accounts" USING btree ("code","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_code_unq" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_code_branch_unq" ON "payment_methods" USING btree ("code","branch_id");