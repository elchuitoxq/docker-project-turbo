-- S-15: la moneda funcional no lleva tasa (vale 1 contra sí misma).
-- Limpia las filas que sembraban `36,50` en VES y que la UI mostraba como "tasa de la moneda funcional".
DELETE FROM exchange_rates
WHERE currency_id IN (SELECT id FROM currencies WHERE is_base = true);
