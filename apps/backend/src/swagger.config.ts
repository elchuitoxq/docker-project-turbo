import { DocumentBuilder } from '@nestjs/swagger';

export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('ERP Venezuela API')
    .setDescription('API Documentation for the ERP Venezuela system')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addCookieAuth('erp_token', { type: 'apiKey', in: 'cookie' }, 'cookie-auth')
    .addServer('http://localhost:4000', 'Local development')
    .addServer(process.env.API_URL ?? 'https://api.erp-ve.com', 'Production')
    .addTag('auth', 'Authentication endpoints (login, password reset)')
    .addTag('users', 'User management')
    .addTag('billing', 'Billing & Invoicing')
    .addTag('treasury', 'Treasury & Payments')
    .addTag('hr', 'Human Resources')
    .addTag('inventory', 'Inventory Management')
    .addTag('partners', 'Partners (Customers/Suppliers)')
    .addTag('products', 'Product Catalog')
    .addTag('orders', 'Order Management')
    .addTag('settings', 'System Settings')
    .build();
}
