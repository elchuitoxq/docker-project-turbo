import { SetMetadata } from '@nestjs/common';
import { SKIP_BRANCH_KEY } from '../branch/branch-context.constants';

/**
 * Exime al endpoint del contexto de sucursal.
 * Sólo para endpoints de arranque (sesión, catálogos de empresa, salud):
 * el resto de la API opera siempre con una sucursal validada.
 */
export const SkipBranch = () => SetMetadata(SKIP_BRANCH_KEY, true);
