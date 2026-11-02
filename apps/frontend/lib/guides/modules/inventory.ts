import { PERMISSIONS } from '@/lib/permissions';
import type { GuideModule } from '../types';

export const INVENTORY_GUIDE: GuideModule = {
  id: 'inventory',
  title: 'Inventario',
  description:
    'Catálogo, existencias y trazabilidad del movimiento físico. Aquí se controla qué hay, dónde está y quién lo movió.',
  href: '/dashboard/inventory',
  permission: PERMISSIONS.INVENTORY.VIEW,
  icon: 'Warehouse',
  submodules: [
    {
      id: 'products',
      title: 'Productos',
      href: '/dashboard/inventory/products',
      summary:
        'Catálogo maestro de artículos: SKU, unidad de medida, costo, precio, impuesto y stock mínimo.',
      viewPermission: PERMISSIONS.INVENTORY.PRODUCTS.VIEW,
      actions: [
        { label: 'Consultar el catálogo', permission: PERMISSIONS.INVENTORY.PRODUCTS.VIEW },
        { label: 'Crear producto', permission: PERMISSIONS.INVENTORY.PRODUCTS.CREATE },
        { label: 'Editar producto', permission: PERMISSIONS.INVENTORY.PRODUCTS.EDIT },
        { label: 'Eliminar producto', permission: PERMISSIONS.INVENTORY.PRODUCTS.DELETE },
      ],
      steps: [
        'Verifica que el SKU no exista: se usa como referencia en ventas, compras y kardex.',
        'Crea el producto con nombre, unidad de medida y stock mínimo.',
        'Define costo, precio de venta e impuesto aplicable.',
        'Guarda y confirma que aparece en Stock y en el selector de Ventas.',
      ],
      rules: [
        'El SKU es único: dos productos con el mismo código rompen la trazabilidad del kardex.',
        'El stock mínimo alimenta la alerta de reposición en la pantalla de Stock.',
        'Un producto con movimientos no se elimina: se desactiva para conservar el histórico.',
      ],
      pitfalls: [
        {
          symptom: 'El producto no aparece al facturar',
          cause: 'Falta `inventory:products:view` o el producto está inactivo.',
        },
        {
          symptom: 'La alerta de reposición nunca se dispara',
          cause: 'El stock mínimo quedó en cero o vacío.',
        },
      ],
      caution: 'Eliminar un producto con historial deja movimientos huérfanos. Desactívalo.',
    },
    {
      id: 'stock',
      title: 'Stock por almacén',
      href: '/dashboard/inventory/stock',
      summary:
        'Existencias consolidadas por almacén, con alerta cuando la cantidad cae por debajo del mínimo.',
      viewPermission: PERMISSIONS.INVENTORY.PRODUCTS.VIEW,
      actions: [
        { label: 'Consultar existencias', permission: PERMISSIONS.INVENTORY.PRODUCTS.VIEW },
      ],
      steps: [
        'Selecciona el almacén que quieres revisar.',
        'Activa el filtro «sólo bajo mínimo» para ver riesgos de quiebre.',
        'Cruza la alerta con Movimientos para saber si la caída fue por venta o por ajuste.',
      ],
      rules: [
        'El stock es de sólo lectura: se modifica únicamente registrando movimientos aprobados.',
        'El mínimo se calcula desde el producto, no desde el almacén.',
      ],
      pitfalls: [
        {
          symptom: 'El selector de almacenes está vacío',
          cause:
            'Tu rol no tiene `inventory:warehouses:view`; la pantalla usa las opciones permitidas.',
        },
      ],
    },
    {
      id: 'warehouses',
      title: 'Almacenes',
      href: '/dashboard/inventory/warehouses',
      summary:
        'Ubicaciones físicas donde se guarda el inventario. Cada movimiento entra o sale de un almacén.',
      viewPermission: PERMISSIONS.INVENTORY.WAREHOUSES.VIEW,
      actions: [
        { label: 'Consultar almacenes', permission: PERMISSIONS.INVENTORY.WAREHOUSES.VIEW },
        { label: 'Crear almacén', permission: PERMISSIONS.INVENTORY.WAREHOUSES.CREATE },
        { label: 'Editar almacén', permission: PERMISSIONS.INVENTORY.WAREHOUSES.EDIT },
      ],
      steps: [
        'Crea el almacén con un nombre que identifique la ubicación real.',
        'Asócialo a la sucursal correcta.',
        'Verifica que aparezca en el filtro de Stock y en el formulario de Movimientos.',
      ],
      rules: [
        'Un almacén pertenece a una sucursal: no se comparte entre sucursales.',
        'Renombrar un almacén no altera su histórico de movimientos.',
      ],
      pitfalls: [
        {
          symptom: 'No puedo registrar un movimiento',
          cause: 'No hay almacén creado para la sucursal activa.',
        },
      ],
    },
    {
      id: 'moves',
      title: 'Movimientos',
      href: '/dashboard/inventory/moves',
      summary:
        'Entradas, salidas, transferencias y ajustes. Es el único mecanismo que altera el stock.',
      viewPermission: PERMISSIONS.INVENTORY.MOVES.VIEW,
      actions: [
        { label: 'Consultar el kardex', permission: PERMISSIONS.INVENTORY.MOVES.VIEW },
        { label: 'Registrar movimiento', permission: PERMISSIONS.INVENTORY.MOVES.CREATE },
        { label: 'Aprobar o rechazar', permission: PERMISSIONS.INVENTORY.MOVES.APPROVE },
      ],
      steps: [
        'Registra el movimiento en estado Borrador con su motivo y líneas de producto.',
        'Envía el borrador a revisión: quien lo creó no debe aprobarlo.',
        'El aprobador confirma: el stock se afecta en ese momento, no al crear el borrador.',
        'Consulta el resultado en Stock por almacén.',
      ],
      rules: [
        'Estados: Borrador → Aprobado / Rechazado / Cancelado. Sólo «Aprobado» mueve stock.',
        'Un movimiento rechazado o cancelado no se reabre: se registra uno nuevo.',
        'La segregación de funciones exige que la aprobación sea de otro usuario.',
      ],
      pitfalls: [
        {
          symptom: 'El stock no cambia aunque el movimiento existe',
          cause: 'El movimiento sigue en Borrador: falta la aprobación.',
        },
        { symptom: 'No veo el botón Aprobar', cause: 'Falta `inventory:moves:approve`.' },
      ],
      caution: 'Aprobar un ajuste altera el stock de forma inmediata y queda auditado.',
    },
  ],
};
