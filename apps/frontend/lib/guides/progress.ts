const PREFIX = 'erp:guides:progress:';

export function progressKey(moduleId: string): string {
  return `${PREFIX}${moduleId}`;
}

/** Lee los submódulos marcados como revisados. Tolerante a datos corruptos. */
export function parseProgress(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function serializeProgress(ids: readonly string[]): string {
  return JSON.stringify([...new Set(ids)]);
}

export function toggleReviewed(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
}

export function readProgress(storage: Storage, moduleId: string): string[] {
  try {
    return parseProgress(storage.getItem(progressKey(moduleId)));
  } catch {
    return [];
  }
}

export function writeProgress(storage: Storage, moduleId: string, ids: readonly string[]): void {
  try {
    storage.setItem(progressKey(moduleId), serializeProgress(ids));
  } catch {
    // Almacenamiento bloqueado (modo privado): el progreso es una comodidad, no un requisito.
  }
}
