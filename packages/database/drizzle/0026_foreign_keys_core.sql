-- 0026 · Claves foráneas del núcleo (`S-17`)
--
-- Las tablas de documentos, tesorería, contabilidad y personal se crearon sin FK: sólo `NOT NULL` y
-- el `code` único. Eso permitió huérfanos reales (productos, facturas, pagos, cuentas y tasas que
-- apuntaban a monedas, bancos o usuarios inexistentes) y dejó la integridad en manos del gate de
-- semillas, que sólo detecta; no impide.
--
-- Criterio de borrado:
--   * `restrict`  → maestros y documentos: nadie puede borrar un padre con hijos vivos.
--   * `cascade`   → líneas y dependientes puros (invoice_items, payment_allocations, nómina…).
--   * `set null`  → vínculos opcionales (autor, aprobador, lote, pago conciliado).
--
-- Los vínculos opcionales que quedaron apuntando a filas inexistentes se limpian primero: es un
-- no-op semántico. Si una relación obligatoria tuviera huérfanos, la migración falla y hay que
-- arreglar los datos: no se inventan padres.
--
-- El bloque es idempotente: omite la columna si ya tiene una FK declarada, así puede correrse sobre
-- una base que ya tenga parte de las relaciones.

-- Limpieza de vínculos opcionales sin padre
UPDATE orders x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE order_items x SET batch_id = NULL WHERE x.batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_batches p WHERE p.id = x.batch_id);
UPDATE invoices x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE payments x SET bank_account_id = NULL WHERE x.bank_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bank_accounts p WHERE p.id = x.bank_account_id);
UPDATE payments x SET invoice_id = NULL WHERE x.invoice_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices p WHERE p.id = x.invoice_id);
UPDATE payments x SET payroll_run_id = NULL WHERE x.payroll_run_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payroll_runs p WHERE p.id = x.payroll_run_id);
UPDATE payments x SET bank_statement_line_id = NULL WHERE x.bank_statement_line_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bank_statement_lines p WHERE p.id = x.bank_statement_line_id);
UPDATE payments x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE credit_notes x SET invoice_id = NULL WHERE x.invoice_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices p WHERE p.id = x.invoice_id);
UPDATE credit_notes x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE credit_notes x SET parent_payment_id = NULL WHERE x.parent_payment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = x.parent_payment_id);
UPDATE loans x SET branch_id = NULL WHERE x.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches p WHERE p.id = x.branch_id);
UPDATE tax_retentions x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE tax_retention_lines x SET invoice_id = NULL WHERE x.invoice_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices p WHERE p.id = x.invoice_id);
UPDATE tax_retention_lines x SET payment_id = NULL WHERE x.payment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = x.payment_id);
UPDATE tax_retention_lines x SET concept_id = NULL WHERE x.concept_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tax_concepts p WHERE p.id = x.concept_id);
UPDATE partners x SET islr_concept_id = NULL WHERE x.islr_concept_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tax_concepts p WHERE p.id = x.islr_concept_id);
UPDATE products x SET category_id = NULL WHERE x.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_categories p WHERE p.id = x.category_id);
UPDATE products x SET currency_id = NULL WHERE x.currency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM currencies p WHERE p.id = x.currency_id);
UPDATE product_categories x SET parent_id = NULL WHERE x.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_categories p WHERE p.id = x.parent_id);
UPDATE stock x SET batch_id = NULL WHERE x.batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_batches p WHERE p.id = x.batch_id);
UPDATE inventory_moves x SET from_warehouse_id = NULL WHERE x.from_warehouse_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM warehouses p WHERE p.id = x.from_warehouse_id);
UPDATE inventory_moves x SET to_warehouse_id = NULL WHERE x.to_warehouse_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM warehouses p WHERE p.id = x.to_warehouse_id);
UPDATE inventory_moves x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE inventory_moves x SET approved_by = NULL WHERE x.approved_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.approved_by);
UPDATE inventory_move_lines x SET batch_id = NULL WHERE x.batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_batches p WHERE p.id = x.batch_id);
UPDATE payment_methods x SET currency_id = NULL WHERE x.currency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM currencies p WHERE p.id = x.currency_id);
UPDATE bank_statement_imports x SET imported_by = NULL WHERE x.imported_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.imported_by);
UPDATE bank_statement_lines x SET matched_payment_id = NULL WHERE x.matched_payment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = x.matched_payment_id);
UPDATE bank_statement_lines x SET matched_by = NULL WHERE x.matched_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.matched_by);
UPDATE daily_closes x SET closed_by = NULL WHERE x.closed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.closed_by);
UPDATE daily_closes x SET reopened_by = NULL WHERE x.reopened_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.reopened_by);
UPDATE petty_cash_funds x SET responsible_user_id = NULL WHERE x.responsible_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.responsible_user_id);
UPDATE petty_cash_movements x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE exchange_rates x SET created_by = NULL WHERE x.created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.created_by);
UPDATE document_events x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE document_events x SET branch_id = NULL WHERE x.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches p WHERE p.id = x.branch_id);
UPDATE audit_logs x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE audit_logs x SET branch_id = NULL WHERE x.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches p WHERE p.id = x.branch_id);
UPDATE document_links x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE accounting_accounts x SET branch_id = NULL WHERE x.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches p WHERE p.id = x.branch_id);
UPDATE accounting_accounts x SET parent_id = NULL WHERE x.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounting_accounts p WHERE p.id = x.parent_id);
UPDATE accounting_entries x SET base_currency_id = NULL WHERE x.base_currency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM currencies p WHERE p.id = x.base_currency_id);
UPDATE accounting_entries x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE accounting_entries x SET posted_by = NULL WHERE x.posted_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.posted_by);
UPDATE accounting_entry_lines x SET original_currency_id = NULL WHERE x.original_currency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM currencies p WHERE p.id = x.original_currency_id);
UPDATE accounting_maps x SET branch_id = NULL WHERE x.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches p WHERE p.id = x.branch_id);
UPDATE accounting_maps x SET category_id = NULL WHERE x.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_categories p WHERE p.id = x.category_id);
UPDATE accounting_maps x SET debit_account_id = NULL WHERE x.debit_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounting_accounts p WHERE p.id = x.debit_account_id);
UPDATE accounting_maps x SET credit_account_id = NULL WHERE x.credit_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounting_accounts p WHERE p.id = x.credit_account_id);
UPDATE accounting_maps x SET payment_method_id = NULL WHERE x.payment_method_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payment_methods p WHERE p.id = x.payment_method_id);
UPDATE accounting_maps x SET product_id = NULL WHERE x.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = x.product_id);
UPDATE accounting_periods x SET closed_by = NULL WHERE x.closed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.closed_by);
UPDATE accounting_periods x SET reopened_by = NULL WHERE x.reopened_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.reopened_by);
UPDATE fiscal_exports x SET user_id = NULL WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.user_id);
UPDATE departments x SET parent_id = NULL WHERE x.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM departments p WHERE p.id = x.parent_id);
UPDATE job_positions x SET currency_id = NULL WHERE x.currency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM currencies p WHERE p.id = x.currency_id);
UPDATE employees x SET bank_id = NULL WHERE x.bank_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM banks p WHERE p.id = x.bank_id);
UPDATE employees x SET department_id = NULL WHERE x.department_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM departments p WHERE p.id = x.department_id);
UPDATE employees x SET position_id = NULL WHERE x.position_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM job_positions p WHERE p.id = x.position_id);
UPDATE employees x SET salary_currency_id = NULL WHERE x.salary_currency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM currencies p WHERE p.id = x.salary_currency_id);
UPDATE employee_settlements x SET branch_id = NULL WHERE x.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches p WHERE p.id = x.branch_id);
UPDATE employee_settlements x SET created_by = NULL WHERE x.created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.created_by);
UPDATE employee_salary_history x SET currency_id = NULL WHERE x.currency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM currencies p WHERE p.id = x.currency_id);
UPDATE employee_bank_accounts x SET currency_id = NULL WHERE x.currency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM currencies p WHERE p.id = x.currency_id);
UPDATE payroll_runs x SET voided_by = NULL WHERE x.voided_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users p WHERE p.id = x.voided_by);
UPDATE payroll_incidents x SET processed_in_run_id = NULL WHERE x.processed_in_run_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payroll_runs p WHERE p.id = x.processed_in_run_id);

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('orders', 'branch_id', 'branches', 'restrict'),
      ('orders', 'partner_id', 'partners', 'restrict'),
      ('orders', 'currency_id', 'currencies', 'restrict'),
      ('orders', 'warehouse_id', 'warehouses', 'restrict'),
      ('orders', 'user_id', 'users', 'set null'),
      ('order_items', 'order_id', 'orders', 'cascade'),
      ('order_items', 'product_id', 'products', 'restrict'),
      ('order_items', 'batch_id', 'product_batches', 'set null'),
      ('invoices', 'branch_id', 'branches', 'restrict'),
      ('invoices', 'partner_id', 'partners', 'restrict'),
      ('invoices', 'currency_id', 'currencies', 'restrict'),
      ('invoices', 'order_id', 'orders', 'restrict'),
      ('invoices', 'warehouse_id', 'warehouses', 'restrict'),
      ('invoices', 'user_id', 'users', 'set null'),
      ('invoice_items', 'invoice_id', 'invoices', 'cascade'),
      ('invoice_items', 'product_id', 'products', 'restrict'),
      ('payments', 'branch_id', 'branches', 'restrict'),
      ('payments', 'partner_id', 'partners', 'restrict'),
      ('payments', 'currency_id', 'currencies', 'restrict'),
      ('payments', 'method_id', 'payment_methods', 'restrict'),
      ('payments', 'bank_account_id', 'bank_accounts', 'set null'),
      ('payments', 'invoice_id', 'invoices', 'set null'),
      ('payments', 'payroll_run_id', 'payroll_runs', 'set null'),
      ('payments', 'bank_statement_line_id', 'bank_statement_lines', 'set null'),
      ('payments', 'user_id', 'users', 'set null'),
      ('payment_allocations', 'payment_id', 'payments', 'cascade'),
      ('payment_allocations', 'invoice_id', 'invoices', 'restrict'),
      ('credit_notes', 'branch_id', 'branches', 'restrict'),
      ('credit_notes', 'partner_id', 'partners', 'restrict'),
      ('credit_notes', 'currency_id', 'currencies', 'restrict'),
      ('credit_notes', 'invoice_id', 'invoices', 'set null'),
      ('credit_notes', 'warehouse_id', 'warehouses', 'restrict'),
      ('credit_notes', 'user_id', 'users', 'set null'),
      ('credit_notes', 'parent_payment_id', 'payments', 'set null'),
      ('credit_note_items', 'credit_note_id', 'credit_notes', 'cascade'),
      ('credit_note_items', 'product_id', 'products', 'restrict'),
      ('credit_note_usages', 'credit_note_id', 'credit_notes', 'cascade'),
      ('credit_note_usages', 'payment_id', 'payments', 'cascade'),
      ('loans', 'branch_id', 'branches', 'set null'),
      ('loans', 'partner_id', 'partners', 'restrict'),
      ('loan_items', 'loan_id', 'loans', 'cascade'),
      ('loan_items', 'product_id', 'products', 'restrict'),
      ('tax_retentions', 'branch_id', 'branches', 'restrict'),
      ('tax_retentions', 'partner_id', 'partners', 'restrict'),
      ('tax_retentions', 'currency_id', 'currencies', 'restrict'),
      ('tax_retentions', 'invoice_id', 'invoices', 'restrict'),
      ('tax_retentions', 'user_id', 'users', 'set null'),
      ('tax_retention_lines', 'retention_id', 'tax_retentions', 'cascade'),
      ('tax_retention_lines', 'invoice_id', 'invoices', 'set null'),
      ('tax_retention_lines', 'payment_id', 'payments', 'set null'),
      ('tax_retention_lines', 'concept_id', 'tax_concepts', 'set null'),
      ('partners', 'islr_concept_id', 'tax_concepts', 'set null'),
      ('products', 'category_id', 'product_categories', 'set null'),
      ('products', 'currency_id', 'currencies', 'set null'),
      ('product_categories', 'parent_id', 'product_categories', 'set null'),
      ('product_batches', 'product_id', 'products', 'cascade'),
      ('stock', 'product_id', 'products', 'cascade'),
      ('stock', 'warehouse_id', 'warehouses', 'restrict'),
      ('stock', 'batch_id', 'product_batches', 'set null'),
      ('warehouses', 'branch_id', 'branches', 'restrict'),
      ('inventory_moves', 'branch_id', 'branches', 'restrict'),
      ('inventory_moves', 'from_warehouse_id', 'warehouses', 'set null'),
      ('inventory_moves', 'to_warehouse_id', 'warehouses', 'set null'),
      ('inventory_moves', 'user_id', 'users', 'set null'),
      ('inventory_moves', 'approved_by', 'users', 'set null'),
      ('inventory_move_lines', 'move_id', 'inventory_moves', 'cascade'),
      ('inventory_move_lines', 'product_id', 'products', 'restrict'),
      ('inventory_move_lines', 'batch_id', 'product_batches', 'set null'),
      ('bank_accounts', 'bank_id', 'banks', 'restrict'),
      ('bank_accounts', 'branch_id', 'branches', 'restrict'),
      ('bank_accounts', 'currency_id', 'currencies', 'restrict'),
      ('payment_methods', 'branch_id', 'branches', 'restrict'),
      ('payment_methods', 'currency_id', 'currencies', 'set null'),
      ('payment_method_accounts', 'method_id', 'payment_methods', 'cascade'),
      ('payment_method_accounts', 'bank_account_id', 'bank_accounts', 'cascade'),
      ('bank_statement_imports', 'bank_account_id', 'bank_accounts', 'cascade'),
      ('bank_statement_imports', 'branch_id', 'branches', 'restrict'),
      ('bank_statement_imports', 'imported_by', 'users', 'set null'),
      ('bank_statement_lines', 'bank_account_id', 'bank_accounts', 'cascade'),
      ('bank_statement_lines', 'branch_id', 'branches', 'restrict'),
      ('bank_statement_lines', 'matched_payment_id', 'payments', 'set null'),
      ('bank_statement_lines', 'matched_by', 'users', 'set null'),
      ('daily_closes', 'closed_by', 'users', 'set null'),
      ('daily_closes', 'reopened_by', 'users', 'set null'),
      ('petty_cash_funds', 'currency_id', 'currencies', 'restrict'),
      ('petty_cash_funds', 'responsible_user_id', 'users', 'set null'),
      ('petty_cash_movements', 'user_id', 'users', 'set null'),
      ('exchange_rates', 'currency_id', 'currencies', 'cascade'),
      ('exchange_rates', 'created_by', 'users', 'set null'),
      ('document_events', 'user_id', 'users', 'set null'),
      ('document_events', 'branch_id', 'branches', 'set null'),
      ('audit_logs', 'user_id', 'users', 'set null'),
      ('audit_logs', 'branch_id', 'branches', 'set null'),
      ('document_links', 'user_id', 'users', 'set null'),
      ('organization_modules', 'branch_id', 'branches', 'cascade'),
      ('accounting_accounts', 'branch_id', 'branches', 'set null'),
      ('accounting_accounts', 'parent_id', 'accounting_accounts', 'set null'),
      ('accounting_entries', 'branch_id', 'branches', 'restrict'),
      ('accounting_entries', 'base_currency_id', 'currencies', 'set null'),
      ('accounting_entries', 'user_id', 'users', 'set null'),
      ('accounting_entries', 'posted_by', 'users', 'set null'),
      ('accounting_entry_lines', 'entry_id', 'accounting_entries', 'cascade'),
      ('accounting_entry_lines', 'account_id', 'accounting_accounts', 'restrict'),
      ('accounting_entry_lines', 'original_currency_id', 'currencies', 'set null'),
      ('accounting_maps', 'branch_id', 'branches', 'set null'),
      ('accounting_maps', 'category_id', 'product_categories', 'set null'),
      ('accounting_maps', 'debit_account_id', 'accounting_accounts', 'set null'),
      ('accounting_maps', 'credit_account_id', 'accounting_accounts', 'set null'),
      ('accounting_maps', 'payment_method_id', 'payment_methods', 'set null'),
      ('accounting_maps', 'product_id', 'products', 'set null'),
      ('accounting_periods', 'closed_by', 'users', 'set null'),
      ('accounting_periods', 'reopened_by', 'users', 'set null'),
      ('fiscal_sequences', 'branch_id', 'branches', 'restrict'),
      ('fiscal_exports', 'branch_id', 'branches', 'restrict'),
      ('fiscal_exports', 'user_id', 'users', 'set null'),
      ('departments', 'branch_id', 'branches', 'restrict'),
      ('departments', 'parent_id', 'departments', 'set null'),
      ('job_positions', 'currency_id', 'currencies', 'set null'),
      ('employees', 'branch_id', 'branches', 'restrict'),
      ('employees', 'bank_id', 'banks', 'set null'),
      ('employees', 'department_id', 'departments', 'set null'),
      ('employees', 'position_id', 'job_positions', 'set null'),
      ('employees', 'salary_currency_id', 'currencies', 'set null'),
      ('employee_contracts', 'employee_id', 'employees', 'cascade'),
      ('employee_benefits', 'employee_id', 'employees', 'cascade'),
      ('employee_vacations', 'employee_id', 'employees', 'cascade'),
      ('employee_settlements', 'employee_id', 'employees', 'cascade'),
      ('employee_settlements', 'branch_id', 'branches', 'set null'),
      ('employee_settlements', 'created_by', 'users', 'set null'),
      ('employee_profit_sharing', 'employee_id', 'employees', 'cascade'),
      ('employee_salary_history', 'employee_id', 'employees', 'cascade'),
      ('employee_salary_history', 'currency_id', 'currencies', 'set null'),
      ('employee_bank_accounts', 'employee_id', 'employees', 'cascade'),
      ('employee_bank_accounts', 'bank_id', 'banks', 'restrict'),
      ('employee_bank_accounts', 'currency_id', 'currencies', 'set null'),
      ('payroll_runs', 'branch_id', 'branches', 'restrict'),
      ('payroll_runs', 'currency_id', 'currencies', 'restrict'),
      ('payroll_runs', 'voided_by', 'users', 'set null'),
      ('payroll_items', 'run_id', 'payroll_runs', 'cascade'),
      ('payroll_items', 'employee_id', 'employees', 'restrict'),
      ('payroll_item_lines', 'item_id', 'payroll_items', 'cascade'),
      ('payroll_incidents', 'employee_id', 'employees', 'cascade'),
      ('payroll_incidents', 'concept_id', 'payroll_concept_types', 'restrict'),
      ('payroll_incidents', 'processed_in_run_id', 'payroll_runs', 'set null'),
      ('user_app_settings', 'user_id', 'users', 'cascade'),
      ('payroll_settings', 'branch_id', 'branches', 'cascade'),
      ('payroll_concept_types', 'branch_id', 'branches', 'cascade'),
      ('payroll_period_settings', 'branch_id', 'branches', 'cascade')
    ) AS t(tbl, col, ref, del)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f'
        AND c.conrelid = r.tbl::regclass
        AND a.attname = r.col
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I (id) ON DELETE %s',
        r.tbl,
        r.tbl || '_' || r.col || '_fkey',
        r.col,
        r.ref,
        upper(r.del)
      );
    END IF;
  END LOOP;
END
$$;
