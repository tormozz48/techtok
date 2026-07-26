import { storage } from './storage';
import { useThemeStore } from './themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    storage.clearAll();
    useThemeStore.setState({ mode: 'system' });
  });

  it('defaults to system', () => {
    expect(useThemeStore.getState().mode).toBe('system');
  });

  it('persists the chosen mode and survives a reload of the store', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');

    useThemeStore.setState({ mode: 'system' });
    useThemeStore.getState().load();
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('falls back to system for a corrupt stored value', () => {
    storage.set('techtok.themeMode', 'not-a-mode');
    useThemeStore.getState().load();
    expect(useThemeStore.getState().mode).toBe('system');
  });
});
