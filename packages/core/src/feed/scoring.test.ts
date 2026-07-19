import type { Topic } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import type { PostRecord } from '../posts/types';
import {
  DEFAULT_SOURCE_WEIGHT,
  interleaveByTopic,
  RECENCY_HALF_LIFE_HOURS,
  recencyDecay,
  scorePost,
} from './scoring';

const NOW = new Date('2026-07-19T12:00:00.000Z');

function post(id: string, topic: Topic, publishedAt: string, sourceId = 'hn'): PostRecord {
  return {
    postId: id,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    sourceId,
    sourceName: sourceId,
    origTitle: id,
    cardTitle: id,
    summary: id,
    excerpt: id,
    primaryTopic: topic,
    topics: [topic],
    status: 'ready',
    transform: 'excerpt',
    publishedAt,
    ingestedAt: publishedAt,
    ttl: 0,
  };
}

describe('recencyDecay', () => {
  it('is 1 at age zero', () => {
    expect(recencyDecay(NOW.toISOString(), NOW)).toBeCloseTo(1);
  });

  it('is 0.5 at exactly one half-life', () => {
    const halfLifeAgo = new Date(NOW.getTime() - RECENCY_HALF_LIFE_HOURS * 60 * 60 * 1000);
    expect(recencyDecay(halfLifeAgo.toISOString(), NOW)).toBeCloseTo(0.5);
  });

  it('is 0.25 at two half-lives', () => {
    const twoHalfLivesAgo = new Date(NOW.getTime() - 2 * RECENCY_HALF_LIFE_HOURS * 60 * 60 * 1000);
    expect(recencyDecay(twoHalfLivesAgo.toISOString(), NOW)).toBeCloseTo(0.25);
  });

  it('clamps a future publishedAt to age zero instead of a decay > 1', () => {
    const future = new Date(NOW.getTime() + 60 * 60 * 1000);
    expect(recencyDecay(future.toISOString(), NOW)).toBeCloseTo(1);
  });
});

describe('scorePost', () => {
  it('applies the default weight when the source has no entry', () => {
    const p = post('a', 'ai', NOW.toISOString(), 'unknown-source');
    expect(scorePost(p, new Map(), NOW)).toBeCloseTo(
      recencyDecay(p.publishedAt, NOW) * DEFAULT_SOURCE_WEIGHT,
    );
  });

  it('multiplies recency decay by the source weight', () => {
    const p = post('a', 'ai', NOW.toISOString(), 'heavy');
    const weights = new Map([['heavy', 5]]);
    expect(scorePost(p, weights, NOW)).toBeCloseTo(recencyDecay(p.publishedAt, NOW) * 5);
  });
});

describe('interleaveByTopic', () => {
  it('round-robins across topics without dropping any post', () => {
    const sorted = [
      post('ai1', 'ai', NOW.toISOString()),
      post('ai2', 'ai', NOW.toISOString()),
      post('dev1', 'dev', NOW.toISOString()),
    ];

    const result = interleaveByTopic(sorted);

    expect(result.map((p) => p.postId)).toEqual(['ai1', 'dev1', 'ai2']);
  });

  it('preserves order within a single topic (no other topics to interleave with)', () => {
    const sorted = [post('a', 'ai', NOW.toISOString()), post('b', 'ai', NOW.toISOString())];

    expect(interleaveByTopic(sorted).map((p) => p.postId)).toEqual(['a', 'b']);
  });

  it('exhausts a shorter topic queue without leaving gaps', () => {
    const sorted = [
      post('ai1', 'ai', NOW.toISOString()),
      post('dev1', 'dev', NOW.toISOString()),
      post('ai2', 'ai', NOW.toISOString()),
      post('ai3', 'ai', NOW.toISOString()),
    ];

    const result = interleaveByTopic(sorted);

    expect(result).toHaveLength(4);
    expect(result.map((p) => p.postId)).toEqual(['ai1', 'dev1', 'ai2', 'ai3']);
  });
});
