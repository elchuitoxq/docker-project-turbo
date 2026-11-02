-- `S-19`: cada cuenta bancaria apunta a su cuenta del plan contable.
--
-- Hasta ahora el asiento del cobro/pago abonaba siempre `1.1.1.002` (banco moneda funcional): el
-- mayor no distinguía bancos, así que no se podía conciliar contra el extracto. Con este vínculo el
-- asiento usa la cuenta real de la cuenta bancaria que movió el dinero.

ALTER TABLE "bank_accounts" ADD COLUMN IF NOT EXISTS "accounting_account_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_accounts_accounting_account_id_fkey'
  ) THEN
    ALTER TABLE "bank_accounts"
      ADD CONSTRAINT "bank_accounts_accounting_account_id_fkey"
      FOREIGN KEY ("accounting_account_id") REFERENCES "accounting_accounts"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
