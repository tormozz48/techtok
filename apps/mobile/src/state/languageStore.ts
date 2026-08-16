import { isLanguage, type Language } from '@techtok/shared';
import { create } from 'zustand';
import { fetchMe, putLanguage } from '@/api/client';
import { logError } from './eventsQueue';
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
  /** Adopts the language the server says it actually rendered the feed with
   * (D79) — the reconciliation channel that can't be skipped, since the feed
   * request fires on every launch, unlike `load()`'s separate `GET /v1/me`
   * (which a warm resume never re-runs — see _layout.tsx). No-ops when
   * already in sync or when a local `setLanguage` write is still in flight,
   * so it can never revert a change the user just made. Never writes back to
   * the server: this IS the server's value. */
  adoptServerLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: loadCachedLanguage(),
  isLoading: false,

  load: async () => {
    // Re-read now that state/storage.ts's ready() has resolved — the
    // module-level initial value above runs at import time, before
    // AsyncStorage is hydrated, so it's always the 'en' fallback (same fix
    // as themeStore.ts's loadCachedThemeMode() re-read). Without this, a
    // persisted language choice only ever came back via the network call
    // below, which _layout.tsx used to fire before auth had restored.
    set({ language: loadCachedLanguage() });
    set({ isLoading: true });
    try {
      const me = await fetchMe();
      saveCachedLanguage(me.language);
      set({ language: me.language });
    } catch (error) {
      // Silent failure here previously left the store stranded on whatever
      // it had cached (often the 'en' fallback) with no trace — this is the
      // one place that would otherwise show up as "settings say X, server
      // says Y" with nothing in the logs to explain why.
      logError('language reconcile failed', { message: String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  setLanguage: async (language: Language) => {
    const previous = get().language;
    // Optimistic in-memory only — deliberately not persisted to storage yet.
    // The in-memory value is recoverable via the rollback below; a storage
    // write is what would survive a kill mid-request and turn a failed PUT
    // into a silent, permanent client/server divergence.
    set({ language, isLoading: true });
    try {
      const me = await putLanguage(language);
      saveCachedLanguage(me.language);
      set({ language: me.language });
    } catch (error) {
      // putLanguage parses the response AFTER the write has already
      // committed (client.ts) — a thrown ApiError or a network failure both
      // mean the write never landed, so roll back. A ZodError is the one
      // failure that only happens after a 2xx, i.e. the server DOES hold the
      // new value; rolling back there would move the UI away from the truth.
      // Matched by name, not `instanceof ZodError` — zod isn't a direct
      // dependency of apps/mobile, only of @techtok/shared.
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
  },
}));
