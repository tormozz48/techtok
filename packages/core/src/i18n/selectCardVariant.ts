import type { Language } from '@techtok/shared';
import type { PostRecord } from '../posts.types';

export interface CardVariant {
  readonly cardTitle: string;
  readonly summary: string;
  readonly whyItMatters?: string;
  readonly servedLang: Language;
  readonly isTranslated: boolean;
}

/**
 * Picks the display variant for a post (D21): the requested language's
 * translation when present, else the English fields.
 */
export function selectCardVariant(post: PostRecord, lang: Language): CardVariant {
  const translation = lang === 'en' ? undefined : post.i18n[lang];
  if (translation) {
    return {
      cardTitle: translation.cardTitle,
      summary: translation.summary,
      whyItMatters: translation.whyItMatters,
      servedLang: lang,
      isTranslated: true,
    };
  }

  return {
    cardTitle: post.cardTitle,
    summary: post.summary,
    whyItMatters: post.whyItMatters,
    servedLang: 'en',
    isTranslated: false,
  };
}
