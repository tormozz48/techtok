import { eq, sql } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import { sources } from '../db/schema';
import { Source } from '../models/source';
import type { SourceRecord } from '../sources.types';

export type FetchOutcome =
  | { readonly status: 'error' }
  | {
      readonly status: 'ok' | 'not-modified';
      readonly etag?: string;
      readonly lastModified?: string;
      readonly newestSeenPublishedAt?: string;
    };

export class SourcesRepo {
  constructor(private readonly db: SqlClient) {}

  async listEnabled(): Promise<SourceRecord[]> {
    const rows = await this.db.select().from(sources).where(eq(sources.enabled, true));
    return rows.map((row) => new Source(row).toRecord());
  }

  async getById(sourceId: string): Promise<SourceRecord | undefined> {
    const [row] = await this.db.select().from(sources).where(eq(sources.sourceId, sourceId));
    return row ? new Source(row).toRecord() : undefined;
  }

  async putIfNew(source: SourceRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(sources)
      .values(Source.toRow(source))
      .onConflictDoNothing()
      .returning({ sourceId: sources.sourceId });
    return inserted.length > 0;
  }

  async recordFetchResult(sourceId: string, outcome: FetchOutcome): Promise<void> {
    await this.db
      .update(sources)
      .set({
        lastFetchAt: new Date().toISOString(),
        lastStatus: outcome.status,
        ...(outcome.status === 'error'
          ? { failCount: sql`${sources.failCount} + 1` }
          : {
              failCount: 0,
              ...(outcome.etag ? { etag: outcome.etag } : {}),
              ...(outcome.lastModified ? { lastModified: outcome.lastModified } : {}),
              ...(outcome.newestSeenPublishedAt
                ? { newestSeenPublishedAt: outcome.newestSeenPublishedAt }
                : {}),
            }),
      })
      .where(eq(sources.sourceId, sourceId));
  }
}
