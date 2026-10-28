-- H-59/RN-09 · Tabla progresiva de ISLR con vigencia
--
-- SAP resuelve el impuesto progresivo con una tabla de customizing por ejercicio: tramos en
-- unidades tributarias, tasa y sustraendo, más el valor de la UT. Aquí se replica igual para que el
-- motor sólo aplique datos y la tabla se pueda cambiar sin tocar código.

CREATE TABLE IF NOT EXISTS "income_tax_brackets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"effective_from" timestamp NOT NULL,
	"from_ut" numeric(14, 2) NOT NULL,
	"to_ut" numeric(14, 2),
	"rate" numeric(6, 4) NOT NULL,
	"discount_ut" numeric(14, 2) DEFAULT '0' NOT NULL,
	"source" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "income_tax_brackets_effective_idx"
  ON "income_tax_brackets" USING btree ("effective_from", "from_ut");
