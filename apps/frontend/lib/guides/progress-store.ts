import { readProgress, toggleReviewed, writeProgress } from './progress';

/**
 * Progreso de lectura como store externo (`useSyncExternalStore`).
 *
 * Leer `localStorage` dentro de un efecto obligaría a un render en cascada; el store expone una
 * instantánea estable y notifica sólo cuando el usuario marca un submódulo.
 */
const EMPTY: readonly string[] = [];
const snapshots = new Map<string, string[]>();
const listeners = new Map<string, Set<() => void>>();

function snapshotFor(moduleId: string): string[] {
  const cached = snapshots.get(moduleId);
  if (cached) return cached;
  const ids = typeof window === 'undefined' ? [] : readProgress(window.localStorage, moduleId);
  snapshots.set(moduleId, ids);
  return ids;
}

function emit(moduleId: string): void {
  for (const listener of listeners.get(moduleId) ?? []) listener();
}

export function getProgressSnapshot(moduleId: string): string[] {
  return snapshotFor(moduleId);
}

export function getProgressServerSnapshot(): string[] {
  return EMPTY as string[];
}

export function subscribeProgress(moduleId: string, listener: () => void): () => void {
  const set = listeners.get(moduleId) ?? new Set<() => void>();
  listeners.set(moduleId, set);
  set.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.endsWith(moduleId)) return;
    snapshots.delete(moduleId);
    listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    set.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function toggleProgress(moduleId: string, submoduleId: string): void {
  const next = toggleReviewed(snapshotFor(moduleId), submoduleId);
  snapshots.set(moduleId, next);
  if (typeof window !== 'undefined') writeProgress(window.localStorage, moduleId, next);
  emit(moduleId);
}
