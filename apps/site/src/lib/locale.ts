import type { Language } from '@techtok/shared';

const LOCALE_SUBPATHS: Record<Language, string> = {
  en: '',
  ru: 'ru/',
  uk: 'uk/',
  pl: 'pl/',
};

export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}/${path}`;
}

export function localeHref(lang: Language, base?: string): string {
  return withBase(LOCALE_SUBPATHS[lang], base);
}
