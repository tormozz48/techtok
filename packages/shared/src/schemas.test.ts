import { describe, expect, it } from 'vitest';
import {
  cardSchema,
  feedQuerySchema,
  historyQuerySchema,
  readsRequestSchema,
  topicSchema,
  topicsPrefsRequestSchema,
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
  };

  it('parses a minimal valid card', () => {
    expect(cardSchema.parse(validCard)).toMatchObject(validCard);
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

describe('historyQuerySchema', () => {
  it('defaults limit to 50 and coerces the query string', () => {
    expect(historyQuerySchema.parse({})).toMatchObject({ limit: 50 });
    expect(historyQuerySchema.parse({ limit: '10' })).toMatchObject({ limit: 10 });
  });

  it('rejects a limit above 100', () => {
    expect(() => historyQuerySchema.parse({ limit: '999' })).toThrow();
  });
});
