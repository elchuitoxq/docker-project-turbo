import { sql } from 'drizzle-orm';
import { db } from '../index';

/**
 * Auditoría de integridad de los datos sembrados (`S-16`).
 *
 * Cada chequeo devuelve las filas que **violan** la regla; el conjunto debe quedar vacío. Se usa en
 * tres lugares para que no vuelva a pasar lo que pasó con la base de desarrollo: filas huérfanas de
 * semillas viejas (productos, cuentas bancarias, tasas y facturas apuntando a monedas que ya no
 * existen) que ninguna FK impedía.
 *
 *  1. al final de `seedTestData()` — la semilla falla si deja la base incoherente,
 *  2. en `_verify-integrity.ts` — auditoría manual,
 *  3. en `tests/integration/seed.test.ts` — gate de CI.
 */
export interface IntegrityCheck {
  /** Módulo al que pertenece (para agrupar el reporte). */
  module: string;
  name: string;
  /** Devuelve las filas que incumplen la regla. */
  sql: string;
}

export const INTEGRITY_CHECKS: IntegrityCheck[] = [
  // --- Seguridad
  {
    module: 'Seguridad',
    name: 'Users tienen email único',
    sql: 'select email from users group by email having count(*) > 1',
  },
  {
    module: 'Seguridad',
    name: 'Users tienen contraseña hasheada',
    sql: "select id from users where password is null or length(password) < 20 or password not like '$2%'",
  },
  {
    module: 'Seguridad',
    name: 'Cada usuario tiene exactamente un rol',
    sql: 'select user_id from users_roles group by user_id having count(*) <> 1',
  },
  {
    module: 'Seguridad',
    name: 'Cada usuario tiene al menos una sucursal',
    sql: 'select u.id from users u where not exists (select 1 from users_branches ub where ub.user_id = u.id)',
  },
  {
    module: 'Seguridad',
    name: 'Cada rol tiene al menos un permiso',
    sql: 'select r.id from roles r where not exists (select 1 from roles_permissions rp where rp.role_id = r.id)',
  },
  {
    module: 'Seguridad',
    name: 'No hay usuarios sin rol válido',
    sql: 'select user_id from users_roles ur where not exists (select 1 from roles r where r.id = ur.role_id)',
  },

  // --- Moneda
  {
    module: 'Multimoneda',
    name: 'Existe exactamente una moneda funcional',
    sql: `select count(*) from (select 1 from currencies where is_base = true) t having count(*) <> 1`,
  },
  {
    module: 'Multimoneda',
    name: 'La moneda funcional no tiene tasas',
    sql: 'select r.id from exchange_rates r join currencies c on c.id = r.currency_id where c.is_base = true',
  },
  {
    module: 'Multimoneda',
    name: 'Una sola tasa por moneda y día',
    sql: 'select currency_id, date from exchange_rates group by currency_id, date having count(*) > 1',
  },
  {
    module: 'Multimoneda',
    name: 'Las tasas son positivas',
    sql: 'select id from exchange_rates where rate <= 0',
  },
  {
    module: 'Multimoneda',
    name: 'Las tasas apuntan a una moneda existente',
    sql: 'select r.id from exchange_rates r where not exists (select 1 from currencies c where c.id = r.currency_id)',
  },
  {
    module: 'Multimoneda',
    name: 'La moneda funcional vale 1 en los documentos',
    sql: `select i.code from invoices i join currencies c on c.id = i.currency_id where c.is_base = true and i.exchange_rate <> 1`,
  },

  // --- Operaciones
  {
    module: 'Operaciones',
    name: 'Los pedidos tienen partner, sucursal y moneda válidos',
    sql: `select o.code from orders o
          where not exists (select 1 from partners p where p.id = o.partner_id)
             or not exists (select 1 from branches b where b.id = o.branch_id)
             or not exists (select 1 from currencies c where c.id = o.currency_id)`,
  },
  {
    module: 'Operaciones',
    name: 'Los pedidos tienen estados conocidos',
    sql: "select code from orders where status not in ('DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED')",
  },
  {
    module: 'Operaciones',
    name: 'Los pedidos tienen líneas',
    sql: 'select o.code from orders o where not exists (select 1 from order_items i where i.order_id = o.id)',
  },
  {
    module: 'Operaciones',
    name: 'El total del pedido cuadra con sus líneas',
    sql: `select o.code from orders o
          join (select order_id, sum(quantity * price) as total from order_items group by order_id) t
            on t.order_id = o.id
          where abs(o.total - t.total) > 0.05`,
  },
  {
    module: 'Operaciones',
    name: 'Las facturas tienen partner, sucursal y moneda válidos',
    sql: `select i.code from invoices i
          where not exists (select 1 from partners p where p.id = i.partner_id)
             or not exists (select 1 from branches b where b.id = i.branch_id)
             or not exists (select 1 from currencies c where c.id = i.currency_id)`,
  },
  {
    module: 'Operaciones',
    name: 'Las facturas tienen estados conocidos',
    sql: "select code from invoices where status not in ('DRAFT', 'POSTED', 'PARTIAL', 'PAID', 'VOID', 'CANCELLED')",
  },
  {
    module: 'Operaciones',
    name: 'El total de la factura = base + IVA + IGTF',
    sql: 'select code from invoices where abs(total - (total_base + total_tax + total_igtf)) > 0.05',
  },
  {
    module: 'Operaciones',
    name: 'Lo pagado no supera el total de la factura',
    sql: 'select code from invoices where paid_amount > total + 0.05',
  },
  {
    module: 'Operaciones',
    name: 'Las facturas tienen líneas',
    sql: 'select i.code from invoices i where not exists (select 1 from invoice_items it where it.invoice_id = i.id)',
  },
  {
    module: 'Operaciones',
    name: 'Las facturas apuntan a un pedido existente',
    sql: 'select i.code from invoices i where i.order_id is not null and not exists (select 1 from orders o where o.id = i.order_id)',
  },

  // --- Inventario
  {
    module: 'Inventario',
    name: 'El stock no es negativo',
    sql: 'select id from stock where quantity < 0',
  },
  {
    module: 'Inventario',
    name: 'El stock apunta a almacén y producto válidos',
    sql: `select s.id from stock s
          where not exists (select 1 from warehouses w where w.id = s.warehouse_id)
             or not exists (select 1 from products p where p.id = s.product_id)`,
  },
  {
    module: 'Inventario',
    name: 'Los productos tienen categoría y moneda válidas',
    sql: `select p.sku from products p
          where (p.category_id is not null and not exists (select 1 from product_categories c where c.id = p.category_id))
             or (p.currency_id is not null and not exists (select 1 from currencies c where c.id = p.currency_id))`,
  },
  {
    module: 'Inventario',
    name: 'Los SKU son únicos',
    sql: 'select sku from products group by sku having count(*) > 1',
  },
  {
    module: 'Inventario',
    name: 'Los movimientos aprobados tienen líneas y almacén',
    sql: `select m.code from inventory_moves m
          where not exists (select 1 from inventory_move_lines l where l.move_id = m.id)`,
  },
  {
    module: 'Inventario',
    name: 'Los códigos de movimiento son únicos',
    sql: 'select code from inventory_moves group by code having count(*) > 1',
  },

  // --- Tesorería
  {
    module: 'Tesorería',
    name: 'Los pagos apuntan a sucursal, método y moneda válidos',
    sql: `select p.code from payments p
          where not exists (select 1 from branches b where b.id = p.branch_id)
             or not exists (select 1 from payment_methods m where m.id = p.method_id)
             or not exists (select 1 from currencies c where c.id = p.currency_id)`,
  },
  {
    module: 'Tesorería',
    name: 'El monto en moneda funcional del pago = monto x tasa',
    sql: 'select code from payments where abs(amount_base - (amount * exchange_rate)) > 0.5',
  },
  {
    module: 'Tesorería',
    name: 'Las asignaciones no superan el pago',
    sql: `select p.code from payments p
          join (select payment_id, sum(amount) as applied from payment_allocations group by payment_id) a
            on a.payment_id = p.id
          where a.applied > p.amount + 0.05`,
  },
  {
    module: 'Tesorería',
    name: 'Las cuentas bancarias apuntan a banco, sucursal y moneda válidos',
    sql: `select a.id from bank_accounts a
          where not exists (select 1 from banks b where b.id = a.bank_id)
             or not exists (select 1 from branches b where b.id = a.branch_id)
             or not exists (select 1 from currencies c where c.id = a.currency_id)`,
  },

  // --- Contabilidad
  {
    module: 'Contabilidad',
    name: 'Los asientos cuadran (débito = crédito)',
    sql: `select e.id from accounting_entries e
          join (select entry_id, sum(debit) as d, sum(credit) as c from accounting_entry_lines group by entry_id) l
            on l.entry_id = e.id
          where abs(l.d - l.c) > 0.05`,
  },
  {
    module: 'Contabilidad',
    name: 'Los asientos tienen al menos dos líneas',
    sql: 'select entry_id from accounting_entry_lines group by entry_id having count(*) < 2',
  },
  {
    module: 'Contabilidad',
    name: 'Las líneas apuntan a una cuenta contable válida',
    sql: 'select l.id from accounting_entry_lines l where not exists (select 1 from accounting_accounts a where a.id = l.account_id)',
  },
  {
    module: 'Contabilidad',
    name: 'Las líneas se imputan a cuentas que aceptan movimientos',
    sql: `select l.id from accounting_entry_lines l
          join accounting_accounts a on a.id = l.account_id
          where a.is_postable = false or a.is_active = false`,
  },
  {
    module: 'Contabilidad',
    name: 'Cada cuenta bancaria activa tiene su cuenta contable del activo',
    sql: `select b.id from bank_accounts b
          where b.is_active = true
            and (b.accounting_account_id is null
                 or not exists (select 1 from accounting_accounts a
                                where a.id = b.accounting_account_id and a.type = 'ASSET'))`,
  },
  {
    module: 'Contabilidad',
    name: 'El asiento de la factura separa IVA e IGTF de los ingresos',
    sql: `select e.id from accounting_entries e
          join invoices i on i.id = e.source_id and e.source_type = 'INVOICE'
          where i.total_tax > 0
            and not exists (select 1 from accounting_entry_lines l
                            join accounting_accounts a on a.id = l.account_id
                            where l.entry_id = e.id
                              and a.code in ('2.1.1.002', '1.1.2.002')
                              and abs(l.debit + l.credit - round(i.total_tax * i.exchange_rate, 2)) <= 0.02)`,
  },

  // --- Histórico
  {
    module: 'Histórico',
    name: 'Los eventos de documentos apuntan a usuarios y sucursales válidas',
    sql: `select e.id from document_events e
          where (e.user_id is not null and not exists (select 1 from users u where u.id = e.user_id))
             or (e.branch_id is not null and not exists (select 1 from branches b where b.id = e.branch_id))`,
  },
  {
    module: 'Histórico',
    name: 'Los eventos de pedido apuntan a un pedido existente',
    sql: `select e.id from document_events e
          where e.document_type = 'ORDER' and not exists (select 1 from orders o where o.id = e.document_id)`,
  },
  {
    module: 'Histórico',
    name: 'Los eventos de factura apuntan a una factura existente',
    sql: `select e.id from document_events e
          where e.document_type = 'INVOICE' and not exists (select 1 from invoices i where i.id = e.document_id)`,
  },
  {
    module: 'Histórico',
    name: 'Cada compra emitida con IVA tiene su comprobante de retención',
    sql: `select i.id from invoices i
          where i.type = 'PURCHASE'
            and i.status in ('POSTED', 'PARTIAL', 'PAID')
            and coalesce(i.total_tax, 0) > 0
            and not exists (
              select 1 from tax_retentions r
              where r.invoice_id = i.id and r.type = 'IVA'
            )`,
  },
  {
    module: 'Histórico',
    name: 'Las retenciones apuntan a la factura y al proveedor correctos',
    sql: `select r.id from tax_retentions r
          where not exists (select 1 from invoices i where i.id = r.invoice_id)
             or not exists (select 1 from partners p where p.id = r.partner_id)
             or (r.branch_id is not null and not exists (select 1 from branches b where b.id = r.branch_id))`,
  },
  {
    module: 'Histórico',
    name: 'La retención en moneda funcional cuadra con su tasa',
    sql: `select r.id from tax_retentions r
          where r.total_retained_base is not null
            and abs(r.total_retained_base - (r.total_retained * coalesce(r.exchange_rate, 1))) > 0.02`,
  },
  {
    module: 'Histórico',
    name: 'No hay dos comprobantes del mismo tipo para una factura',
    sql: 'select invoice_id, type from tax_retentions group by invoice_id, type having count(*) > 1',
  },
  {
    module: 'Histórico',
    name: 'Cada comprobante de retención tiene al menos una línea',
    sql: `select r.id from tax_retentions r
          where not exists (select 1 from tax_retention_lines l where l.retention_id = r.id)`,
  },
  {
    module: 'Histórico',
    name: 'El correlativo fiscal no va por detrás de los comprobantes emitidos',
    sql: `select s.id from fiscal_sequences s
          where s.document_type in ('RETENTION_IVA', 'RETENTION_ISLR')
            and s.last_number < (
              select count(*) from tax_retentions r
              where r.branch_id = s.branch_id
                and r.type = case when s.document_type = 'RETENTION_IVA' then 'IVA' else 'ISLR' end
            )`,
  },
  {
    module: 'Histórico',
    name: 'Cada comprobante de retención guarda la tasa y la regla que aplicó',
    // `S-21`: sin esto no se puede explicar ni recalcular el importe del comprobante.
    sql: `select r.id from tax_retentions r
          where r.applied_rate is null
             or r.rule_source is null
             or r.rule_source not in ('CONCEPT', 'PARTNER', 'SETTINGS')`,
  },
  {
    module: 'Histórico',
    name: 'La retención por concepto apunta al concepto que la justificó',
    sql: `select r.id from tax_retentions r
          where r.type = 'ISLR'
            and r.rule_source = 'CONCEPT'
            and not exists (
              select 1 from tax_retention_lines l
              where l.retention_id = r.id and l.concept_id is not null
            )`,
  },
  {
    module: 'Histórico',
    name: 'La unidad tributaria es positiva y su vigencia es única',
    // `S-22`: el índice único cubre la vigencia; esta regla veda valores en cero o negativos.
    sql: 'select id from tax_units where value <= 0',
  },
  {
    module: 'Histórico',
    name: 'Un sustraendo expresado en UT tiene su unidad tributaria cargada',
    sql: `select c.id from tax_concepts c
          where c.sustraendo_unit = 'UT'
            and coalesce(c.sustraendo, 0) <> 0
            and not exists (select 1 from tax_units u where u.value > 0)`,
  },

  // --- Integridad referencial (S-17)
  {
    module: 'Referencias',
    name: 'Toda columna de referencia tiene su FK declarada',
    // Las únicas columnas sin FK son las polimórficas: apuntan a más de una tabla según `type`, así
    // que no pueden declararse. Cualquier otra columna uuid de referencia sin FK es un agujero nuevo.
    sql: `select c.table_name || '.' || c.column_name
          from information_schema.columns c
          where c.table_schema = 'public'
            and c.data_type = 'uuid'
            and (
              c.column_name like '%\\_id'
              or c.column_name in ('approved_by', 'closed_by', 'reopened_by', 'matched_by',
                                   'imported_by', 'posted_by', 'voided_by', 'created_by')
            )
            and (c.table_name, c.column_name) not in (
              ('document_events', 'document_id'),
              ('document_events', 'parent_document_id'),
              ('audit_logs', 'entity_id'),
              ('accounting_entries', 'source_id'),
              ('document_links', 'source_id'),
              ('document_links', 'target_id')
            )
            and not exists (
              select 1
              from pg_constraint k
              join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
              where k.contype = 'f'
                and k.conrelid = c.table_name::regclass
                and a.attname = c.column_name
            )`,
  },
  {
    module: 'Referencias',
    name: 'Las FK están validadas contra los datos existentes',
    sql: `select conname from pg_constraint where contype = 'f' and not convalidated`,
  },

  // --- Multimoneda de cobros y pagos (S-18)
  {
    module: 'Multimoneda',
    name: 'Toda imputación trae su importe en la moneda de la factura',
    sql: 'select id from payment_allocations where invoice_amount is null or invoice_amount <= 0',
  },
  {
    module: 'Multimoneda',
    name: 'Lo imputado no excede el total de la factura',
    sql: `select a.invoice_id
          from payment_allocations a
          join payments p on p.id = a.payment_id
          join invoices i on i.id = a.invoice_id
          where p.status = 'POSTED'
          group by a.invoice_id, i.total
          having sum(a.invoice_amount) > i.total + 0.01`,
  },
  {
    module: 'Multimoneda',
    name: 'El pago y su cuenta bancaria comparten moneda',
    sql: `select p.id
          from payments p
          join bank_accounts b on b.id = p.bank_account_id
          where p.currency_id <> b.currency_id`,
  },
  {
    module: 'Multimoneda',
    name: 'Los pagos que afectan saldo tienen cuenta bancaria',
    sql: `select p.id
          from payments p
          join payment_methods m on m.id = p.method_id
          where p.bank_account_id is null
            and m.code in ('CASH_USD', 'CASH_VES', 'POS', 'ZELLE', 'TRANSFER')`,
  },
  {
    module: 'Referencias',
    name: 'Ninguna factura queda con saldo negativo',
    // Pagar de más (o pagar el total cuando además hubo retención) deja un saldo a favor que nadie
    // reclama: es un dato incoherente, no un anticipo (`S-17` M-31).
    sql: `select i.code
          from invoices i
          where round(
                  coalesce(i.total, 0)
                  - coalesce(i.paid_amount, 0)
                  - coalesce((select sum(r.total_retained) from tax_retentions r where r.invoice_id = i.id), 0)
                  - coalesce((select sum(c.total) from credit_notes c where c.invoice_id = i.id and c.type = 'SALE'), 0),
                  2
                ) < -0.01`,
  },
  {
    module: 'Inventario',
    name: 'Todo ajuste de inventario registra su motivo',
    // Sin motivo el ajuste es una corrección a ciegas (`S-25`); el servicio ya lo exige, la semilla lo
    // verifica para que no entren datos por fuera del flujo.
    sql: `select id from inventory_moves
          where type = 'AJUSTE'
            and (reason_code is null or btrim(reason_code) = '')`,
  },
  {
    module: 'Inventario',
    name: 'Ningún ajuste fuera de tolerancia lo aprobó su propio creador',
    // Segunda aprobación (`S-25`): el almacén conserva el permiso, pero un faltante grande necesita
    // otra persona.
    sql: `select id from inventory_moves
          where requires_second_approval = true
            and status = 'APPROVED'
            and approved_by is not null
            and approved_by = user_id`,
  },
  {
    module: 'Inventario',
    name: 'Los productos con lotes tienen lotes y su stock está identificado por lote',
    sql: `select p.id
          from products p
          where p.has_batches = true
            and not exists (select 1 from product_batches b where b.product_id = p.id)
          union all
          select s.id
          from stock s
          join products p on p.id = s.product_id
          where p.has_batches = true
            and s.batch_id is null`,
  },
  {
    module: 'Inventario',
    name: 'Ninguna salida despacha un lote vencido o bloqueado',
    // El despacho valida el vencimiento al crear el documento (`S-26`); el gate comprueba que ningún
    // movimiento aprobado haya dejado salir mercancía vencida o de un lote bloqueado.
    sql: `select m.id
          from inventory_moves m
          join inventory_move_lines l on l.move_id = m.id
          join product_batches b on b.id = l.batch_id
          where m.type = 'SALIDA'
            and (b.is_active = false or (b.expiration_date is not null and b.expiration_date < current_date))`,
  },
  {
    module: 'Inventario',
    name: 'El despacho fuera de FEFO registra su motivo',
    sql: `select id from inventory_moves
          where fefo_override = true
            and (fefo_override_reason is null or btrim(fefo_override_reason) = '')`,
  },
  {
    module: 'Inventario',
    name: 'Ningún documento cerrado conserva una reserva de lote activa',
    // La reserva vive mientras la salida está en trámite (`S-26`); al aprobar o rechazar se libera.
    sql: `select r.id
          from inventory_batch_reservations r
          join inventory_moves m on m.id = r.move_id
          where r.status = 'ACTIVE'
            and m.status <> 'EN_TRAMITE'`,
  },
  {
    module: 'Inventario',
    name: 'Las reservas activas no exceden la existencia física del lote',
    sql: `select r.batch_id
          from (
            select warehouse_id, product_id, batch_id, sum(quantity) as reserved
            from inventory_batch_reservations
            where status = 'ACTIVE'
            group by warehouse_id, product_id, batch_id
          ) r
          left join stock s
            on s.warehouse_id = r.warehouse_id
           and s.product_id = r.product_id
           and s.batch_id = r.batch_id
          where coalesce(s.quantity, 0) < r.reserved`,
  },
  {
    module: 'Referencias',
    name: 'No queda ningún huérfano en las relaciones declaradas',
    // Un huérfano sólo es posible si la FK falta o está deshabilitada; se comprueba explícitamente
    // en los documentos, que son los que más crecen.
    sql: `select 'invoices->partners' as relacion, i.id
          from invoices i
          where not exists (select 1 from partners p where p.id = i.partner_id)
          union all
          select 'invoices->branches', i.id
          from invoices i
          where not exists (select 1 from branches b where b.id = i.branch_id)
          union all
          select 'invoice_items->products', ii.id
          from invoice_items ii
          where not exists (select 1 from products p where p.id = ii.product_id)
          union all
          select 'payments->payment_methods', p.id
          from payments p
          where not exists (select 1 from payment_methods m where m.id = p.method_id)
          union all
          select 'payment_allocations->payments', pa.id
          from payment_allocations pa
          where not exists (select 1 from payments p where p.id = pa.payment_id)
          union all
          select 'stock->warehouses', s.id
          from stock s
          where not exists (select 1 from warehouses w where w.id = s.warehouse_id)`,
  },
];

