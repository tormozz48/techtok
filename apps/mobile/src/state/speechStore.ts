import type { Language } from '@techtok/shared';
import * as Speech from 'expo-speech';
import { create } from 'zustand';
import { toSpeechLanguageCode } from '@/utils/speechLanguage';

interface SpeechState {
  /** postId of whatever is currently being read aloud, or null when idle.
   * Tracking *which* post rather than a bare isSpeaking boolean matters: if
   * card A's summary is still finishing when the user swipes to card B,
   * card B's listen button must show "play", not "stop" — a boolean alone
   * can't tell the two apart. */
  speakingId: string | null;
  /** Populated lazily on first checkVoiceAvailability() call; null means
   * "not checked yet" (screens default to showing the listen control while
   * this is null, then hide it if the check comes back negative). */
  availableLanguages: Set<string> | null;
  checkVoiceAvailability: () => Promise<void>;
  isLanguageAvailable: (language: Language) => boolean;
  /** Speaks each string in order (Speech.speak queues utterances called
   * while something is already speaking) — pass a single-item array for a
   * one-off utterance, or a whole article's worth for sequential reading.
   * `id` is whatever this speech is "about" (a postId) so isSpeaking(id)
   * can answer "is *this* card/article the one playing". */
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
    } catch {
      // Treat a failed check as "nothing confirmed" rather than crashing —
      // isLanguageAvailable's null-means-optimistic default still applies
      // until a real answer comes back, so this just means it never does.
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
  },

  isSpeaking: (id) => get().speakingId === id,
}));
