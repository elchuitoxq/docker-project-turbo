import { FINANCE_GUIDE } from './modules/finance';
import { HR_GUIDE } from './modules/hr';
import { INVENTORY_GUIDE } from './modules/inventory';
import { OPERATIONS_GUIDE } from './modules/operations';
import { SETTINGS_GUIDE } from './modules/settings';
import type { GuideModule, GuideModuleId } from './types';

/** Única fuente de verdad del contenido de la guía interactiva. */
export const GUIDE_MODULES: readonly GuideModule[] = [
  INVENTORY_GUIDE,
  OPERATIONS_GUIDE,
  FINANCE_GUIDE,
  HR_GUIDE,
  SETTINGS_GUIDE,
];

export function findGuideModule(id: string): GuideModule | undefined {
  return GUIDE_MODULES.find(module => module.id === id);
}

export function isGuideModuleId(id: string): id is GuideModuleId {
  return GUIDE_MODULES.some(module => module.id === id);
}
