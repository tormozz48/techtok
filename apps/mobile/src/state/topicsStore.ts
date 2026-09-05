import type { Topic } from '@techtok/shared';
import { create } from 'zustand';
import { fetchMe, putTopics } from '@/api/client';
import { logError, logEvent, serializeError } from './eventsQueue';
import { storage } from './storage';
import { TOPICS_KEY } from './storageKeys';

interface TopicsState {
  topics: Topic[];
  isLoading: boolean;
  hydrate: () => void;
  load: () => Promise<void>;
  setTopics: (topics: Topic[]) => Promise<void>;
}

export const useTopicsStore = create<TopicsState>((set, get) => ({
  topics: loadCachedTopics(),
  isLoading: false,

  hydrate: () => {
    set({ topics: loadCachedTopics() });
  },

  load: async () => {
    get().hydrate();
    set({ isLoading: true });
    try {
      const me = await fetchMe();
      saveCachedTopics(me.topics);
      set({ topics: me.topics });
    } catch (error) {
      logError('topics load failed', serializeError(error), error);
    } finally {
      set({ isLoading: false });
    }
  },

  setTopics: async (topics: Topic[]) => {
    set({ topics });
    saveCachedTopics(topics);
    logEvent('topics_changed', { topics });
    try {
      const me = await putTopics(topics);
      saveCachedTopics(me.topics);
      set({ topics: me.topics });
    } catch (error) {
      logError('topics update failed', serializeError(error), error);
      throw error;
    }
  },
}));

function loadCachedTopics(): Topic[] {
  const raw = storage.getString(TOPICS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Topic[];
  } catch {
    return [];
  }
}

function saveCachedTopics(topics: Topic[]): void {
  storage.set(TOPICS_KEY, JSON.stringify(topics));
}
