import type { sources } from '../db/schema';
import type { SourceRecord } from '../sources.types';

export type SourceRow = typeof sources.$inferSelect;

export class Source {
  constructor(private readonly row: SourceRow) {}

  static toRow(record: SourceRecord): typeof sources.$inferInsert {
    return {
      sourceId: record.sourceId,
      name: record.name,
      rssUrl: record.rssUrl,
      siteUrl: record.siteUrl,
      defaultTopic: record.defaultTopic,
      weight: record.weight,
      enabled: record.enabled,
      compactEnabled: record.compactEnabled,
      etag: record.etag,
      lastModified: record.lastModified,
      lastFetchAt: record.lastFetchAt,
      lastStatus: record.lastStatus,
      newestSeenPublishedAt: record.newestSeenPublishedAt,
      failCount: record.failCount,
    };
  }

  toRecord(): SourceRecord {
    const row = this.row;
    return {
      sourceId: row.sourceId,
      name: row.name,
      rssUrl: row.rssUrl,
      siteUrl: row.siteUrl ?? undefined,
      defaultTopic: row.defaultTopic,
      weight: row.weight,
      enabled: row.enabled,
      etag: row.etag ?? undefined,
      lastModified: row.lastModified ?? undefined,
      lastFetchAt: row.lastFetchAt ?? undefined,
      lastStatus: row.lastStatus ?? undefined,
      newestSeenPublishedAt: row.newestSeenPublishedAt ?? undefined,
      failCount: row.failCount,
      compactEnabled: row.compactEnabled ?? undefined,
    };
  }
}
