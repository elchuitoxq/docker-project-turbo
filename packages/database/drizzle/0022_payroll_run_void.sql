-- P-29 · Anulación de un run de nómina (RN-21)
--
-- Un run pagado o contabilizado era inmutable sin vuelta atrás: si un sueldo salía mal, el sistema no
-- tenía cómo deshacerlo. La anulación no borra nada —eso destruiría la evidencia— sino que deja
-- constancia de quién la pidió, cuándo y por qué, y la nómina pasa a VOID con un asiento de reversión.

ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "voided_at" timestamp,
  ADD COLUMN IF NOT EXISTS "voided_by" uuid,
  ADD COLUMN IF NOT EXISTS "void_reason" text;
