import { describe, expect, it } from 'vitest';
import { LANGUAGES } from './language';
import {
  bookmarkCreateRequestSchema,
  bookmarkItemSchema,
  bookmarksResponseSchema,
  cardSchema,
  compactBlockSchema,
  contentQuerySchema,
  contentResponseSchema,
  feedQuerySchema,
  historyQuerySchema,
  languagePrefsRequestSchema,
  languageSchema,
  meResponseSchema,
  readsRequestSchema,
  topicSchema,
  topicsPrefsRequestSchema,
  topicsQuerySchema,
} from './schemas';
import { TOPICS } from './topics';

describe('topicSchema', () => {
  it('accepts every taxonomy topic', () => {
    for (const topic of TOPICS) {
      expect(topicSchema.parse(topic)).toBe(topic);
    }
  });

  it('rejects an unknown topic', () => {
    expect(() => topicSchema.parse('crypto')).toThrow();
  });
});

describe('cardSchema', () => {
  const validCard = {
    id: 'abc123',
    title: 'Scientists build a smaller particle detector',
    summary: 'A new detector replaces many components with one block.',
    sourceName: 'ScienceDaily',
    url: 'https://www.sciencedaily.com/releases/2026/07/x.htm',
    primaryTopic: 'science',
    topics: ['science'],
    publishedAt: '2026-07-17T06:04:57.000Z',
    servedLang: 'en',
    isTranslated: false,
  };

  it('parses a minimal valid card', () => {
    expect(cardSchema.parse(validCard)).toMatchObject(validCard);
  });

  it('defaults compactLangs to an empty array', () => {
    expect(cardSchema.parse(validCard).compactLangs).toEqual([]);
  });

  it('rejects a card with an invalid topic', () => {
    expect(() => cardSchema.parse({ ...validCard, primaryTopic: 'crypto' })).toThrow();
  });

  it('rejects a non-url source link', () => {
    expect(() => cardSchema.parse({ ...validCard, url: 'not-a-url' })).toThrow();
  });

  it('accepts an optional blurhash', () => {
    const blurhash = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';
    expect(cardSchema.parse({ ...validCard, blurhash })).toMatchObject({ blurhash });
  });

  it('reflects a translated variant via servedLang/isTranslated', () => {
    const translated = { ...validCard, servedLang: 'ru', isTranslated: true };
    expect(cardSchema.parse(translated)).toMatchObject(translated);
  });
});

describe('languageSchema', () => {
  it('accepts every supported language', () => {
    for (const lang of LANGUAGES) {
      expect(languageSchema.parse(lang)).toBe(lang);
    }
  });

  it('rejects an unsupported language', () => {
    expect(() => languageSchema.parse('fr')).toThrow();
  });
});

