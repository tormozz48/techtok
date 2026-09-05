import { create } from 'zustand';
import { logEvent } from './eventsQueue';
import { storage } from './storage';
import { HAPTICS_ENABLED_KEY } from './storageKeys';

const EXPLICIT_OPT_OUT = 'false';

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
    logEvent('haptics_enabled_changed', { enabled });
  },
}));

function loadCachedEnabled(): boolean {
  return storage.getString(HAPTICS_ENABLED_KEY) !== EXPLICIT_OPT_OUT;
}
