import { create } from 'zustand';
import { storage } from './storage';

const HAPTICS_ENABLED_KEY = 'techtok.hapticsEnabled';
const EXPLICIT_OPT_OUT = 'false';

function loadCachedEnabled(): boolean {
  return storage.getString(HAPTICS_ENABLED_KEY) !== EXPLICIT_OPT_OUT;
}

interface HapticsState {
  enabled: boolean;
  load: () => void;
  setEnabled: (enabled: boolean) => void;
}

export const useHapticsStore = create<HapticsState>((set) => ({
  enabled: loadCachedEnabled(),

  load: () => set({ enabled: loadCachedEnabled() }),

  setEnabled: (enabled: boolean) => {
    set({ enabled });
    storage.set(HAPTICS_ENABLED_KEY, String(enabled));
  },
}));
