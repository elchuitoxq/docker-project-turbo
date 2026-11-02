-- `S-21`: la retención de ISLR deja constancia de la regla que la justificó.
--
-- Hasta ahora el comprobante sólo guardaba el importe retenido: no se podía saber si salió del
-- concepto del proveedor, de su tasa propia o de los parámetros de la empresa, ni a qué porcentaje.

ALTER TABLE "tax_retentions" ADD COLUMN IF NOT EXISTS "applied_rate" numeric(20, 2);
ALTER TABLE "tax_retentions" ADD COLUMN IF NOT EXISTS "rule_source" text;
