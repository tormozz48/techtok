import type { Topic } from '@techtok/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '../posts.types';
import { buildFeed } from './buildFeed';

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

function noWeights() {
  return vi.fn().mockResolvedValue(new Map<string, number>());
}

describe('buildFeed', () => {
  it('queries every topic when the user has no preference (all 8)', async () => {
    const queryByTopic = vi.fn().mockResolvedValue([]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: [], limit: 20 },
    );

    expect(queryByTopic).toHaveBeenCalledTimes(8);
  });

  it('queries only the user-selected topics', async () => {
    const queryByTopic = vi.fn().mockResolvedValue([]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai', 'dev'], limit: 20 },
    );

    expect(queryByTopic).toHaveBeenCalledTimes(2);
    expect(queryByTopic).toHaveBeenCalledWith('ai', { before: undefined, limit: 25 });
    expect(queryByTopic).toHaveBeenCalledWith('dev', { before: undefined, limit: 25 });
  });

  it('merges per-topic results newest-first and dedups by postId', async () => {
    const aiPost = post('a', 'ai', '2026-07-18T02:00:00.000Z');
    const devPost = post('b', 'dev', '2026-07-18T03:00:00.000Z');
    const duplicate = post('a', 'ai', '2026-07-18T02:00:00.000Z');
    const queryByTopic = vi.fn(async (topic: Topic) => {
      if (topic === 'ai') return [aiPost, duplicate];
      if (topic === 'dev') return [devPost];
      return [];
    });
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai', 'dev'], limit: 20 },
    );

    expect(page.items.map((p) => p.postId)).toEqual(['b', 'a']);
  });

  it('drops posts already read by the user', async () => {
    const a = post('a', 'ai', '2026-07-18T02:00:00.000Z');
    const b = post('b', 'ai', '2026-07-18T03:00:00.000Z');
    const queryByTopic = vi.fn().mockResolvedValue([a, b]);
    const getReadSet = vi.fn().mockResolvedValue(new Set(['b']));

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai'], limit: 20 },
    );

    expect(page.items.map((p) => p.postId)).toEqual(['a']);
  });

  it('caps candidates fed to getReadSet at 60', async () => {
    const posts = Array.from({ length: 25 }, (_, i) =>
      post(`p${i}`, 'ai', `2026-07-18T00:00:${String(i).padStart(2, '0')}.000Z`),
    );
    const queryByTopic = vi.fn().mockResolvedValue(posts);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai', 'dev', 'gadgets'], limit: 20 },
    );

    const candidateIds = getReadSet.mock.calls[0]?.[0] as string[];
    expect(candidateIds.length).toBeLessThanOrEqual(60);
  });

  it('sets nextBefore to null when no topic query returned a full page', async () => {
    const a = post('a', 'ai', '2026-07-18T02:00:00.000Z');
    const queryByTopic = vi.fn().mockResolvedValue([a]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai'], limit: 20 },
    );

    expect(page.nextBefore).toBeNull();
  });

  it('advances nextBefore using the last candidate when a full page was entirely read', async () => {
    const posts = Array.from({ length: 25 }, (_, i) =>
      post(`p${i}`, 'ai', `2026-07-18T00:00:${String(i).padStart(2, '0')}.000Z`),
    );
    const queryByTopic = vi.fn().mockResolvedValue(posts);
    const getReadSet = vi.fn().mockResolvedValue(new Set(posts.map((p) => p.postId)));

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai'], limit: 20 },
    );

    expect(page.items).toEqual([]);
    expect(page.nextBefore).toBe(posts[0]?.publishedAt);
  });

  it('slices results to the requested limit', async () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      post(`p${i}`, 'ai', `2026-07-18T00:00:${String(i).padStart(2, '0')}.000Z`),
    );
    const queryByTopic = vi.fn().mockResolvedValue(posts);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai'], limit: 3 },
    );

    expect(page.items).toHaveLength(3);
  });

  it('lets a higher source weight outrank a slightly newer post', async () => {
    const newLowWeight = post('a', 'ai', '2026-07-19T02:00:00.000Z', 'low');
    const olderHighWeight = post('b', 'ai', '2026-07-19T00:00:00.000Z', 'high');
    const queryByTopic = vi.fn().mockResolvedValue([newLowWeight, olderHighWeight]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());
    const getSourceWeights = vi.fn().mockResolvedValue(
      new Map([
        ['low', 1],
        ['high', 10],
      ]),
    );

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights },
      { userTopics: ['ai'], limit: 20 },
    );

    expect(page.items.map((p) => p.postId)).toEqual(['b', 'a']);
  });

  it('keeps nextBefore based on publish time even when ranking reorders the returned items', async () => {
    const newLowWeight = post('a', 'ai', '2026-07-19T02:00:00.000Z', 'low');
    const oldestHighWeight = post('b', 'ai', '2026-07-19T00:00:00.000Z', 'high');
    const posts = [
      newLowWeight,
      oldestHighWeight,
      ...Array.from({ length: 23 }, (_, i) =>
        post(`p${i}`, 'ai', `2026-07-19T01:00:${String(i).padStart(2, '0')}.000Z`),
      ),
    ];
    const queryByTopic = vi.fn().mockResolvedValue(posts);
    const getReadSet = vi.fn().mockResolvedValue(new Set());
    const getSourceWeights = vi.fn().mockResolvedValue(new Map([['high', 10]]));

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights },
      { userTopics: ['ai'], limit: 20 },
    );

    // 'b' (high weight, oldest) is ranked first in items, not last — but
    // nextBefore must still equal the oldest post by publishedAt ('b'),
    // proving the cursor ignores rank order.
    expect(page.items[0]?.postId).toBe('b');
    expect(page.nextBefore).toBe(oldestHighWeight.publishedAt);
  });

  it('excludes posts flagged duplicateOf from the returned items', async () => {
    const original = post('a', 'ai', '2026-07-19T02:00:00.000Z');
    const duplicate = { ...post('b', 'ai', '2026-07-19T01:00:00.000Z'), duplicateOf: 'a' };
    const queryByTopic = vi.fn().mockResolvedValue([original, duplicate]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai'], limit: 20 },
    );

    expect(page.items.map((p) => p.postId)).toEqual(['a']);
  });

  it('excludes posts that are not yet ready (discovered or failed)', async () => {
    const ready = post('a', 'ai', '2026-07-19T02:00:00.000Z');
    const discovered = {
      ...post('b', 'ai', '2026-07-19T01:30:00.000Z'),
      status: 'discovered' as const,
    };
    const failed = { ...post('c', 'ai', '2026-07-19T01:00:00.000Z'), status: 'failed' as const };
    const queryByTopic = vi.fn().mockResolvedValue([ready, discovered, failed]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai'], limit: 20 },
    );

    expect(page.items.map((p) => p.postId)).toEqual(['a']);
  });

  it('leaves a discovered post inside the page window permanently behind once the cursor advances past it', async () => {
    // 24 ready posts spanning 00:01:00 (oldest) .. 00:01:23 (newest), plus a
    // still-discovered post at 00:01:11.5 — timestamped *inside* that range,
    // not at either edge.
    const readyPosts = Array.from({ length: 24 }, (_, i) =>
      post(`p${i}`, 'ai', `2026-07-18T00:01:${String(i).padStart(2, '0')}.000Z`),
    );
    const stuckDiscovered = {
      ...post('stuck', 'ai', '2026-07-18T00:01:11.500Z'),
      status: 'discovered' as const,
    };
    const queryByTopic = vi.fn().mockResolvedValue([...readyPosts, stuckDiscovered]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    const page = await buildFeed(
      { queryByTopic, getReadSet, getSourceWeights: noWeights() },
      { userTopics: ['ai'], limit: 20 },
    );

    expect(page.items.map((p) => p.postId)).not.toContain('stuck');
    // The cursor is drawn from the *filtered* candidate list, so it
    // watermarks at the oldest ready post (p0) — which is older than
    // `stuck`. Any further page in this session queries strictly before
    // that watermark, so it can never reach `stuck` again even though
    // `stuck` sat inside the window just paginated past. This is the
    // documented, accepted skip: it self-heals only on a fresh feed load.
    expect(page.nextBefore).toBe(readyPosts[0]?.publishedAt);
    expect(new Date(page.nextBefore as string).getTime()).toBeLessThan(
      new Date(stuckDiscovered.publishedAt).getTime(),
    );
  });
});
