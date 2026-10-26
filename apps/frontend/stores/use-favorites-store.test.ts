import { describe, it, expect, beforeEach } from 'vitest';
import { useFavoritesStore } from './use-favorites-store';

describe('useFavoritesStore', () => {
  beforeEach(() => {
    useFavoritesStore.setState({ items: [], hasHydrated: false });
  });

  it('add() adds unique favorites', () => {
    useFavoritesStore.getState().add({ path: '/a', label: 'A' });
    useFavoritesStore.getState().add({ path: '/a', label: 'A again' });
    useFavoritesStore.getState().add({ path: '/b', label: 'B' });
    const items = useFavoritesStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe('A');
  });

  it('remove() deletes by path', () => {
    useFavoritesStore.getState().add({ path: '/a', label: 'A' });
    useFavoritesStore.getState().add({ path: '/b', label: 'B' });
    useFavoritesStore.getState().remove('/a');
    const items = useFavoritesStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].path).toBe('/b');
  });

  it('reorder() moves items', () => {
    useFavoritesStore.getState().add({ path: '/a', label: 'A' });
    useFavoritesStore.getState().add({ path: '/b', label: 'B' });
    useFavoritesStore.getState().add({ path: '/c', label: 'C' });
    useFavoritesStore.getState().reorder(0, 2);
    const items = useFavoritesStore.getState().items;
    expect(items.map(i => i.path)).toEqual(['/b', '/c', '/a']);
  });
});
