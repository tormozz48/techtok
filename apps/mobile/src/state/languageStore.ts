import { isLanguage, type Language } from '@techtok/shared';
import { create } from 'zustand';
import { fetchMe, putLanguage } from '@/api/client';
import { storage } from './storage';

const LANGUAGE_KEY = 'techtok.language';

function loadCachedLanguage(): Language {
  const raw = storage.getString(LANGUAGE_KEY);
  return raw && isLanguage(raw) ? raw : 'en';
}

function saveCachedLanguage(language: Language): void {
  storage.set(LANGUAGE_KEY, language);
}

interface LanguageState {
  language: Language;
  isLoading: boolean;
  load: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: loadCachedLanguage(),
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const me = await fetchMe();
      saveCachedLanguage(me.language);
      set({ language: me.language });
    } finally {
      set({ isLoading: false });
    }
  },

  setLanguage: async (language: Language) => {
    set({ language });
    saveCachedLanguage(language);
    const me = await putLanguage(language);
    saveCachedLanguage(me.language);
    set({ language: me.language });
  },
}));
