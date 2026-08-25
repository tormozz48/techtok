import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { NewPost } from '../posts.types';
import type { SourceRecord } from '../sources.types';
import type { FetchFeedResult } from './ingestSource';
import { ingestSource, MAX_ITEMS_PER_FETCH } from './ingestSource';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const HN_FIXTURE = path.join(dirname, '__fixtures__/hn.xml');
const NATURE_MALFORMED_FIXTURE = path.join(dirname, '__fixtures__/nature-malformed.xml');

function fakeDeps(xml: string) {
  const seen = new Set<string>();
  const putIfNew = vi.fn(async (post: NewPost) => {
    if (seen.has(post.postId)) return false;
    seen.add(post.postId);
    return true;
  });
  const enqueueNew = vi.fn(async (_posts: NewPost[]) => {});
  const recordFetchResult = vi.fn(async (_sourceId: string, _outcome: unknown) => {});
  const fetchFeed = vi.fn(
    async (): Promise<FetchFeedResult> => ({ status: 'ok', body: xml, etag: '"v1"' }),
  );
  const findDuplicate = vi.fn(async (): Promise<string | undefined> => undefined);
  const markDuplicate = vi.fn(async (_postId: string, _duplicateOf: string) => {});
  const recordDuplicate = vi.fn(async (_originalPostId: string) => {});
  return {
    putIfNew,
    enqueueNew,
    recordFetchResult,
    fetchFeed,
    findDuplicate,
    markDuplicate,
    recordDuplicate,
  };
}

const source: SourceRecord = {
  sourceId: 'hn',
  name: 'Hacker News',
  rssUrl: 'https://hnrss.org/frontpage',
  defaultTopic: 'dev',
  weight: 1,
  enabled: true,
  failCount: 0,
};

