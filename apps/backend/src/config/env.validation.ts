/**
 * Validación de variables de entorno al arranque (fail-fast).
 *
 * Sin esto, un `JWT_SECRET` ausente hacía que la aplicación arrancara con un
 * secreto público conocido, permitiendo falsificar tokens.
 */
const WEAK_JWT_SECRETS = new Set([
  'default-secret-key',
  'secret',
  'your-secret-key-here',
  'tu_clave_secreta_super_segura',
]);

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const isProduction = config.NODE_ENV === 'production';

  if (typeof config.DATABASE_URL !== 'string' || config.DATABASE_URL.trim() === '') {
    errors.push('DATABASE_URL es obligatorio');
  }

  if (typeof config.JWT_SECRET !== 'string' || config.JWT_SECRET.trim() === '') {
    errors.push('JWT_SECRET es obligatorio');
  } else {
    if (WEAK_JWT_SECRETS.has(config.JWT_SECRET)) {
      errors.push('JWT_SECRET usa un valor por defecto conocido; definí un secreto propio');
    }
    if (isProduction && config.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET debe tener al menos 32 caracteres en producción');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuración de entorno inválida:\n - ${errors.join('\n - ')}`);
  }

  return {
    ...config,
    PORT: Number(config.PORT ?? 4000),
    JWT_EXPIRES_IN: (config.JWT_EXPIRES_IN as string | undefined) ?? '7d',
  };
}
