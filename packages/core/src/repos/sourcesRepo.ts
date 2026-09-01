import { eq, sql } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import { sources } from '../db/schema';
import type { SourceRecord } from '../sources.types';

export interface FetchOutcome {
  readonly status: 'ok' | 'not-modified' | 'error';
  readonly etag?: string;
  readonly lastModified?: string;
  readonly newestSeenPublishedAt?: string;
}

export class SourcesRepo {
  constructor(private readonly db: SqlClient) {}

  async listEnabled(): Promise<SourceRecord[]> {
    const rows = await this.db.select().from(sources).where(eq(sources.enabled, true));
    return rows.map(toSourceRecord);
  }

  async getById(sourceId: string): Promise<SourceRecord | undefined> {
    const [row] = await this.db.select().from(sources).where(eq(sources.sourceId, sourceId));
    return row ? toSourceRecord(row) : undefined;
  }

  async putIfNew(source: SourceRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(sources)
      .values({
        sourceId: source.sourceId,
        name: source.name,
        rssUrl: source.rssUrl,
        siteUrl: source.siteUrl,
        defaultTopic: source.defaultTopic,
        weight: source.weight,
        enabled: source.enabled,
        compactEnabled: source.compactEnabled,
        etag: source.etag,
        lastModified: source.lastModified,
        lastFetchAt: source.lastFetchAt,
        lastStatus: source.lastStatus,
        newestSeenPublishedAt: source.newestSeenPublishedAt,
        failCount: source.failCount,
      })
      .onConflictDoNothing()
      .returning({ sourceId: sources.sourceId });
    return inserted.length > 0;
  }

  async recordFetchResult(sourceId: string, outcome: FetchOutcome): Promise<void> {
    const now = new Date().toISOString();

    if (outcome.status === 'error') {
      await this.db
        .update(sources)
        .set({
          lastFetchAt: now,
          lastStatus: outcome.status,
          failCount: sql`${sources.failCount} + 1`,
        })
        .where(eq(sources.sourceId, sourceId));
      return;
    }

    await this.db
      .update(sources)
      .set({
        lastFetchAt: now,
        lastStatus: outcome.status,
        failCount: 0,
        ...(outcome.etag ? { etag: outcome.etag } : {}),
        ...(outcome.lastModified ? { lastModified: outcome.lastModified } : {}),
        ...(outcome.newestSeenPublishedAt
          ? { newestSeenPublishedAt: outcome.newestSeenPublishedAt }
          : {}),
      })
      .where(eq(sources.sourceId, sourceId));
  }
}

function toSourceRecord(row: typeof sources.$inferSelect): SourceRecord {
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
