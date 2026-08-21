import Parser from 'rss-parser';
import type { NewPost } from '../posts.types';
import type { FetchOutcome } from '../repos/sourcesRepo';
import type { SourceRecord } from '../sources.types';
import { errorMessage } from '../util/errors';
import { type FeedEntry, mapEntryToPost } from './rssMapper';
import { repairFeedXml } from './xmlRepair';

export interface FetchFeedResult {
  readonly status: 'not-modified' | 'ok';
  readonly body?: string;
  readonly etag?: string;
  readonly lastModified?: string;
}

export const DEDUP_ENABLED = true;

export interface IngestDeps {
  readonly fetchFeed: (source: SourceRecord) => Promise<FetchFeedResult>;
  readonly putIfNew: (post: NewPost) => Promise<boolean>;
  readonly enqueueNew: (posts: NewPost[]) => Promise<void>;
  readonly recordFetchResult: (sourceId: string, outcome: FetchOutcome) => Promise<void>;
  readonly findDuplicate: (post: NewPost) => Promise<string | undefined>;
  readonly markDuplicate: (postId: string, duplicateOf: string) => Promise<void>;
  readonly recordDuplicate: (originalPostId: string) => Promise<void>;
}

export interface IngestResult {
  readonly sourceId: string;
  readonly seen: number;
  readonly created: number;
  readonly errors: string[];
}

export async function ingestSource(source: SourceRecord, deps: IngestDeps): Promise<IngestResult> {
  const errors: string[] = [];
  let seen = 0;
  let created = 0;
  const newPosts: NewPost[] = [];

  let fetched: FetchFeedResult;
  try {
    fetched = await deps.fetchFeed(source);
  } catch (err) {
    errors.push(`fetch failed for ${source.sourceId}: ${errorMessage(err)}`);
    await deps.recordFetchResult(source.sourceId, { status: 'error' });
    return { sourceId: source.sourceId, seen, created, errors };
  }

  if (fetched.status === 'not-modified') {
    await deps.recordFetchResult(source.sourceId, { status: 'not-modified' });
    return { sourceId: source.sourceId, seen, created, errors };
  }

  try {
    const feed = await parseFeed(fetched.body ?? '');

    for (const entry of feed.items) {
      seen += 1;
      const post = mapEntryToPost(entry, source);
      if (!post) continue;

      let isNew: boolean;
      try {
        isNew = await deps.putIfNew(post);
      } catch (err) {
        errors.push(`putIfNew failed for ${post.postId}: ${errorMessage(err)}`);
        continue;
      }
      if (!isNew) continue;

      created += 1;
      let enqueuedPost = post;

      if (DEDUP_ENABLED) {
        try {
          const duplicateOf = await deps.findDuplicate(post);
          if (duplicateOf) {
            enqueuedPost = { ...post, duplicateOf };
            try {
              await deps.markDuplicate(post.postId, duplicateOf);
            } catch (err) {
              errors.push(`markDuplicate failed for ${post.postId}: ${errorMessage(err)}`);
            }
            try {
              await deps.recordDuplicate(duplicateOf);
            } catch (err) {
              errors.push(`recordDuplicate failed for ${duplicateOf}: ${errorMessage(err)}`);
            }
          }
        } catch (err) {
          errors.push(`dedup lookup failed for ${post.postId}: ${errorMessage(err)}`);
        }
      }

      newPosts.push(enqueuedPost);
    }
  } catch (err) {
    errors.push(`parse failed for ${source.sourceId}: ${errorMessage(err)}`);
  }

  if (newPosts.length > 0) {
    await deps.enqueueNew(newPosts);
  }

  await deps.recordFetchResult(source.sourceId, {
    status: 'ok',
    etag: fetched.etag,
    lastModified: fetched.lastModified,
  });

  return { sourceId: source.sourceId, seen, created, errors };
}

function createParser(): Parser<unknown, FeedEntry> {
  return new Parser<unknown, FeedEntry>({
    customFields: {
      item: [
        ['media:content', 'mediaContent', { keepArray: true }],
        ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ],
    },
  });
}

async function parseFeed(body: string): Promise<{ items: FeedEntry[] }> {
  try {
    return await createParser().parseString(body);
  } catch (err) {
    const repaired = repairFeedXml(body);
    if (repaired === body) throw err;
    try {
      return await createParser().parseString(repaired);
    } catch {
      throw err;
    }
  }
}
