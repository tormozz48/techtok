export const LANGUAGES = ['en', 'ru', 'uk', 'pl'] as const;

export type Language = (typeof LANGUAGES)[number];

/** Native-script display names, used by the language picker (settings + onboarding). */
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  ru: 'Русский',
  uk: 'Українська',
  pl: 'Polski',
};

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}
