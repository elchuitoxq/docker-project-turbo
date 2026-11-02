import { DocumentBuilder } from '@nestjs/swagger';

export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('ERP Venezuela API')
    .setDescription(
      [
        'API del ERP Venezuela: ventas, compras, tesorería, contabilidad, inventario, nómina y fiscalidad.',
        '',
        '**Autenticación**',
        '- `POST /v1/auth/login` devuelve un JWT y además lo deja en la cookie `erp_token`.',
        '- Envía el token como `Authorization: Bearer <token>` o reutiliza la cookie.',
        '- Los endpoints marcados con el candado exigen sesión válida; cada operación indica el permiso RBAC requerido.',
        '',
        '**Sucursal activa**',
        '- Los endpoints operativos trabajan sobre la sucursal indicada en la cabecera `x-branch-id`.',
        '- Si el usuario tiene una sola sucursal asignada, la cabecera es opcional; con varias es obligatoria.',
        '- Los maestros compartidos (monedas, bancos, roles, empresas/sucursales) no dependen de sucursal.',
        '',
        '**Convenciones**',
        '- Importes monetarios en la moneda de la sucursal; fechas en ISO 8601 (`YYYY-MM-DD` o timestamp completo).',
        '- Los errores siguen el formato `{ statusCode, error, message, timestamp, path }`.',
        '- Los borrados son lógicos (`isActive = false`), salvo que la operación indique lo contrario.',
      ].join('\n')
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWT devuelto por `POST /v1/auth/login`',
        in: 'header',
      },
      'bearer'
    )
    .addCookieAuth(
      'erp_token',
      { type: 'apiKey', in: 'cookie', description: 'Cookie httpOnly emitida en el login' },
      'cookie-auth'
    )
    .addServer('http://localhost:4000', 'Local development')
    .addServer(process.env.API_URL ?? 'https://api.erp-ve.com', 'Production')
    .addTag('health', 'Health checks y estado de la tasa de cambio')
    .addTag('auth', 'Autenticación (login, perfil, recuperación de contraseña)')
    .addTag('users', 'Usuarios, roles asignados y sucursales por usuario')
    .addTag('roles', 'Roles y catálogo de permisos RBAC')
    .addTag('branches', 'Empresas y sucursales; contexto de sucursal del usuario')
    .addTag('products', 'Catálogo de productos y categorías')
    .addTag('partners', 'Clientes y proveedores')
    .addTag('orders', 'Pedidos de venta: borrador, confirmación, facturación y cancelación')
    .addTag(
      'billing',
      'Facturación de venta y compra, cuentas por pagar y retenciones al proveedor'
    )
    .addTag('credit-notes', 'Notas de crédito de venta y compra')
    .addTag('treasury', 'Tesorería: pagos, bancos, conciliación, caja chica y cierres')
    .addTag('inventory', 'Almacenes, movimientos de inventario, stock y lotes')
    .addTag('accounting', 'Plan de cuentas, asientos contables y períodos')
    .addTag(
      'reports',
      'Estados financieros y reportes fiscales (libros, retenciones, exportaciones)'
    )
    .addTag('hr', 'Recursos Humanos: empleados, nómina, vacaciones, prestaciones y liquidaciones')
    .addTag('loans', 'Préstamos: solicitud, aprobación y amortización')
    .addTag('bi', 'Indicadores y actividad reciente del panel')
    .addTag('audit', 'Pista de auditoría de cambios sensibles')
    .addTag('settings-banks', 'Catálogo de bancos')
    .addTag('settings-currencies', 'Monedas y tasas de cambio (BCV y override manual)')
    .addTag('settings-tax-concepts', 'Conceptos de impuestos y retenciones')
    .build();
}
