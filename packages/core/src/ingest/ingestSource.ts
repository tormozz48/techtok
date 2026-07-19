import Parser from 'rss-parser';
import type { NewPost } from '../posts/types';
import { type FeedEntry, mapEntryToPost } from './rssMapper';
import type { SourceConfig } from './sourceConfig';

export interface IngestDeps {
  fetchFeed: (url: string) => Promise<string>;
  putIfNew: (post: NewPost) => Promise<boolean>;
}

export interface IngestResult {
  sourceId: string;
  seen: number;
  created: number;
  errors: string[];
}

/**
 * Fetches and ingests a single source. Content-level failures (an
 * unreachable/malformed feed, a single bad write) are caught and recorded
 * in `errors` rather than thrown, so one broken source never stops the
 * others in the same run (DESIGN §7.2 failure-isolation split).
 */
export async function ingestSource(source: SourceConfig, deps: IngestDeps): Promise<IngestResult> {
  const errors: string[] = [];
  let seen = 0;
  let created = 0;

  try {
    const xml = await deps.fetchFeed(source.rssUrl);
    const feed = await new Parser<unknown, FeedEntry>().parseString(xml);

    for (const entry of feed.items) {
      seen += 1;
      const post = mapEntryToPost(entry, source);
      if (!post) continue;

      try {
        if (await deps.putIfNew(post)) {
          created += 1;
        }
      } catch (err) {
        errors.push(`putIfNew failed for ${post.postId}: ${toMessage(err)}`);
      }
    }
  } catch (err) {
    errors.push(`fetch/parse failed for ${source.sourceId}: ${toMessage(err)}`);
  }

  return { sourceId: source.sourceId, seen, created, errors };
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
