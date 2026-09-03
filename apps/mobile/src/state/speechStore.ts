import type { Language } from '@techtok/shared';
import * as Speech from 'expo-speech';
import { create } from 'zustand';
import { toSpeechLanguageCode } from '@/utils/speechLanguage';
import { logError, logEvent, serializeError } from './eventsQueue';

interface SpeechState {
  speakingId: string | null;
  availableLanguages: Set<string> | null;
  checkVoiceAvailability: () => Promise<void>;
  isLanguageAvailable: (language: Language) => boolean;
  speak: (id: string, texts: string[], language: Language) => void;
  stop: () => void;
  isSpeaking: (id: string) => boolean;
}

export const useSpeechStore = create<SpeechState>((set, get) => ({
  speakingId: null,
  availableLanguages: null,

  checkVoiceAvailability: async () => {
    if (get().availableLanguages) return;
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const languages = new Set(voices.map((voice) => voice.language.slice(0, 2).toLowerCase()));
      set({ availableLanguages: languages });
    } catch (error) {
      logError('speech voice availability check failed', serializeError(error), error);
    }
  },

  isLanguageAvailable: (language) => {
    const { availableLanguages } = get();
    if (!availableLanguages) return true;
    return availableLanguages.has(language.slice(0, 2).toLowerCase());
  },

  speak: (id, texts, language) => {
    Speech.stop();
    const speakable = texts.map((text) => text.trim()).filter((text) => text.length > 0);
    if (speakable.length === 0) return;

    const languageCode = toSpeechLanguageCode(language);
    set({ speakingId: id });
    logEvent('speech_started', { id, language });

    speakable.forEach((text, index) => {
      const isLast = index === speakable.length - 1;
      Speech.speak(text, {
        language: languageCode,
        onStopped: () => set({ speakingId: null }),
        ...(isLast
          ? {
              onDone: () => set({ speakingId: null }),
              onError: () => set({ speakingId: null }),
            }
          : {}),
      });
    });
  },

  stop: () => {
    Speech.stop();
    set({ speakingId: null });
    logEvent('speech_stopped');
  },

  isSpeaking: (id) => get().speakingId === id,
}));
