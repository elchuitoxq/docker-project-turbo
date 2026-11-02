-- `S-22`: unidad tributaria vigente y sustraendos expresados en UT.
--
-- La ley expresa varios sustraendos en unidades tributarias (UT), no en bolívares. Sin la UT del
-- período no se puede convertir el sustraendo del concepto al monto que se resta de la retención.

CREATE TABLE IF NOT EXISTS "tax_units" (
  "id" uuid PRIMARY KEY,
  "value" numeric(20, 2) NOT NULL,
  "effective_from" timestamp NOT NULL,
  "source" text,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tax_units_effective_unq" ON "tax_units" ("effective_from");

ALTER TABLE "tax_concepts" ADD COLUMN IF NOT EXISTS "sustraendo_unit" text DEFAULT 'BS';
