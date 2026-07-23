import { describe, expect, it } from 'vitest';
import type { PostRecord } from '../posts.types';
import { selectCardVariant } from './selectCardVariant';

function samplePost(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: 'abc123',
    url: 'https://example.com/a',
    canonicalUrl: 'https://example.com/a',
    sourceId: 'hn',
    sourceName: 'Hacker News',
    origTitle: 'Title',
    cardTitle: 'English Title',
    summary: 'English summary.',
    whyItMatters: 'English why it matters.',
    excerpt: 'Summary',
    primaryTopic: 'dev',
    topics: ['dev'],
    status: 'ready',
    transform: 'llm',
    publishedAt: '2026-07-18T00:00:00.000Z',
    ingestedAt: '2026-07-18T00:00:00.000Z',
    ttl: 0,
    i18n: {},
    i18nPending: {},
    ...overrides,
  };
}

describe('selectCardVariant', () => {
  it('serves the english fields for an english request', () => {
    const variant = selectCardVariant(samplePost(), 'en');
    expect(variant).toEqual({
      cardTitle: 'English Title',
      summary: 'English summary.',
      whyItMatters: 'English why it matters.',
      servedLang: 'en',
      isTranslated: false,
    });
  });

  it('falls back to english when the translation is missing', () => {
    const variant = selectCardVariant(samplePost(), 'ru');
    expect(variant.servedLang).toBe('en');
    expect(variant.isTranslated).toBe(false);
    expect(variant.cardTitle).toBe('English Title');
  });

  it('serves the translated fields when present', () => {
    const post = samplePost({
      i18n: {
        ru: {
          cardTitle: 'Русский заголовок',
          summary: 'Русское содержание.',
          whyItMatters: 'Почему это важно.',
          translatedAt: '2026-07-23T00:00:00.000Z',
        },
      },
    });

    const variant = selectCardVariant(post, 'ru');

    expect(variant).toEqual({
      cardTitle: 'Русский заголовок',
      summary: 'Русское содержание.',
      whyItMatters: 'Почему это важно.',
      servedLang: 'ru',
      isTranslated: true,
    });
  });
});