export interface IntegrityFailure {
  module: string;
  name: string;
  rows: number;
}

export interface IntegrityReport {
  passed: boolean;
  total: number;
  failures: IntegrityFailure[];
}

/** Ejecuta todos los chequeos y devuelve el reporte (sin lanzar). */
export async function auditIntegrity(): Promise<IntegrityReport> {
  const failures: IntegrityFailure[] = [];

  for (const check of INTEGRITY_CHECKS) {
    const result = await db.execute(sql.raw(check.sql));
    const rows =
      (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
    const count = Array.isArray(rows) ? rows.length : 0;
    if (count > 0) {
      failures.push({ module: check.module, name: check.name, rows: count });
    }
  }

  return { passed: failures.length === 0, total: INTEGRITY_CHECKS.length, failures };
}

/** Lanza si la base queda incoherente: la semilla no debe terminar con datos rotos. */
export async function assertIntegrity(): Promise<void> {
  const report = await auditIntegrity();
  if (report.passed) {
    console.log(`Integridad OK: ${report.total} reglas verificadas`);
    return;
  }

  const detail = report.failures
    .map(failure => `  - [${failure.module}] ${failure.name}: ${failure.rows} fila(s)`)
    .join('\n');
  throw new Error(`La base quedó incoherente (${report.failures.length} reglas):\n${detail}`);
}
