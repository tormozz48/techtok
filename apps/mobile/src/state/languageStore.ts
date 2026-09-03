import { isLanguage, type Language } from '@techtok/shared';
import { create } from 'zustand';
import { fetchMe, putLanguage } from '@/api/client';
import { logError, logEvent, serializeError } from './eventsQueue';
import { storage } from './storage';

const LANGUAGE_KEY = 'techtok.language';

interface LanguageState {
  language: Language;
  isLoading: boolean;
  load: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  hydrate: () => void;
  adoptServerLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: loadCachedLanguage(),
  isLoading: false,

  hydrate: () => {
    set({ language: loadCachedLanguage() });
  },

  load: async () => {
    get().hydrate();
    set({ isLoading: true });
    try {
      const me = await fetchMe();
      saveCachedLanguage(me.language);
      set({ language: me.language });
    } catch (error) {
      logError('language reconcile failed', serializeError(error), error);
    } finally {
      set({ isLoading: false });
    }
  },

  setLanguage: async (language: Language) => {
    const previous = get().language;
    set({ language, isLoading: true });
    try {
      const me = await putLanguage(language);
      saveCachedLanguage(me.language);
      set({ language: me.language });
      logEvent('language_changed', { language: me.language });
    } catch (error) {
      logError('language update failed', serializeError(error), error);
      if (!(error instanceof Error) || error.name !== 'ZodError') {
        set({ language: previous });
      } else {
        saveCachedLanguage(language);
      }
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  adoptServerLanguage: (language: Language) => {
    if (get().isLoading || get().language === language) return;
    saveCachedLanguage(language);
    set({ language });
    logEvent('language_adopted_from_server', { language });
  },
}));

function loadCachedLanguage(): Language {
  const raw = storage.getString(LANGUAGE_KEY);
  return raw && isLanguage(raw) ? raw : 'en';
}

function saveCachedLanguage(language: Language): void {
  storage.set(LANGUAGE_KEY, language);
}