describe('meResponseSchema', () => {
  it('requires a language', () => {
    const valid = {
      userId: 'device-1',
      topics: ['ai'],
      createdAt: '2026-07-18T00:00:00.000Z',
      language: 'uk',
    };
    expect(meResponseSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a missing language', () => {
    expect(() =>
      meResponseSchema.parse({
        userId: 'device-1',
        topics: [],
        createdAt: '2026-07-18T00:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('languagePrefsRequestSchema', () => {
  it('accepts a supported language', () => {
    expect(languagePrefsRequestSchema.parse({ language: 'pl' })).toEqual({ language: 'pl' });
  });

  it('rejects an unsupported language', () => {
    expect(() => languagePrefsRequestSchema.parse({ language: 'fr' })).toThrow();
  });
});

describe('topicsQuerySchema', () => {
  it('defaults lang to en', () => {
    expect(topicsQuerySchema.parse({})).toEqual({ lang: 'en' });
  });

  it('accepts a supported lang override', () => {
    expect(topicsQuerySchema.parse({ lang: 'ru' })).toEqual({ lang: 'ru' });
  });
});

describe('feedQuerySchema', () => {
  it('defaults limit to 20 and coerces the query string', () => {
    expect(feedQuerySchema.parse({})).toMatchObject({ limit: 20 });
    expect(feedQuerySchema.parse({ limit: '5' })).toMatchObject({ limit: 5 });
  });

  it('rejects a limit above 50', () => {
    expect(() => feedQuerySchema.parse({ limit: '999' })).toThrow();
  });
});

describe('topicsPrefsRequestSchema', () => {
  it('accepts an empty list (all topics)', () => {
    expect(topicsPrefsRequestSchema.parse({ topics: [] })).toEqual({ topics: [] });
  });

  it('rejects an unknown topic', () => {
    expect(() => topicsPrefsRequestSchema.parse({ topics: ['crypto'] })).toThrow();
  });
});

describe('readsRequestSchema', () => {
  it('rejects an empty postIds array', () => {
    expect(() => readsRequestSchema.parse({ postIds: [] })).toThrow();
  });

  it('rejects more than 100 postIds', () => {
    const postIds = Array.from({ length: 101 }, (_, i) => `post${i}`);
    expect(() => readsRequestSchema.parse({ postIds })).toThrow();
  });
});

describe('bookmarkCreateRequestSchema', () => {
  it('accepts a postId', () => {
    expect(bookmarkCreateRequestSchema.parse({ postId: 'abc123' })).toEqual({ postId: 'abc123' });
  });

  it('rejects a missing postId', () => {
    expect(() => bookmarkCreateRequestSchema.parse({})).toThrow();
  });
});

describe('bookmarkItemSchema / bookmarksResponseSchema', () => {
  const item = {
    postId: 'abc123',
    bookmarkedAt: '2026-07-18T00:00:00.000Z',
    cardTitle: 'A great story',
    sourceName: 'Hacker News',
    url: 'https://example.com/a',
  };

  it('parses a single bookmark item', () => {
    expect(bookmarkItemSchema.parse(item)).toEqual(item);
  });

  it('parses a paginated bookmarks response', () => {
    expect(bookmarksResponseSchema.parse({ items: [item], nextCursor: null })).toEqual({
      items: [item],
      nextCursor: null,
    });
  });
});

describe('historyQuerySchema', () => {
  it('defaults limit to 50 and coerces the query string', () => {
    expect(historyQuerySchema.parse({})).toMatchObject({ limit: 50 });
    expect(historyQuerySchema.parse({ limit: '10' })).toMatchObject({ limit: 10 });
  });

  it('rejects a limit above 100', () => {
    expect(() => historyQuerySchema.parse({ limit: '999' })).toThrow();
  });
});

describe('compactBlockSchema', () => {
  it('parses each block variant', () => {
    expect(compactBlockSchema.parse({ type: 'paragraph', text: 'hi' })).toMatchObject({
      type: 'paragraph',
    });
    expect(compactBlockSchema.parse({ type: 'list', items: ['a', 'b'] })).toMatchObject({
      type: 'list',
    });
    expect(compactBlockSchema.parse({ type: 'image', figureIndex: 0 })).toMatchObject({
      type: 'image',
      figureIndex: 0,
    });
  });

  it('rejects an unknown block type', () => {
    expect(() => compactBlockSchema.parse({ type: 'video', text: 'hi' })).toThrow();
  });
});

describe('contentQuerySchema', () => {
  it('defaults lang to en', () => {
    expect(contentQuerySchema.parse({})).toEqual({ lang: 'en' });
  });
});

describe('contentResponseSchema', () => {
  it('parses an available response with blocks and figures', () => {
    const response = {
      available: true,
      lang: 'en',
      blocks: [{ type: 'paragraph', text: 'hi' }],
      figures: [{ url: 'https://example.com/fig.jpg' }],
    };
    expect(contentResponseSchema.parse(response)).toEqual(response);
  });

  it('parses an unavailable response with a reason', () => {
    const response = { available: false, reason: 'not ready yet' };
    expect(contentResponseSchema.parse(response)).toEqual(response);
  });
});
