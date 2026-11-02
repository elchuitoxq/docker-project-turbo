import { PERMISSIONS } from '@/lib/permissions';
import type { GuideModule } from '../types';

export const OPERATIONS_GUIDE: GuideModule = {
  id: 'operations',
  title: 'Operaciones',
  description:
    'Relación comercial: terceros, ventas, compras y pedidos. Es el origen de los documentos que después impactan inventario y finanzas.',
  href: '/dashboard/operations',
  permission: PERMISSIONS.OPERATIONS.VIEW,
  icon: 'Briefcase',
  submodules: [
    {
      id: 'partners',
      title: 'Clientes y Proveedores',
      href: '/dashboard/operations/partners',
      summary:
        'Terceros con los que opera la empresa, con sus datos fiscales y su estado de cuenta.',
      viewPermission: PERMISSIONS.OPERATIONS.PARTNERS.VIEW,
      actions: [
        { label: 'Consultar terceros', permission: PERMISSIONS.OPERATIONS.PARTNERS.VIEW },
        { label: 'Crear tercero', permission: PERMISSIONS.OPERATIONS.PARTNERS.CREATE },
        { label: 'Editar tercero', permission: PERMISSIONS.OPERATIONS.PARTNERS.EDIT },
        { label: 'Eliminar tercero', permission: PERMISSIONS.OPERATIONS.PARTNERS.DELETE },
        { label: 'Ver estado de cuenta', permission: PERMISSIONS.OPERATIONS.PARTNERS.STATEMENT },
      ],
      steps: [
        'Crea el tercero indicando si es cliente, proveedor o ambos.',
        'Completa la identificación fiscal: es obligatoria para facturar y retener.',
        'Verifica el saldo en el estado de cuenta antes de otorgar crédito.',
        'Asócialo a la sucursal donde opera.',
      ],
      rules: [
        'La identificación fiscal no se duplica entre terceros.',
        'Los datos fiscales mal cargados invalidan la factura y la retención.',
        'Un tercero con documentos emitidos no se elimina.',
      ],
      pitfalls: [
        {
          symptom: 'No aparece el botón de estado de cuenta',
          cause: 'Falta `operations:partners:statement`.',
        },
      ],
      caution: 'Eliminar un tercero con documentos asociados rompe el histórico contable.',
    },
    {
      id: 'sales',
      title: 'Ventas',
      href: '/dashboard/operations/sales',
      summary:
        'Órdenes de venta y su paso a factura. Conecta al cliente con el inventario y con la cobranza.',
      viewPermission: PERMISSIONS.OPERATIONS.SALES.VIEW,
      actions: [
        { label: 'Consultar ventas', permission: PERMISSIONS.OPERATIONS.SALES.VIEW },
        { label: 'Registrar venta', permission: PERMISSIONS.OPERATIONS.SALES.CREATE },
        { label: 'Editar venta', permission: PERMISSIONS.OPERATIONS.SALES.EDIT },
      ],
      steps: [
        'Selecciona cliente y almacén de despacho.',
        'Agrega líneas: producto, cantidad, precio y descuento.',
        'Guarda la venta y genera la factura en estado Borrador.',
        'Publica la factura cuando corresponda para afectar stock e impuestos.',
      ],
      rules: [
        'No se vende más cantidad de la disponible sin un ajuste de inventario previo.',
        'El precio se toma del catálogo; cambiarlo requiere justificación.',
        'Emitir la factura es un permiso distinto de crearla (`finance:invoices:post`).',
      ],
      pitfalls: [
        {
          symptom: 'No puedo facturar la venta que registré',
          cause: 'Falta `finance:invoices:create` o `finance:invoices:view`.',
        },
      ],
    },
    {
      id: 'purchases',
      title: 'Compras',
      href: '/dashboard/operations/purchases',
      summary: 'Compras a proveedores y su impacto en cuentas por pagar e inventario de entrada.',
      viewPermission: PERMISSIONS.OPERATIONS.PURCHASES.VIEW,
      actions: [
        { label: 'Consultar compras', permission: PERMISSIONS.OPERATIONS.PURCHASES.VIEW },
        { label: 'Registrar compra', permission: PERMISSIONS.OPERATIONS.PURCHASES.CREATE },
        { label: 'Editar compra', permission: PERMISSIONS.OPERATIONS.PURCHASES.EDIT },
      ],
      steps: [
        'Selecciona el proveedor y la fecha del documento.',
        'Agrega las líneas con costo e impuestos.',
        'Registra la compra y verifica la entrada en Movimientos de inventario.',
        'Revisa la cuota generada en Cuentas por pagar.',
      ],
      rules: [
        'El costo de compra actualiza el costo del producto.',
        'Una compra confirmada genera una cuenta por pagar con su vencimiento.',
        'Ver compras no habilita registrar pagos (`finance:payments:create`).',
      ],
      pitfalls: [
        {
          symptom: 'La compra no aparece en Cuentas por pagar',
          cause: 'La compra no fue confirmada o te falta `finance:payables:view`.',
        },
      ],
    },
    {
      id: 'orders',
      title: 'Pedidos',
      href: '/dashboard/operations/orders',
      summary: 'Solicitudes en curso con ciclo de vida propio: se confirman, procesan y completan.',
      viewPermission: PERMISSIONS.OPERATIONS.ORDERS.VIEW,
      actions: [
        { label: 'Consultar pedidos', permission: PERMISSIONS.OPERATIONS.ORDERS.VIEW },
        { label: 'Crear pedido', permission: PERMISSIONS.OPERATIONS.ORDERS.CREATE },
        { label: 'Editar pedido', permission: PERMISSIONS.OPERATIONS.ORDERS.EDIT },
        { label: 'Aprobar pedido', permission: PERMISSIONS.OPERATIONS.ORDERS.APPROVE },
      ],
      steps: [
        'Crea el pedido en Borrador con cliente y líneas.',
        'Confírmalo: pasa a Confirmado y queda listo para preparación.',
        'Procesa el despacho y márcalo Completado.',
        'Si no continúa, cancélalo con motivo.',
      ],
      rules: [
        'Estados: Borrador → Confirmado → En proceso → Completado / Cancelado.',
        'Aprobar es un permiso separado de crear: el vendedor no se autoaprueba.',
        'Un pedido cancelado no se reabre.',
      ],
      pitfalls: [
        {
          symptom: 'El pedido quedó en Borrador y nadie lo prepara',
          cause: 'No se confirmó o falta `operations:orders:approve`.',
        },
      ],
    },
  ],
};
