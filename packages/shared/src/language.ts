export const LANGUAGES = ['en', 'ru', 'uk', 'pl'] as const;

export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  ru: 'Русский',
  uk: 'Українська',
  pl: 'Polski',
};

export const LANGUAGE_FLAGS: Record<Language, string> = {
  en: '🇬🇧',
  ru: '🇷🇺',
  uk: '🇺🇦',
  pl: '🇵🇱',
};

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}
