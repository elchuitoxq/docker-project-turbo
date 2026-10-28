-- P-30 · Desgravámenes de ISLR por concepto
--
-- La retención se calculaba sobre el salario normal completo, así que salía más alta que la real:
-- los aportes obligatorios del trabajador (IVSS, paro forzoso, FAOV) se restan de la base antes de
-- aplicar la tarifa del Art. 50. En lugar de cablear esos tres códigos en el motor se marca el
-- concepto, que es como SAP resuelve lo mismo con la clase de evaluación de impuesto del wage type:
-- un cambio de criterio es un flag, no un despliegue.

ALTER TABLE "payroll_concept_types"
  ADD COLUMN IF NOT EXISTS "reduces_income_tax_base" boolean DEFAULT false NOT NULL;
