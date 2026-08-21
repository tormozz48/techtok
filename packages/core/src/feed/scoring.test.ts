import type { Topic } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import type { PostRecord } from '../posts.types';
import {
  MAX_AFFINITY_BOOST,
  MIN_AFFINITY_READS,
  RECENCY_HALF_LIFE_HOURS,
  rankCandidates,
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

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

describe('rankCandidates', () => {
  describe('recency scoring', () => {
    it('ranks a newer post above an older one on the same topic and source', () => {
      const candidates = [
        post('old', 'ai', hoursAgo(2 * RECENCY_HALF_LIFE_HOURS)),
        post('new', 'ai', hoursAgo(0)),
      ];
      const result = rankCandidates(candidates, new Map(), NOW);
      expect(result.map((p) => p.postId)).toEqual(['new', 'old']);
    });

    it('clamps a future publishedAt to age zero instead of ranking it above an equally-fresh post', () => {
      const future = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
      const candidates = [post('fresh', 'ai', NOW.toISOString()), post('future', 'ai', future)];
      const result = rankCandidates(candidates, new Map(), NOW);
      expect(result.map((p) => p.postId)).toEqual(['fresh', 'future']);
    });
  });

  describe('source weight', () => {
    it('ranks a heavily-weighted source above the default weight at equal recency', () => {
      const candidates = [
        post('default', 'ai', NOW.toISOString(), 'unknown-source'),
        post('heavy', 'ai', NOW.toISOString(), 'heavy'),
      ];
      const weights = new Map([['heavy', 5]]);
      const result = rankCandidates(candidates, weights, NOW);
      expect(result.map((p) => p.postId)).toEqual(['heavy', 'default']);
    });
  });

  describe('topic affinity boost', () => {
    it("ranks a boosted topic's post above an equally-recent unboosted one", () => {
      const candidates = [
        post('dev', 'dev', NOW.toISOString()),
        post('ai', 'ai', NOW.toISOString()),
      ];
      const boosts = new Map<Topic, number>([['ai', 1.4]]);
      const result = rankCandidates(candidates, new Map(), NOW, boosts);
      expect(result.map((p) => p.postId)).toEqual(['ai', 'dev']);
    });

    it('keeps recency dominant: the max affinity boost cannot overcome one half-life of age', () => {
      const candidates = [
        post('old-boosted', 'ai', hoursAgo(RECENCY_HALF_LIFE_HOURS)),
        post('fresh-unboosted', 'dev', NOW.toISOString()),
      ];
      const boosts = new Map<Topic, number>([['ai', MAX_AFFINITY_BOOST]]);
      const result = rankCandidates(candidates, new Map(), NOW, boosts);
      expect(result.map((p) => p.postId)).toEqual(['fresh-unboosted', 'old-boosted']);
    });
  });

  describe('interleaving', () => {
    it('round-robins across topics without dropping any post', () => {
      const candidates = [
        post('ai1', 'ai', NOW.toISOString()),
        post('ai2', 'ai', NOW.toISOString()),
        post('dev1', 'dev', NOW.toISOString()),
      ];
      const result = rankCandidates(candidates, new Map(), NOW);
      expect(result.map((p) => p.postId)).toEqual(['ai1', 'dev1', 'ai2']);
    });

    it('round-robins across sources within a topic without dropping any post', () => {
      const candidates = [
        post('a1', 'ai', NOW.toISOString(), 'sourceA'),
        post('a2', 'ai', NOW.toISOString(), 'sourceA'),
        post('b1', 'ai', NOW.toISOString(), 'sourceB'),
      ];
      const result = rankCandidates(candidates, new Map(), NOW);
      expect(result.map((p) => p.postId)).toEqual(['a1', 'b1', 'a2']);
    });

    it('exhausts a shorter queue without leaving gaps', () => {
      const candidates = [
        post('ai1', 'ai', NOW.toISOString()),
        post('dev1', 'dev', NOW.toISOString()),
        post('ai2', 'ai', NOW.toISOString()),
        post('ai3', 'ai', NOW.toISOString()),
      ];
      const result = rankCandidates(candidates, new Map(), NOW);
      expect(result).toHaveLength(4);
      expect(result.map((p) => p.postId)).toEqual(['ai1', 'dev1', 'ai2', 'ai3']);
    });
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
    const boosts = topicAffinityBoosts({ ai: 8, dev: 2 });

    expect(boosts.get('ai')).toBeCloseTo(1 + 0.5 * 0.8);
    expect(boosts.get('dev')).toBeCloseTo(1 + 0.5 * 0.2);
    expect(boosts.has('science')).toBe(false);
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
});
