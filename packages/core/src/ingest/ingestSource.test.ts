import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { NewPost } from '../posts/types';
import { ingestSource } from './ingestSource';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const HN_FIXTURE = path.join(dirname, '__fixtures__/hn.xml');

function fakeRepo() {
  const seen = new Set<string>();
  const putIfNew = vi.fn(async (post: NewPost) => {
    if (seen.has(post.postId)) return false;
    seen.add(post.postId);
    return true;
  });
  return { putIfNew };
}

const source = {
  sourceId: 'hn',
  name: 'Hacker News',
  rssUrl: 'https://hnrss.org/frontpage',
  defaultTopic: 'dev' as const,
};

describe('ingestSource', () => {
  it('fetches, maps, and creates new posts', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const fetchFeed = vi.fn(async () => xml);
    const { putIfNew } = fakeRepo();

    const result = await ingestSource(source, { fetchFeed, putIfNew });

    expect(result).toEqual({ sourceId: 'hn', seen: 3, created: 3, errors: [] });
    expect(putIfNew).toHaveBeenCalledTimes(3);
  });

  it('does not recreate posts already seen on a second run', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const fetchFeed = vi.fn(async () => xml);
    const { putIfNew } = fakeRepo();

    await ingestSource(source, { fetchFeed, putIfNew });
    const second = await ingestSource(source, { fetchFeed, putIfNew });

    expect(second).toEqual({ sourceId: 'hn', seen: 3, created: 0, errors: [] });
  });

  it('records an error and returns cleanly when the feed fetch fails', async () => {
    const fetchFeed = vi.fn(async (): Promise<string> => {
      throw new Error('network down');
    });
    const { putIfNew } = fakeRepo();

    const result = await ingestSource(source, { fetchFeed, putIfNew });

    expect(result.seen).toBe(0);
    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('network down');
  });

  it('records a per-item error but keeps processing the remaining entries', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const fetchFeed = vi.fn(async () => xml);
    let calls = 0;
    const putIfNew = vi.fn(async (): Promise<boolean> => {
      calls += 1;
      if (calls === 1) throw new Error('conditional write blew up');
      return true;
    });

    const result = await ingestSource(source, { fetchFeed, putIfNew });

    expect(result.seen).toBe(3);
    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('conditional write blew up');
  });
});
