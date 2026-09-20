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

export function localizedPath(lang: Language, path: string): string {
  return `${LOCALE_SUBPATHS[lang]}${path}`;
}

export function localizedHref(lang: Language, path: string, base?: string): string {
  return withBase(localizedPath(lang, path), base);
}

export function localeHref(lang: Language, base?: string): string {
  return localizedHref(lang, '', base);
}
