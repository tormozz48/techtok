import type { Topic } from '@techtok/shared';
import { create } from 'zustand';
import { fetchMe, putTopics } from '@/api/client';
import { storage } from './storage';

const TOPICS_KEY = 'techtok.topics';

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

interface TopicsState {
  topics: Topic[];
  isLoading: boolean;
  load: () => Promise<void>;
  setTopics: (topics: Topic[]) => Promise<void>;
}

export const useTopicsStore = create<TopicsState>((set) => ({
  topics: loadCachedTopics(),
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const me = await fetchMe();
      saveCachedTopics(me.topics);
      set({ topics: me.topics });
    } finally {
      set({ isLoading: false });
    }
  },

  setTopics: async (topics: Topic[]) => {
    set({ topics });
    saveCachedTopics(topics);
    const me = await putTopics(topics);
    saveCachedTopics(me.topics);
    set({ topics: me.topics });
  },
}));
