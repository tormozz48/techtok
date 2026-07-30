import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { NewPost } from '../posts.types';
import type { SourceRecord } from '../sources.types';
import type { FetchFeedResult } from './ingestSource';
import { ingestSource } from './ingestSource';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const HN_FIXTURE = path.join(dirname, '__fixtures__/hn.xml');

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
    // putIfNew writes before dedup resolves, so it never sees duplicateOf —
    // markDuplicate patches it on afterward instead.
    for (const [post] of deps.putIfNew.mock.calls) {
      expect(post.duplicateOf).toBeUndefined();
    }
    const flaggedPost = deps.enqueueNew.mock.calls[0]?.[0][0];
    expect(flaggedPost).toMatchObject({ duplicateOf: 'existing-post-id' });
    expect(deps.markDuplicate).toHaveBeenCalledWith(flaggedPost?.postId, 'existing-post-id');
    // Only the one entry findDuplicate flagged should bump the original's count.
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
    deps.putIfNew.mockResolvedValueOnce(false); // pretend this entry was already seen

    const result = await ingestSource(source, deps);

    expect(result.created).toBe(2);
    // The core fix: findDuplicate must never run for an already-known entry —
    // only for the 2 genuinely new ones, not all 3 seen.
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

    // The duplicate post itself was still created and enqueued — only the
    // counter bump on the original failed.
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

    // The post is still enqueued with duplicateOf, and recordDuplicate still
    // runs — the counter bump doesn't depend on the patch write succeeding.
    expect(result.created).toBe(3);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('markDuplicate failed for');
    expect(deps.recordDuplicate).toHaveBeenCalledWith('existing-post-id');
    expect(deps.enqueueNew.mock.calls[0]?.[0][0]).toMatchObject({
      duplicateOf: 'existing-post-id',
    });
  });
});
