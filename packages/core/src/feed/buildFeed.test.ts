import type { Topic } from '@techtok/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '../posts/types';
import { buildFeed } from './buildFeed';

function post(id: string, topic: Topic, publishedAt: string): PostRecord {
  return {
    postId: id,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    sourceId: 'hn',
    sourceName: 'Hacker News',
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

describe('buildFeed', () => {
  it('queries every topic when the user has no preference (all 8)', async () => {
    const queryByTopic = vi.fn().mockResolvedValue([]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    await buildFeed({ queryByTopic, getReadSet }, { userTopics: [], limit: 20 });

    expect(queryByTopic).toHaveBeenCalledTimes(8);
  });

  it('queries only the user-selected topics', async () => {
    const queryByTopic = vi.fn().mockResolvedValue([]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    await buildFeed({ queryByTopic, getReadSet }, { userTopics: ['ai', 'dev'], limit: 20 });

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
      { queryByTopic, getReadSet },
      { userTopics: ['ai', 'dev'], limit: 20 },
    );

    expect(page.items.map((p) => p.postId)).toEqual(['b', 'a']);
  });

  it('drops posts already read by the user', async () => {
    const a = post('a', 'ai', '2026-07-18T02:00:00.000Z');
    const b = post('b', 'ai', '2026-07-18T03:00:00.000Z');
    const queryByTopic = vi.fn().mockResolvedValue([a, b]);
    const getReadSet = vi.fn().mockResolvedValue(new Set(['b']));

    const page = await buildFeed({ queryByTopic, getReadSet }, { userTopics: ['ai'], limit: 20 });

    expect(page.items.map((p) => p.postId)).toEqual(['a']);
  });

  it('caps candidates fed to getReadSet at 60', async () => {
    const posts = Array.from({ length: 25 }, (_, i) =>
      post(`p${i}`, 'ai', `2026-07-18T00:00:${String(i).padStart(2, '0')}.000Z`),
    );
    const queryByTopic = vi.fn().mockResolvedValue(posts);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    await buildFeed(
      { queryByTopic, getReadSet },
      { userTopics: ['ai', 'dev', 'gadgets'], limit: 20 },
    );

    const candidateIds = getReadSet.mock.calls[0]?.[0] as string[];
    expect(candidateIds.length).toBeLessThanOrEqual(60);
  });

  it('sets nextBefore to null when no topic query returned a full page', async () => {
    const a = post('a', 'ai', '2026-07-18T02:00:00.000Z');
    const queryByTopic = vi.fn().mockResolvedValue([a]);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    const page = await buildFeed({ queryByTopic, getReadSet }, { userTopics: ['ai'], limit: 20 });

    expect(page.nextBefore).toBeNull();
  });

  it('advances nextBefore using the last candidate when a full page was entirely read', async () => {
    const posts = Array.from({ length: 25 }, (_, i) =>
      post(`p${i}`, 'ai', `2026-07-18T00:00:${String(i).padStart(2, '0')}.000Z`),
    );
    const queryByTopic = vi.fn().mockResolvedValue(posts);
    const getReadSet = vi.fn().mockResolvedValue(new Set(posts.map((p) => p.postId)));

    const page = await buildFeed({ queryByTopic, getReadSet }, { userTopics: ['ai'], limit: 20 });

    expect(page.items).toEqual([]);
    expect(page.nextBefore).toBe(posts[0]?.publishedAt);
  });

  it('slices results to the requested limit', async () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      post(`p${i}`, 'ai', `2026-07-18T00:00:${String(i).padStart(2, '0')}.000Z`),
    );
    const queryByTopic = vi.fn().mockResolvedValue(posts);
    const getReadSet = vi.fn().mockResolvedValue(new Set());

    const page = await buildFeed({ queryByTopic, getReadSet }, { userTopics: ['ai'], limit: 3 });

    expect(page.items).toHaveLength(3);
  });
});
