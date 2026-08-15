import type { Topic } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import type { PostRecord } from '../posts.types';
import {
  DEFAULT_SOURCE_WEIGHT,
  interleaveBySource,
  interleaveByTopic,
  MAX_AFFINITY_BOOST,
  MIN_AFFINITY_READS,
  RECENCY_HALF_LIFE_HOURS,
  recencyDecay,
  scorePost,
  topicAffinityBoosts,
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
    i18n: {},
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

  it('applies no boost when affinityBoosts is omitted', () => {
    const p = post('a', 'ai', NOW.toISOString());
    expect(scorePost(p, new Map(), NOW)).toBeCloseTo(recencyDecay(p.publishedAt, NOW));
  });

  it("multiplies in the post's topic boost when affinityBoosts is given", () => {
    const p = post('a', 'ai', NOW.toISOString());
    const boosts = new Map<Topic, number>([['ai', 1.4]]);
    expect(scorePost(p, new Map(), NOW, boosts)).toBeCloseTo(
      recencyDecay(p.publishedAt, NOW) * 1.4,
    );
  });

  it("leaves a post's score unboosted when its topic has no entry in affinityBoosts", () => {
    const p = post('a', 'dev', NOW.toISOString());
    const boosts = new Map<Topic, number>([['ai', 1.4]]);
    expect(scorePost(p, new Map(), NOW, boosts)).toBeCloseTo(recencyDecay(p.publishedAt, NOW));
  });
});

describe('topicAffinityBoosts', () => {
  it('returns no boosts when topicReads is undefined', () => {
    expect(topicAffinityBoosts(undefined)).toEqual(new Map());
  });

  it(`returns no boosts below the ${MIN_AFFINITY_READS}-read cold-start threshold`, () => {
    const topicReads = { ai: MIN_AFFINITY_READS - 1 };
    expect(topicAffinityBoosts(topicReads)).toEqual(new Map());
  });

  it('boosts every topic present once the total reaches the threshold, proportional to share', () => {
    // 8 ai + 2 dev = 10 total (meets the threshold exactly).
    const boosts = topicAffinityBoosts({ ai: 8, dev: 2 });

    expect(boosts.get('ai')).toBeCloseTo(1 + 0.5 * 0.8); // share 0.8
    expect(boosts.get('dev')).toBeCloseTo(1 + 0.5 * 0.2); // share 0.2
    expect(boosts.has('science')).toBe(false); // never read -> no entry, not a penalty
  });

  it(`clamps the boost at ${MAX_AFFINITY_BOOST} even at 100% share`, () => {
    const boosts = topicAffinityBoosts({ ai: 50 });
    expect(boosts.get('ai')).toBe(MAX_AFFINITY_BOOST);
  });

  it('never boosts below 1 for any topic', () => {
    const boosts = topicAffinityBoosts({ ai: 9, dev: 1 });
    for (const boost of boosts.values()) {
      expect(boost).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps recency dominant: the max boost is worth far less than one half-life of age', () => {
    // A post 1 half-life old (score 0.5x) is still outranked by an equally
    // fresh, unboosted post, even against the maximum possible boost.
    const halfLifeAgo = new Date(NOW.getTime() - RECENCY_HALF_LIFE_HOURS * 60 * 60 * 1000);
    const boostedButOld = recencyDecay(halfLifeAgo.toISOString(), NOW) * MAX_AFFINITY_BOOST;
    const freshUnboosted = recencyDecay(NOW.toISOString(), NOW) * 1;
    expect(boostedButOld).toBeLessThan(freshUnboosted);
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

describe('interleaveBySource', () => {
  it('round-robins across sources without dropping any post', () => {
    const sorted = [
      post('a1', 'ai', NOW.toISOString(), 'sourceA'),
      post('a2', 'ai', NOW.toISOString(), 'sourceA'),
      post('b1', 'ai', NOW.toISOString(), 'sourceB'),
    ];

    const result = interleaveBySource(sorted);

    expect(result.map((p) => p.postId)).toEqual(['a1', 'b1', 'a2']);
  });

  it('preserves order within a single source (no other sources to interleave with)', () => {
    const sorted = [
      post('a', 'ai', NOW.toISOString(), 'sourceA'),
      post('b', 'ai', NOW.toISOString(), 'sourceA'),
    ];

    expect(interleaveBySource(sorted).map((p) => p.postId)).toEqual(['a', 'b']);
  });

  it('exhausts a shorter source queue without leaving gaps', () => {
    const sorted = [
      post('a1', 'ai', NOW.toISOString(), 'sourceA'),
      post('b1', 'ai', NOW.toISOString(), 'sourceB'),
      post('a2', 'ai', NOW.toISOString(), 'sourceA'),
      post('a3', 'ai', NOW.toISOString(), 'sourceA'),
    ];

    const result = interleaveBySource(sorted);

    expect(result).toHaveLength(4);
    expect(result.map((p) => p.postId)).toEqual(['a1', 'b1', 'a2', 'a3']);
  });
});
