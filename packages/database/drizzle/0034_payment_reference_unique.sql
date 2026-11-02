-- 0034 · Referencia bancaria única (`S-05` / `T-05-01`)
--
-- `payments.reference` es la prueba de que el dinero entró a la cuenta. Sin restricción, el mismo
-- número de transferencia podía registrarse varias veces y justificar dos cobros (en la misma
-- factura o en facturas distintas), que es el vector de estafa que se quiere cerrar.
--
-- Reglas:
--   * La referencia se guarda normalizada (mayúsculas, sin espacios sobrantes) para que
--     «zelle-123», « ZELLE-123 » y «Zelle 123» sean el mismo número.
--   * Una referencia vacía es «sin referencia» y se guarda como NULL.
--   * El índice es único entre pagos vigentes: un pago anulado libera su referencia porque el
--     dinero no llegó y hay que poder volver a registrarlo bien.

-- 1) Normalización de los datos existentes.
UPDATE "payments"
   SET "reference" = NULL
 WHERE "reference" IS NOT NULL
   AND btrim("reference") = '';

UPDATE "payments"
   SET "reference" = upper(btrim(regexp_replace("reference", '\s+', ' ', 'g')))
 WHERE "reference" IS NOT NULL;

-- 2) Duplicados preexistentes. No se borran ni se vacían: se marcan con el código del propio pago
--    para conservar el rastro y dejar el índice en pie. Tesorería debe revisar las filas `[dup …]`.
WITH ranked AS (
  SELECT "id",
         "reference",
         row_number() OVER (PARTITION BY "reference" ORDER BY "date", "created_at", "id") AS rn
    FROM "payments"
   WHERE "reference" IS NOT NULL
     AND "status" <> 'VOID'
)
UPDATE "payments" p
   SET "reference" = d."reference" || ' [dup ' || p."code" || ']'
  FROM ranked d
 WHERE p."id" = d."id"
   AND d.rn > 1
   AND p."reference" !~ ' \[dup [^]]+\]$';

-- 3) Garantía en la base, además de la validación del servicio.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_reference_unq"
  ON "payments" ("reference")
  WHERE "reference" IS NOT NULL
    AND "status" <> 'VOID';
