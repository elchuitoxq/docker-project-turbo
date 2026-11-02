import { env } from '@/lib/env';
import { useAuthStore } from '@/stores/use-auth-store';
import { useBranchStore } from '@/stores/use-branch-store';

export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Normaliza el mensaje del backend: NestJS devuelve `message` como string o como lista. */
function messageFromBody(body: { message?: string | string[] } | null, fallback: string): string {
  const message = body?.message;
  if (Array.isArray(message)) return message.filter(Boolean).join(' · ') || fallback;
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { currentBranchId } = useBranchStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(currentBranchId ? { 'x-branch-id': currentBranchId } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${env.NEXT_PUBLIC_API_PREFIX}${path}`, {
    ...init,
    headers,
    // La sesión viaja en una cookie httpOnly (no accesible desde JavaScript).
    credentials: 'include',
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
      error?: string;
    } | null;
    throw new ApiError(res.status, messageFromBody(body, res.statusText), body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  /** Respuesta de texto plano (exportaciones CSV): no intenta parsear JSON. */
  getText: async (path: string) => {
    const { currentBranchId } = useBranchStore.getState();
    const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${env.NEXT_PUBLIC_API_PREFIX}${path}`, {
      headers: currentBranchId ? { 'x-branch-id': currentBranchId } : {},
      credentials: 'include',
    });

    if (res.status === 401) {
      useAuthStore.getState().logout();
      throw new ApiError(401, 'Unauthorized');
    }
    if (!res.ok) throw new ApiError(res.status, res.statusText);

    return res.text();
  },
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  request: <T>(path: string, init?: RequestInit) => request<T>(path, init),
};
