import type { sourceStates, sources, topics } from '../db/schema';
import type { SourceRecord } from '../sources.types';

export type SourceRow = typeof sources.$inferSelect & {
  defaultTopic: typeof topics.$inferSelect;
  state: typeof sourceStates.$inferSelect | null;
};

export class Source {
  constructor(private readonly row: SourceRow) {}

  toRecord(): SourceRecord {
    const row = this.row;
    const state = row.state;
    return {
      sourceId: row.slug,
      name: row.name,
      rssUrl: row.rssUrl,
      siteUrl: row.siteUrl ?? undefined,
      defaultTopic: row.defaultTopic.slug,
      weight: row.weight,
      enabled: row.enabled,
      etag: state?.etag ?? undefined,
      lastModified: state?.lastModified ?? undefined,
      lastFetchAt: state?.lastFetchAt ?? undefined,
      lastStatus: state?.lastStatus ?? undefined,
      newestSeenPublishedAt: state?.newestSeenPublishedAt ?? undefined,
      failCount: state?.failCount ?? 0,
      compactEnabled: row.compactEnabled ?? undefined,
    };
  }
}
