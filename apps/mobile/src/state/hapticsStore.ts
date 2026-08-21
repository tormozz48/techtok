import { create } from 'zustand';
import { storage } from './storage';

const HAPTICS_ENABLED_KEY = 'techtok.hapticsEnabled';

// Absent or unparseable means on: the page-settle tick shipped long before
// this switch did, so an install that never touched it keeps the behaviour
// it already had. Only an explicit opt-out turns it off.
function loadCachedEnabled(): boolean {
  return storage.getString(HAPTICS_ENABLED_KEY) !== 'false';
}

interface HapticsState {
  enabled: boolean;
  load: () => void;
  setEnabled: (enabled: boolean) => void;
}

// Purely local preference, same shape as themeStore (no server sync) —
// `load` re-reads storage once it's hydrated, since the module-level initial
// value above may run before that.
export const useHapticsStore = create<HapticsState>((set) => ({
  enabled: loadCachedEnabled(),

  load: () => set({ enabled: loadCachedEnabled() }),

  setEnabled: (enabled: boolean) => {
    set({ enabled });
    storage.set(HAPTICS_ENABLED_KEY, String(enabled));
  },
}));
