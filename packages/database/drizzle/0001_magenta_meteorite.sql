ALTER TABLE "payments" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_code_unique" UNIQUE("code");