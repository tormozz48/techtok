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
   * never blocks ingestion of an otherwise-good post. */
  readonly findDuplicate: (post: NewPost) => Promise<string | undefined>;
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
    const feed = await parseFeed(fetched.body ?? '');

    for (const entry of feed.items) {
      seen += 1;
      let post = mapEntryToPost(entry, source);
      if (!post) continue;

      if (DEDUP_ENABLED) {
        try {
          const duplicateOf = await deps.findDuplicate(post);
          if (duplicateOf) post = { ...post, duplicateOf };
        } catch (err) {
          errors.push(`dedup lookup failed for ${post.postId}: ${errorMessage(err)}`);
        }
      }

      try {
        if (await deps.putIfNew(post)) {
          created += 1;
          newPosts.push(post);

          // Only a genuinely new duplicate should bump the count — a
          // re-seen RSS entry on a later poll is caught by putIfNew
          // returning false above, before this ever runs.
          if (post.duplicateOf) {
            try {
              await deps.recordDuplicate(post.duplicateOf);
            } catch (err) {
              errors.push(`recordDuplicate failed for ${post.duplicateOf}: ${errorMessage(err)}`);
            }
          }
        }
      } catch (err) {
        errors.push(`putIfNew failed for ${post.postId}: ${errorMessage(err)}`);
      }
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

/**
 * Parses a feed strictly, falling back once to a repaired copy of the body.
 *
 * `sax` aborts the entire document on a single malformed attribute, so an
 * upstream glitch costs us every item in that poll rather than just the one
 * bad element — Nature's feed does exactly this a few times a week (see
 * `xmlRepair.ts`). The strict parse is always tried first, so a well-formed
 * feed is never rewritten; only a feed that has *already* failed is repaired.
 * If the repaired copy fails too, the original error is thrown, since it
 * describes the real defect rather than an artifact of our rewriting.
 */
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
