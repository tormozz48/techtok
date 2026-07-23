import { describe, expect, it } from 'vitest';
import type { PostRecord } from '../posts.types';
import { needsTranslation } from './needsTranslation';

const NOW = new Date('2026-07-23T12:00:00.000Z');

function samplePost(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: 'abc123',
    url: 'https://example.com/a',
    canonicalUrl: 'https://example.com/a',
    sourceId: 'hn',
    sourceName: 'Hacker News',
    origTitle: 'Title',
    cardTitle: 'Title',
    summary: 'Summary',
    excerpt: 'Summary',
    primaryTopic: 'dev',
    topics: ['dev'],
    status: 'ready',
    transform: 'excerpt',
    publishedAt: '2026-07-18T00:00:00.000Z',
    ingestedAt: '2026-07-18T00:00:00.000Z',
    ttl: 0,
    i18n: {},
    i18nPending: {},
    ...overrides,
  };
}

describe('needsTranslation', () => {
  it('never needs translation for english', () => {
    expect(needsTranslation(samplePost(), 'en', NOW)).toBe(false);
  });

  it('needs translation when no i18n entry and no pending marker exist', () => {
    expect(needsTranslation(samplePost(), 'ru', NOW)).toBe(true);
  });

  it('does not need translation once an i18n entry exists', () => {
    const post = samplePost({
      i18n: { ru: { cardTitle: 't', summary: 's', translatedAt: '2026-07-23T00:00:00.000Z' } },
    });
    expect(needsTranslation(post, 'ru', NOW)).toBe(false);
  });

  it('does not need translation while a fresh pending marker exists', () => {
    const post = samplePost({ i18nPending: { ru: '2026-07-23T11:55:00.000Z' } });
    expect(needsTranslation(post, 'ru', NOW)).toBe(false);
  });

  it('needs translation again once the pending marker goes stale', () => {
    const post = samplePost({ i18nPending: { ru: '2026-07-23T11:00:00.000Z' } });
    expect(needsTranslation(post, 'ru', NOW)).toBe(true);
  });

  it('checks only the requested language pending marker', () => {
    const post = samplePost({ i18nPending: { uk: '2026-07-23T11:55:00.000Z' } });
    expect(needsTranslation(post, 'ru', NOW)).toBe(true);
  });
});
