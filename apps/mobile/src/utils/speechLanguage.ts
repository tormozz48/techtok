import type { Language } from '@techtok/shared';

const SPEECH_LANGUAGE_CODES: Record<Language, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  uk: 'uk-UA',
  pl: 'pl-PL',
};

export function toSpeechLanguageCode(language: Language): string {
  return SPEECH_LANGUAGE_CODES[language];
}
