-- S-16: el código de un movimiento de inventario es un documento y debe ser único.
-- El generador (`INV-<año>-<secuencia>`) ya cuenta sobre toda la tabla, pero sin índice único dos
-- altas simultáneas podían duplicarlo.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_moves_code_unique ON inventory_moves (code);
