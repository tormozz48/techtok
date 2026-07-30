import Parser from 'rss-parser';
import type { NewPost } from '../posts.types';
import type { FetchOutcome } from '../repos/sourcesRepo';
import type { SourceRecord } from '../sources.types';
import { errorMessage } from '../util/errors';
import { type FeedEntry, mapEntryToPost } from './rssMapper';

export interface FetchFeedResult {
  readonly status: 'not-modified' | 'ok';
  readonly body?: string;
  readonly etag?: string;
  readonly lastModified?: string;
}

// Cross-source duplicate collapse (phase 4 experiment) — a one-line toggle
// to disable it entirely without touching the call site below.
export const DEDUP_ENABLED = true;

export interface IngestDeps {
  readonly fetchFeed: (source: SourceRecord) => Promise<FetchFeedResult>;
  readonly putIfNew: (post: NewPost) => Promise<boolean>;
  readonly enqueueNew: (posts: NewPost[]) => Promise<void>;
  readonly recordFetchResult: (sourceId: string, outcome: FetchOutcome) => Promise<void>;
  /** Looks for a likely cross-source duplicate of this post (phase 4
   * experiment). Content-level: a lookup failure is caught by the caller and
   * never blocks ingestion of an otherwise-good post. Only called for posts
   * `putIfNew` already confirmed are genuinely new — an RSS feed re-serves
   * its same last N entries on every poll, and running this expensive
   * cross-source GSI lookup against every one of them (rather than just the
   * rare genuinely-new post) was a real, measured DynamoDB cost driver. */
  readonly findDuplicate: (post: NewPost) => Promise<string | undefined>;
  /** Patches `duplicateOf` onto the post `putIfNew` already wrote, once the
   * (necessarily later) dedup lookup resolves. Content-level, like
   * `findDuplicate` — a failure here never blocks ingestion. */
  readonly markDuplicate: (postId: string, duplicateOf: string) => Promise<void>;
  /** Increments the original post's "covered by N sources" counter when a
   * new duplicate is created. Content-level, like `findDuplicate` — a
   * failure here never blocks ingestion of the (already-created) duplicate. */
  readonly recordDuplicate: (originalPostId: string) => Promise<void>;
}

export interface IngestResult {
  readonly sourceId: string;
  readonly seen: number;
  readonly created: number;
  readonly errors: string[];
}

/**
 * Discovers new posts for a single source and enqueues them for transform.
 * Content-level failures (unreachable/malformed feed, a single bad write)
 * are caught and recorded in `errors` — and reflected on the source's
 * `lastStatus`/`failCount` — rather than thrown, so one broken source never
 * stops the others in the same Map fan-out (DESIGN §7.2). `enqueueNew` and
 * the success-path `recordFetchResult` are infra calls (SQS/DDB) and are
 * deliberately left unguarded: if they throw, this function throws too, so
 * the Step Functions Map's own retry/catch handles genuine infra failures
 * separately from content ones.
 */
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
    const feed = await new Parser<unknown, FeedEntry>({
      customFields: {
        item: [
          ['media:content', 'mediaContent', { keepArray: true }],
          ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
        ],
      },
    }).parseString(fetched.body ?? '');

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

      // Dedup only ever runs here, on a post `putIfNew` just confirmed is
      // genuinely new — never against the (much larger) set of already-seen
      // entries a feed re-serves on every poll. See findDuplicate's own doc.
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
