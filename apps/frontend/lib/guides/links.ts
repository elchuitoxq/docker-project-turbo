import { GUIDE_MODULES } from './registry';
import type { GuideModule, GuideSubmodule } from './types';

export type GuideTarget = {
  module: GuideModule;
  /** Submódulo cuya pantalla se está viendo, si se pudo determinar. */
  submodule?: GuideSubmodule;
  /** Enlace directo a la guía (con ancla al submódulo). */
  href: string;
};

function normalize(pathname: string): string {
  const clean = pathname.split(/[?#]/)[0];
  return clean.length > 1 ? clean.replace(/\/+$/, '') : clean;
}

/**
 * Traduce la ruta activa al punto de la guía que la explica.
 *
 * Se apoya en el `href` real de cada submódulo en vez de un mapa de rutas paralelo: una pantalla
 * nueva sólo necesita su entrada en el registry. Para fichas de detalle
 * (`/dashboard/finance/invoices/<id>`) gana el `href` más largo que sea prefijo.
 */
export function guideTargetForPath(pathname: string): GuideTarget | null {
  const path = normalize(pathname);

  const guideModule = GUIDE_MODULES.find(
    item => path === `/dashboard/${item.id}` || path.startsWith(`/dashboard/${item.id}/`)
  );
  if (!guideModule) return null;

  let submodule: GuideSubmodule | undefined;
  for (const candidate of guideModule.submodules) {
    const href = normalize(candidate.href);
    if (path === href) {
      submodule = candidate;
      break;
    }
    if (
      path.startsWith(`${href}/`) &&
      (!submodule || href.length > normalize(submodule.href).length)
    ) {
      submodule = candidate;
    }
  }

  return {
    module: guideModule,
    submodule,
    href: submodule
      ? `/dashboard/guides/${guideModule.id}#${submodule.id}`
      : `/dashboard/guides/${guideModule.id}`,
  };
}
