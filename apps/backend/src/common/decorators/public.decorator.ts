import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como público. El `JwtAuthGuard` global lo permite sin token.
 * El comportamiento por defecto del backend es **deny-by-default**.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
