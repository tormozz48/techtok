import { eq, sql } from 'drizzle-orm';
import type { SqlClient } from '../clients/sqlClient';
import { sourceStates, sources } from '../db/schema';
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
    const rows = await this.db.query.sources.findMany({
      where: eq(sources.enabled, true),
      with: { defaultTopic: true, state: true },
    });
    return rows.map((row) => new Source(row).toRecord());
  }

  async getById(sourceId: string): Promise<SourceRecord | undefined> {
    const row = await this.db.query.sources.findFirst({
      where: eq(sources.slug, sourceId),
      with: { defaultTopic: true, state: true },
    });
    return row ? new Source(row).toRecord() : undefined;
  }

  async putIfNew(source: SourceRecord): Promise<boolean> {
    const result = await this.db.execute(sql`
      with ins_source as (
        insert into sources (slug, name, rss_url, site_url, default_topic_id, weight, enabled, compact_enabled)
        select ${source.sourceId}, ${source.name}, ${source.rssUrl}, ${source.siteUrl ?? null},
          topics.id, ${source.weight}, ${source.enabled}, ${source.compactEnabled ?? null}
        from topics where topics.slug = ${source.defaultTopic}
        on conflict (slug) do nothing
        returning id
      ), ins_state as (
        insert into source_states (
          source_id, etag, last_modified, last_fetch_at, last_status,
          newest_seen_published_at, fail_count
        )
        select id, ${source.etag ?? null}, ${source.lastModified ?? null},
          ${source.lastFetchAt ?? null}, ${source.lastStatus ?? null}::fetch_status,
          ${source.newestSeenPublishedAt ?? null}, ${source.failCount}
        from ins_source
      )
      select id from ins_source
    `);
    return result.rows.length > 0;
  }

  async recordFetchResult(sourceId: string, outcome: FetchOutcome): Promise<void> {
    await this.db
      .update(sourceStates)
      .set({
        lastFetchAt: new Date().toISOString(),
        lastStatus: outcome.status,
        ...(outcome.status === 'error'
          ? { failCount: sql`${sourceStates.failCount} + 1` }
          : {
              failCount: 0,
              ...(outcome.etag ? { etag: outcome.etag } : {}),
              ...(outcome.lastModified ? { lastModified: outcome.lastModified } : {}),
              ...(outcome.newestSeenPublishedAt
                ? { newestSeenPublishedAt: outcome.newestSeenPublishedAt }
                : {}),
            }),
      })
      .where(
        eq(
          sourceStates.sourceId,
          sql`(select id from ${sources} where ${sources.slug} = ${sourceId})`,
        ),
      );
  }
}
