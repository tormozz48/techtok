import { create } from 'zustand';
import { storage } from './storage';

const THEME_MODE_KEY = 'techtok.themeMode';

export type ThemeMode = 'system' | 'light' | 'dark';

function isThemeMode(value: string | undefined): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function loadCachedThemeMode(): ThemeMode {
  const raw = storage.getString(THEME_MODE_KEY);
  return isThemeMode(raw) ? raw : 'system';
}

interface ThemeState {
  mode: ThemeMode;
  load: () => void;
  setMode: (mode: ThemeMode) => void;
}

// Purely local preference (no server sync, unlike languageStore/topicsStore) —
// `load` just re-reads storage once it's hydrated (see state/storage.ts's
// `ready()`), since the module-level initial value above may run before that.
export const useThemeStore = create<ThemeState>((set) => ({
  mode: loadCachedThemeMode(),

  load: () => set({ mode: loadCachedThemeMode() }),

  setMode: (mode: ThemeMode) => {
    set({ mode });
    storage.set(THEME_MODE_KEY, mode);
  },
}));