describe('ingestSource', () => {
  it('fetches, maps, creates new posts, and enqueues only the new ones', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);

    const result = await ingestSource(source, deps);

    expect(result).toEqual({ sourceId: 'hn', seen: 3, created: 3, errors: [] });
    expect(deps.putIfNew).toHaveBeenCalledTimes(3);
    expect(deps.enqueueNew).toHaveBeenCalledTimes(1);
    expect(deps.enqueueNew.mock.calls[0]?.[0]).toHaveLength(3);
    expect(deps.recordFetchResult).toHaveBeenCalledWith('hn', {
      status: 'ok',
      etag: '"v1"',
      lastModified: undefined,
      newestSeenPublishedAt: expect.any(String),
    });
  });

  it('does not recreate or re-enqueue posts already seen on a second run', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);

    await ingestSource(source, deps);
    deps.enqueueNew.mockClear();
    const second = await ingestSource(source, deps);

    expect(second).toEqual({ sourceId: 'hn', seen: 3, created: 0, errors: [] });
    expect(deps.enqueueNew).not.toHaveBeenCalled();
  });

  it('short-circuits on a 304 without enqueueing or writing posts', async () => {
    const deps = fakeDeps('');
    deps.fetchFeed.mockResolvedValueOnce({ status: 'not-modified' });

    const result = await ingestSource(source, deps);

    expect(result).toEqual({ sourceId: 'hn', seen: 0, created: 0, errors: [] });
    expect(deps.putIfNew).not.toHaveBeenCalled();
    expect(deps.enqueueNew).not.toHaveBeenCalled();
    expect(deps.recordFetchResult).toHaveBeenCalledWith('hn', { status: 'not-modified' });
  });

  it('records an error and returns cleanly when the feed fetch fails', async () => {
    const deps = fakeDeps('');
    deps.fetchFeed.mockRejectedValueOnce(new Error('network down'));

    const result = await ingestSource(source, deps);

    expect(result.seen).toBe(0);
    expect(result.created).toBe(0);
    expect(result.errors[0]).toContain('network down');
    expect(deps.recordFetchResult).toHaveBeenCalledWith('hn', { status: 'error' });
    expect(deps.enqueueNew).not.toHaveBeenCalled();
  });

  it('records a per-item error but keeps processing the remaining entries', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);
    let calls = 0;
    deps.putIfNew.mockImplementation(async (): Promise<boolean> => {
      calls += 1;
      if (calls === 1) throw new Error('conditional write blew up');
      return true;
    });

    const result = await ingestSource(source, deps);

    expect(result.seen).toBe(3);
    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('conditional write blew up');
    expect(deps.enqueueNew.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('propagates enqueueNew failures instead of swallowing them', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);
    deps.enqueueNew.mockRejectedValueOnce(new Error('sqs down'));

    await expect(ingestSource(source, deps)).rejects.toThrow('sqs down');
  });

  it('still creates a post flagged as a duplicate — data is never lost, just marked', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);
    deps.findDuplicate.mockResolvedValueOnce('existing-post-id');

    const result = await ingestSource(source, deps);

    expect(result.created).toBe(3);
    for (const [post] of deps.putIfNew.mock.calls) {
      expect(post.duplicateOf).toBeUndefined();
    }
    const flaggedPost = deps.enqueueNew.mock.calls[0]?.[0][0];
    expect(flaggedPost).toMatchObject({ duplicateOf: 'existing-post-id' });
    expect(deps.markDuplicate).toHaveBeenCalledWith(flaggedPost?.postId, 'existing-post-id');
    expect(deps.recordDuplicate).toHaveBeenCalledTimes(1);
    expect(deps.recordDuplicate).toHaveBeenCalledWith('existing-post-id');
  });

  it('records a soft error but still creates the post when the dedup lookup fails', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);
    deps.findDuplicate.mockRejectedValueOnce(new Error('query timed out'));

    const result = await ingestSource(source, deps);

    expect(result.created).toBe(3);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('dedup lookup failed');
    expect(deps.putIfNew).toHaveBeenCalledTimes(3);
    for (const [post] of deps.putIfNew.mock.calls) {
      expect(post.duplicateOf).toBeUndefined();
    }
    expect(deps.recordDuplicate).not.toHaveBeenCalled();
  });

  it('skips the dedup lookup entirely for a post putIfNew says is not new', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);
    deps.putIfNew.mockResolvedValueOnce(false);

    const result = await ingestSource(source, deps);

    expect(result.created).toBe(2);
    expect(deps.findDuplicate).toHaveBeenCalledTimes(2);
    expect(deps.markDuplicate).not.toHaveBeenCalled();
    expect(deps.recordDuplicate).not.toHaveBeenCalled();
  });

  it('records a soft error but keeps the run clean when recordDuplicate fails', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);
    deps.findDuplicate.mockResolvedValueOnce('existing-post-id');
    deps.recordDuplicate.mockRejectedValueOnce(new Error('conditional check failed'));

    const result = await ingestSource(source, deps);

    expect(result.created).toBe(3);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('recordDuplicate failed for existing-post-id');
    expect(deps.markDuplicate).toHaveBeenCalledWith(expect.any(String), 'existing-post-id');
    expect(deps.enqueueNew.mock.calls[0]?.[0][0]).toMatchObject({
      duplicateOf: 'existing-post-id',
    });
  });

  it('records a soft error but keeps the run clean when markDuplicate fails', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);
    deps.findDuplicate.mockResolvedValueOnce('existing-post-id');
    deps.markDuplicate.mockRejectedValueOnce(new Error('conditional check failed'));

    const result = await ingestSource(source, deps);

    expect(result.created).toBe(3);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('markDuplicate failed for');
    expect(deps.recordDuplicate).toHaveBeenCalledWith('existing-post-id');
    expect(deps.enqueueNew.mock.calls[0]?.[0][0]).toMatchObject({
      duplicateOf: 'existing-post-id',
    });
  });

  it('recovers every entry from a feed with a valueless attribute instead of dropping the poll', async () => {
    const xml = await readFile(NATURE_MALFORMED_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);

    const result = await ingestSource({ ...source, sourceId: 'nature' }, deps);

    expect(result.errors).toEqual([]);
    expect(result.seen).toBe(2);
    expect(result.created).toBe(2);
    expect(deps.enqueueNew.mock.calls[0]?.[0]).toHaveLength(2);
    expect(deps.recordFetchResult).toHaveBeenCalledWith('nature', {
      status: 'ok',
      etag: '"v1"',
      lastModified: undefined,
      newestSeenPublishedAt: expect.any(String),
    });
  });

  it('skips writes for items already covered by the source watermark, without calling putIfNew', async () => {
    const xml = await readFile(HN_FIXTURE, 'utf8');
    const deps = fakeDeps(xml);
    const watermarked: SourceRecord = {
      ...source,
      newestSeenPublishedAt: new Date('Sat, 18 Jul 2026 17:53:05 +0000').toISOString(),
    };

    const result = await ingestSource(watermarked, deps);

    expect(result).toEqual({ sourceId: 'hn', seen: 3, created: 0, errors: [] });
    expect(deps.putIfNew).not.toHaveBeenCalled();
    expect(deps.enqueueNew).not.toHaveBeenCalled();
    expect(deps.recordFetchResult).toHaveBeenCalledWith('hn', {
      status: 'ok',
      etag: '"v1"',
      lastModified: undefined,
      newestSeenPublishedAt: watermarked.newestSeenPublishedAt,
    });
  });

  it('caps the number of feed items processed per fetch at MAX_ITEMS_PER_FETCH', async () => {
    const itemCount = MAX_ITEMS_PER_FETCH + 5;
    const items = Array.from({ length: itemCount }, (_, i) => {
      const pubDate = new Date(Date.UTC(2026, 6, 18, 0, 0, itemCount - i)).toUTCString();
      return `<item><title>Item ${i}</title><link>https://example.com/${i}</link><pubDate>${pubDate}</pubDate></item>`;
    }).join('\n');
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Many</title><link>https://example.com</link><description>d</description>${items}</channel></rss>`;
    const deps = fakeDeps(xml);

    const result = await ingestSource(source, deps);

    expect(result.seen).toBe(MAX_ITEMS_PER_FETCH);
    expect(deps.putIfNew).toHaveBeenCalledTimes(MAX_ITEMS_PER_FETCH);
  });

  it('reports the original parse error when the body is too broken to repair', async () => {
    const deps = fakeDeps('<rss><channel><item><title>unclosed');

    const result = await ingestSource(source, deps);

    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('parse failed for hn');
    expect(deps.enqueueNew).not.toHaveBeenCalled();
  });
});
