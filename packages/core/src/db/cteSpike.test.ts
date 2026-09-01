import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestSqlClient } from './testDb';

describe('stage-1 go/no-go CTE spike', () => {
  let db: TestSqlClient;

  beforeEach(async () => {
    db = await createTestDb();
    await db.execute(sql`
      insert into sources (source_id, name, rss_url, default_topic, weight, enabled)
      values ('hn', 'Hacker News', 'https://example.com/rss', 'dev', 1, true)
    `);
    await db.execute(sql`
      insert into users (user_id, created_at, last_seen_at)
      values ('u1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `);
  });

  it('putIfNew: a single data-modifying CTE inserts a post, its topics, and its English translation atomically', async () => {
    const insertOnce = () =>
      db.execute(sql`
        with ins_post as (
          insert into posts (
            post_id, url, canonical_url, source_id, orig_title, excerpt,
            primary_topic, status, transform, published_at, ingested_at, expires_at
          )
          values (
            'p1', 'https://example.com/a', 'https://example.com/a', 'hn', 'Orig Title', 'An excerpt',
            'dev', 'ready', 'llm', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', now() + interval '90 days'
          )
          on conflict (post_id) do nothing
          returning post_id
        ), ins_topics as (
          insert into post_topics (post_id, topic)
          select post_id, v.topic from ins_post, (values ('dev'::topic), ('ai'::topic)) as v(topic)
        ), ins_translation as (
          insert into post_translations (post_id, lang, card_title, summary, translated_at)
          select post_id, 'en', 'Card Title', 'A summary', '2026-01-01T00:00:00.000Z' from ins_post
        )
        select post_id from ins_post
      `);

    const first = await insertOnce();
    expect(first.rows).toHaveLength(1);

    const second = await insertOnce();
    expect(second.rows).toHaveLength(0);

    const topics = await db.execute(sql`select topic from post_topics where post_id = 'p1'`);
    expect(topics.rows).toHaveLength(2);

    const translations = await db.execute(
      sql`select card_title from post_translations where post_id = 'p1' and lang = 'en'`,
    );
    expect(translations.rows).toHaveLength(1);
  });

  it('markRead: upserting post_snapshots and user_reads together reports whether the read was new via xmax', async () => {
    const markRead = (readAt: string) =>
      db.execute(sql`
        with snap as (
          insert into post_snapshots (post_id, card_title, source_name, url, primary_topic)
          values ('p1', 'Card Title', 'Hacker News', 'https://example.com/a', 'dev')
          on conflict (post_id) do update set card_title = excluded.card_title
          returning post_id
        )
        insert into user_reads (user_id, post_id, read_at)
        select 'u1', post_id, ${readAt} from snap
        on conflict (user_id, post_id) do update set read_at = excluded.read_at
        returning (xmax = 0) as was_new
      `);

    const first = await markRead('2026-01-01T00:00:00.000Z');
    expect(first.rows).toEqual([{ was_new: true }]);

    const second = await markRead('2026-01-02T00:00:00.000Z');
    expect(second.rows).toEqual([{ was_new: false }]);

    const reads = await db.execute(sql`select read_at from user_reads where user_id = 'u1'`);
    expect(reads.rows).toEqual([{ read_at: '2026-01-02T00:00:00.000Z' }]);
  });
});
