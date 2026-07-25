import type { Language } from '@techtok/shared';

/** Sub-path (relative to the site's base) of each locale's landing page —
 * must match the routes in src/pages/index.astro and src/pages/[lang]/index.astro. */
const LOCALE_SUBPATHS: Record<Language, string> = {
  en: '',
  ru: 'ru/',
  uk: 'uk/',
  pl: 'pl/',
};

/**
 * Joins `path` onto `base` with exactly one separating slash, regardless of
 * whether `base` already ends in one. Astro's `import.meta.env.BASE_URL`
 * does NOT carry a trailing slash (e.g. `/techtok`, not `/techtok/`) — a
 * naive `${base}${path}` concatenation silently drops the separator.
 */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}/${path}`;
}

/** Base-path-aware href to another locale's landing page, for the language
 * switcher and hreflang alternate links. */
export function localeHref(lang: Language, base?: string): string {
  return withBase(LOCALE_SUBPATHS[lang], base);
}
