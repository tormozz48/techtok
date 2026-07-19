import type { PostRecord } from '@techtok/core';
import { describe, expect, it } from 'vitest';
import { computeNextBefore } from './pagination';

function post(publishedAt: string): PostRecord {
  return {
    postId: publishedAt,
    url: 'https://example.com',
    canonicalUrl: 'https://example.com',
    sourceId: 'hn',
    sourceName: 'Hacker News',
    origTitle: 't',
    cardTitle: 't',
    summary: 's',
    excerpt: 's',
    primaryTopic: 'dev',
    topics: ['dev'],
    status: 'ready',
    transform: 'excerpt',
    publishedAt,
    ingestedAt: publishedAt,
    ttl: 0,
  };
}

describe('computeNextBefore', () => {
  it('returns null when fewer posts than the page limit come back', () => {
    const posts = [post('2026-07-18T00:00:00.000Z')];
    expect(computeNextBefore(posts, 20)).toBeNull();
  });

  it('returns the last item publishedAt when the page is full', () => {
    const posts = [post('2026-07-18T00:00:02.000Z'), post('2026-07-18T00:00:01.000Z')];
    expect(computeNextBefore(posts, 2)).toBe('2026-07-18T00:00:01.000Z');
  });

  it('returns null for an empty page', () => {
    expect(computeNextBefore([], 20)).toBeNull();
  });
});
