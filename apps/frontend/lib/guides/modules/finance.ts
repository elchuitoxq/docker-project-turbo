import { PERMISSIONS } from '@/lib/permissions';
import type { GuideModule } from '../types';

export const FINANCE_GUIDE: GuideModule = {
  id: 'finance',
  title: 'Finanzas',
  description:
    'Ciclo documental completo: emitir, cobrar, pagar, conciliar y cerrar. Cada pantalla responde a un permiso propio para separar emisión, aprobación y registro.',
  href: '/dashboard/finance',
  permission: PERMISSIONS.FINANCE.VIEW,
  icon: 'Banknote',
  submodules: [
    {
      id: 'invoices',
      title: 'Facturación',
      href: '/dashboard/finance/invoices',
      summary:
        'Facturas de venta en moneda del documento, con numeración fiscal, impuestos y retenciones.',
      viewPermission: PERMISSIONS.FINANCE.INVOICES.VIEW,
      actions: [
        { label: 'Consultar facturas', permission: PERMISSIONS.FINANCE.INVOICES.VIEW },
        { label: 'Crear borrador', permission: PERMISSIONS.FINANCE.INVOICES.CREATE },
        { label: 'Editar borrador', permission: PERMISSIONS.FINANCE.INVOICES.EDIT },
        { label: 'Publicar (emitir)', permission: PERMISSIONS.FINANCE.INVOICES.POST },
        { label: 'Anular', permission: PERMISSIONS.FINANCE.INVOICES.VOID },
      ],
      steps: [
        'Crea la factura: cliente, sucursal, moneda y tasa del documento.',
        'Agrega líneas con producto, cantidad, precio e impuesto.',
        'Revisa los totales y guarda: la factura queda en Borrador.',
        'Publica la factura para asignar número fiscal y afectar inventario y contabilidad.',
        'Si hay un error después de publicar, anúlala y emite una nueva.',
      ],
      rules: [
        'Estados: Borrador → Publicada → Anulada. Sólo el Borrador es editable.',
        'El número fiscal se asigna al publicar; no se reutiliza al anular.',
        'La tasa de cambio se congela en el documento: no se recalcula después.',
        'Crear no es emitir: `finance:invoices:post` es un permiso independiente.',
      ],
      pitfalls: [
        {
          symptom: 'No puedo editar una factura ya emitida',
          cause: 'La API sólo permite editar documentos en Borrador.',
        },
        {
          symptom: 'Falta el botón Publicar',
          cause: 'Tu rol no tiene `finance:invoices:post`.',
        },
      ],
      caution: 'Anular una factura publicada es irreversible y queda registrado en auditoría.',
    },
    {
      id: 'payables',
      title: 'Cuentas por pagar',
      href: '/dashboard/finance/payables',
      summary:
        'Obligaciones con proveedores derivadas de compras, con vencimiento y estado de pago.',
      viewPermission: PERMISSIONS.FINANCE.PAYABLES.VIEW,
      actions: [
        { label: 'Consultar cuentas por pagar', permission: PERMISSIONS.FINANCE.PAYABLES.VIEW },
        { label: 'Registrar pago', permission: PERMISSIONS.FINANCE.PAYMENTS.CREATE },
      ],
      steps: [
        'Filtra por vencidas para priorizar la cobranza del proveedor.',
        'Verifica la factura de origen antes de pagar.',
        'Registra el pago y confirma que la cuota pasa a Pagada o Parcial.',
      ],
      rules: [
        'Estados: Pendiente → Parcial → Pagada; Vencida es un estado derivado por fecha.',
        'Ver CxP no implica poder pagar: el pago requiere `finance:payments:create`.',
        'El saldo se calcula sobre el documento, no sobre el total de la compra.',
      ],
      pitfalls: [
        {
          symptom: 'No aparece el botón Pagar',
          cause: 'Falta `finance:payments:create`.',
        },
      ],
    },
    {
      id: 'payments',
      title: 'Pagos y cobros',
      href: '/dashboard/finance/payables',
      summary:
        'Aplicación de dinero a documentos: define cuenta bancaria, método, referencia y moneda.',
      viewPermission: PERMISSIONS.FINANCE.PAYMENTS.VIEW,
      actions: [
        { label: 'Consultar pagos', permission: PERMISSIONS.FINANCE.PAYMENTS.VIEW },
        { label: 'Registrar pago', permission: PERMISSIONS.FINANCE.PAYMENTS.CREATE },
        { label: 'Anular pago', permission: PERMISSIONS.FINANCE.PAYMENTS.VOID },
      ],
      steps: [
        'Elige el documento a aplicar y la cuenta bancaria de salida.',
        'Indica método, referencia y monto (puede ser parcial).',
        'Confirma el pago: el saldo del documento y de la cuenta se actualizan.',
        'Si hubo error, anula el pago antes de conciliar.',
      ],
      rules: [
        'Un pago anulado libera el saldo del documento pero queda en el histórico.',
        'La cuenta bancaria debe estar en la moneda del pago.',
        'Anular no es editar: no existe modificación de pagos registrados.',
      ],
      pitfalls: [
        {
          symptom: 'El saldo del documento no baja',
          cause: 'El pago quedó en otra moneda o no se aplicó al documento.',
        },
      ],
      caution: 'Anular un pago afecta el saldo bancario: hazlo sólo con el extracto a la vista.',
    },
    {
      id: 'credit-notes',
      title: 'Notas de crédito',
      href: '/dashboard/finance/credit-notes',
      summary:
        'Documentos que revierten total o parcialmente una factura, con impacto fiscal y contable.',
      viewPermission: PERMISSIONS.FINANCE.CREDIT_NOTES.VIEW,
      actions: [
        { label: 'Consultar notas', permission: PERMISSIONS.FINANCE.CREDIT_NOTES.VIEW },
        { label: 'Crear y aplicar nota', permission: PERMISSIONS.FINANCE.CREDIT_NOTES.MANAGE },
      ],
      steps: [
        'Selecciona la factura afectada y el motivo.',
        'Indica líneas o monto a revertir.',
        'Publica la nota: pasa a Publicada y luego a Aplicada sobre el saldo.',
      ],
      rules: [
        'Estados: Borrador → Publicada → Aplicada / Anulada.',
        'No puede revertirse más de lo facturado.',
        'La nota debe referenciar la factura original.',
      ],
      pitfalls: [
        {
          symptom: 'La nota no descuenta el saldo del cliente',
          cause: 'La nota quedó en Borrador o no fue aplicada.',
        },
      ],
    },
    {
      id: 'loans',
      title: 'Préstamos',
      href: '/dashboard/finance/loans',
      summary: 'Créditos otorgados o recibidos con su plan de cuotas y seguimiento de saldo.',
      viewPermission: PERMISSIONS.FINANCE.LOANS.VIEW,
      actions: [
        { label: 'Consultar préstamos', permission: PERMISSIONS.FINANCE.LOANS.VIEW },
        { label: 'Gestionar préstamo', permission: PERMISSIONS.FINANCE.LOANS.MANAGE },
      ],
      steps: [
        'Registra el préstamo con monto, tasa y plazo.',
        'Genera el plan de cuotas.',
        'Aprueba el préstamo para que pase a Activo.',
        'Registra los pagos de cada cuota.',
      ],
      rules: [
        'Estados: Pendiente → Activo → Pagado; también Rechazado o Cancelado.',
        'Un préstamo rechazado no genera cuotas exigibles.',
        'El saldo se recalcula con cada pago aplicado.',
      ],
      pitfalls: [
        {
          symptom: 'El préstamo no aparece en la cobranza',
          cause: 'Sigue en estado Pendiente: falta la aprobación.',
        },
      ],
    },
    {
      id: 'treasury',
      title: 'Tesorería',
      href: '/dashboard/finance/treasury',
      summary: 'Posición consolidada de bancos y caja: saldos por cuenta, moneda y sucursal.',
      viewPermission: PERMISSIONS.FINANCE.TREASURY.VIEW,
      actions: [{ label: 'Consultar posición', permission: PERMISSIONS.FINANCE.TREASURY.VIEW }],
      steps: [
        'Revisa el saldo por cuenta y moneda.',
        'Identifica cuentas sin movimientos recientes para conciliar.',
        'Cruza el saldo con el extracto bancario antes de cerrar el día.',
      ],
      rules: [
        'El saldo mostrado es el del sistema, no el del banco.',
        'Cada movimiento de tesorería exige su permiso específico.',
      ],
      pitfalls: [
        {
          symptom: 'El saldo no coincide con el banco',
          cause: 'Hay movimientos sin registrar o pagos sin conciliar.',
        },
      ],
    },
    {
      id: 'treasury-accounts',
      title: 'Cuentas bancarias',
      href: '/dashboard/finance/treasury/accounts',
      summary: 'Alta y mantenimiento de cuentas bancarias con su cuenta contable asociada.',
      viewPermission: PERMISSIONS.FINANCE.TREASURY.VIEW,
      actions: [
        { label: 'Consultar cuentas', permission: PERMISSIONS.FINANCE.TREASURY.VIEW },
        {
          label: 'Crear cuenta bancaria',
          permission: PERMISSIONS.FINANCE.TREASURY.CREATE_ACCOUNT,
        },
      ],
      steps: [
        'Crea la cuenta con banco, número, tipo y moneda.',
        'Asocia la cuenta contable donde se imputarán sus movimientos.',
        'Registra el saldo inicial y confirma la posición en Tesorería.',
      ],
      rules: [
        'La moneda de la cuenta no se cambia una vez tiene movimientos.',
        'Sin cuenta contable asociada, los pagos no generan asiento.',
      ],
      pitfalls: [
        {
          symptom: 'No puedo crear la cuenta',
          cause: 'Falta `finance:treasury:create_account`.',
        },
      ],
    },
    {
      id: 'reconciliation',
      title: 'Conciliación bancaria',
      href: '/dashboard/finance/treasury/reconciliation',
      summary: 'Cruce entre el extracto del banco y los movimientos registrados en el sistema.',
      viewPermission: PERMISSIONS.FINANCE.TREASURY.VIEW,
      actions: [
        { label: 'Consultar conciliación', permission: PERMISSIONS.FINANCE.TREASURY.VIEW },
        { label: 'Conciliar líneas', permission: PERMISSIONS.FINANCE.TREASURY.RECONCILE },
      ],
      steps: [
        'Importa o registra las líneas del extracto.',
        'Revisa las sugerencias de cruce que propone el sistema.',
        'Confirma las coincidencias y deja pendientes las diferencias.',
        'Investiga los pagos no identificados antes de cerrar el período.',
      ],
      rules: [
        'Conciliar no crea movimientos: sólo vincula líneas existentes.',
        'Una línea ya conciliada no se vuelve a cruzar.',
        'El reporte muestra totales y líneas sin conciliar para el cierre.',
      ],
      pitfalls: [
        {
          symptom: 'No hay sugerencias para una línea',
          cause: 'No existe un pago con el mismo monto y fecha cercana registrado.',
        },
      ],
    },
    {
      id: 'petty-cash',
      title: 'Caja chica',
      href: '/dashboard/finance/treasury/petty-cash',
      summary: 'Fondo fijo para gastos menores, con reposiciones y devoluciones controladas.',
      viewPermission: PERMISSIONS.FINANCE.TREASURY.VIEW,
      actions: [
        { label: 'Consultar movimientos', permission: PERMISSIONS.FINANCE.TREASURY.VIEW },
        {
          label: 'Registrar gasto o reposición',
          permission: PERMISSIONS.FINANCE.TREASURY.PETTY_CASH,
        },
      ],
      steps: [
        'Registra el gasto con su comprobante y descripción.',
        'Controla el saldo disponible del fondo.',
        'Solicita la reposición cuando el fondo baje del mínimo operativo.',
      ],
      rules: [
        'Tipos de movimiento: Gasto, Reposición y Devolución.',
        'Todo gasto debe tener comprobante: sin respaldo no se repone.',
      ],
      pitfalls: [
        {
          symptom: 'No puedo registrar gastos',
          cause: 'Falta `finance:treasury:petty-cash`.',
        },
      ],
    },
    {
      id: 'daily-close',
      title: 'Cierre diario',
      href: '/dashboard/finance/daily-close',
      summary:
        'Arqueo del día por sucursal: consolida cobros, pagos y caja antes de bloquear la fecha.',
      viewPermission: PERMISSIONS.FINANCE.TREASURY.DAILY_CLOSE,
      actions: [
        { label: 'Consultar cierres', permission: PERMISSIONS.FINANCE.TREASURY.DAILY_CLOSE },
        { label: 'Cerrar el día', permission: PERMISSIONS.FINANCE.TREASURY.DAILY_CLOSE },
      ],
      steps: [
        'Verifica que todos los cobros y pagos del día estén registrados.',
        'Confirma el arqueo contra la caja y los bancos.',
        'Cierra el día: el estado pasa de Abierto a Cerrado.',
      ],
      rules: [
        'Estados: Abierto → Cerrado. Un día cerrado no admite movimientos nuevos de esa fecha.',
        'El cierre es por sucursal: no cierra el día de otras sucursales.',
      ],
      pitfalls: [
        {
          symptom: 'No puedo cargar un pago de ayer',
          cause: 'El día ya fue cerrado; requiere reapertura controlada.',
        },
      ],
      caution: 'Cerrar el día bloquea la fecha. Verifica los totales antes de confirmar.',
    },
    {
      id: 'retentions',
      title: 'Retenciones',
      href: '/dashboard/finance/retentions',
      summary:
        'Comprobantes de retención de IVA e ISLR practicadas a proveedores, con su registro fiscal.',
      viewPermission: PERMISSIONS.FINANCE.RETENTIONS.VIEW,
      actions: [
        { label: 'Consultar retenciones', permission: PERMISSIONS.FINANCE.RETENTIONS.VIEW },
      ],
      steps: [
        'Filtra por proveedor y período fiscal.',
        'Verifica que el comprobante corresponda a una factura registrada.',
        'Exporta el libro para declarar en el período.',
      ],
      rules: [
        'La retención sólo existe sobre una factura de compra válida.',
        'El porcentaje se toma de la configuración de retenciones al proveedor.',
        'El registro fiscal es del contador: el gerente sólo consulta.',
      ],
      pitfalls: [
        {
          symptom: 'No aparece la retención de una compra',
          cause: 'La factura del proveedor no fue registrada o el concepto no está configurado.',
        },
      ],
    },
    {
      id: 'accounting',
      title: 'Contabilidad',
      href: '/dashboard/finance/accounting/entries',
      summary:
        'Asientos contables manuales y automáticos, con plan de cuentas y balance de comprobación.',
      viewPermission: PERMISSIONS.FINANCE.ENTRIES.VIEW,
      actions: [
        { label: 'Consultar asientos', permission: PERMISSIONS.FINANCE.ENTRIES.VIEW },
        { label: 'Crear asiento', permission: PERMISSIONS.FINANCE.ENTRIES.CREATE },
        { label: 'Publicar asiento', permission: PERMISSIONS.FINANCE.ENTRIES.POST },
        { label: 'Administrar plan de cuentas', permission: PERMISSIONS.FINANCE.ACCOUNTS.MANAGE },
      ],
      steps: [
        'Crea el asiento con fecha, concepto y líneas al debe y al haber.',
        'Confirma que el asiento cuadre antes de guardarlo.',
        'Publica el asiento para que afecte los saldos contables.',
      ],
      rules: [
        'Estados: Borrador → Publicado / Cancelado. El Borrador no afecta saldos.',
        'Debe y haber deben coincidir exactamente.',
        'No se publica un asiento en un período cerrado.',
      ],
      pitfalls: [
        {
          symptom: 'El asiento no afecta el balance',
          cause: 'Sigue en Borrador: falta publicarlo.',
        },
        {
          symptom: 'No puedo elegir una cuenta',
          cause: 'El plan de cuentas no está cargado o falta `finance:accounts:view`.',
        },
      ],
      caution: 'Publicar un asiento afecta los estados financieros de forma inmediata.',
    },
    {
      id: 'periods',
      title: 'Cierre contable',
      href: '/dashboard/finance/accounting/periods',
      summary:
        'Apertura y cierre de períodos contables. El cierre bloquea la carga de asientos del período.',
      viewPermission: PERMISSIONS.FINANCE.CLOSE.VIEW,
      actions: [
        { label: 'Consultar períodos', permission: PERMISSIONS.FINANCE.CLOSE.VIEW },
        { label: 'Abrir o cerrar período', permission: PERMISSIONS.FINANCE.CLOSE.MANAGE },
      ],
      steps: [
        'Verifica que no queden asientos en Borrador del período.',
        'Revisa el balance de comprobación y los reportes.',
        'Cierra el período cuando todo esté publicado.',
      ],
      rules: [
        'Estados: Abierto → Cerrado. Un período cerrado no admite asientos nuevos.',
        'El período se cierra completo: no por sucursal.',
      ],
      pitfalls: [
        {
          symptom: 'No puedo registrar un asiento de un mes anterior',
          cause: 'Ese período está cerrado.',
        },
      ],
      caution: 'Cerrar un período es irreversible sin intervención del administrador.',
    },
    {
      id: 'reports',
      title: 'Reportes',
      href: '/dashboard/finance/reports',
      summary:
        'Estados financieros y operativos en moneda funcional, con columna de equivalencia en divisa.',
      viewPermission: PERMISSIONS.FINANCE.REPORTS.VIEW,
      actions: [
        { label: 'Consultar y exportar reportes', permission: PERMISSIONS.FINANCE.REPORTS.VIEW },
      ],
      steps: [
        'Elige el reporte y el rango de fechas.',
        'Revisa la moneda funcional y la columna de equivalencia.',
        'Exporta para conciliar o presentar ante la gerencia.',
      ],
      rules: [
        'Los montos se presentan en moneda funcional (VES) con su equivalente en divisa.',
        'Un reporte de un período cerrado no cambia: es la referencia de auditoría.',
      ],
      pitfalls: [
        {
          symptom: 'Los totales difieren de la suma manual',
          cause: 'Hay documentos en Borrador que no están incluidos en el reporte.',
        },
      ],
    },
  ],
};
