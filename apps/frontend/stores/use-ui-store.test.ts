import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './use-ui-store';

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      sidebarOpen: true,
      commandPaletteOpen: false,
      language: 'es-VE',
      hasHydrated: false,
    });
  });

  it('toggleSidebar() flips state', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it('toggleCommandPalette() flips state', () => {
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
  });

  it('setLanguage() changes language', () => {
    useUiStore.getState().setLanguage('en-US');
    expect(useUiStore.getState().language).toBe('en-US');
  });
});
