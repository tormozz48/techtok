import { create } from 'zustand';
import { fetchMe, putMutedSources } from '@/api/client';
import { logError, logEvent, serializeError } from './eventsQueue';
import { storage } from './storage';

const MUTED_SOURCES_KEY = 'techtok.mutedSources';

interface MutedSourcesState {
  mutedSources: string[];
  isLoading: boolean;
  load: () => Promise<void>;
  setMutedSources: (sourceIds: string[]) => Promise<void>;
}

export const useMutedSourcesStore = create<MutedSourcesState>((set) => ({
  mutedSources: loadCachedMutedSources(),
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const me = await fetchMe();
      saveCachedMutedSources(me.mutedSources);
      set({ mutedSources: me.mutedSources });
    } catch (error) {
      logError('muted sources load failed', serializeError(error), error);
    } finally {
      set({ isLoading: false });
    }
  },

  setMutedSources: async (sourceIds: string[]) => {
    set({ mutedSources: sourceIds });
    saveCachedMutedSources(sourceIds);
    logEvent('muted_sources_changed', { sourceIds });
    try {
      const me = await putMutedSources(sourceIds);
      saveCachedMutedSources(me.mutedSources);
      set({ mutedSources: me.mutedSources });
    } catch (error) {
      logError('muted sources update failed', serializeError(error), error);
      throw error;
    }
  },
}));

function loadCachedMutedSources(): string[] {
  const raw = storage.getString(MUTED_SOURCES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveCachedMutedSources(sourceIds: string[]): void {
  storage.set(MUTED_SOURCES_KEY, JSON.stringify(sourceIds));
}
