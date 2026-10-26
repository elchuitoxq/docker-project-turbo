import type { Request } from 'express';

/**
 * Nombre de la cookie de sesión. Debe coincidir con `AUTH_COOKIE` en
 * `apps/frontend/middleware.ts`.
 */
export const AUTH_COOKIE = 'erp_token';

function attributes(secure: boolean): string[] {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) attrs.push('Secure');
  return attrs;
}

export function buildAuthCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  return [`${AUTH_COOKIE}=${token}`, ...attributes(secure), `Max-Age=${maxAgeSeconds}`].join('; ');
}

export function buildClearedAuthCookie(secure: boolean): string {
  return [`${AUTH_COOKIE}=`, ...attributes(secure), 'Max-Age=0'].join('; ');
}

export function readAuthCookie(req: Request | undefined): string | null {
  const header = req?.headers?.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === AUTH_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}
