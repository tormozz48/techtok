import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestSqlClient } from './testDb';

describe('stage-1 go/no-go CTE spike', () => {
  let db: TestSqlClient;

  beforeEach(async () => {
    db = await createTestDb();
    await db.execute(sql`
      insert into sources (slug, name, rss_url, default_topic_id, weight, enabled)
      select 'hn', 'Hacker News', 'https://example.com/rss', id, 1, true
      from topics where slug = 'dev'
    `);
    await db.execute(sql`
      insert into users (external_id, created_at, last_seen_at)
      values ('u1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `);
  });

  it('putIfNew: a single data-modifying CTE inserts a post, its topics, and its English translation atomically', async () => {
    const insertOnce = () =>
      db.execute<{ id: number }>(sql`
        with ins_post as (
          insert into posts (
            url, canonical_url, source_id, orig_title, excerpt,
            primary_topic_id, status, transform, published_at, ingested_at, expires_at
          )
          select
            'https://example.com/a', 'https://example.com/a', s.id, 'Orig Title', 'An excerpt',
            pt.id, 'ready', 'llm', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
            now() + interval '90 days'
          from sources s, topics pt
          where s.slug = 'hn' and pt.slug = 'dev'
          on conflict (canonical_url) do nothing
          returning id
        ), ins_topics as (
          insert into post_topics (post_id, topic_id)
          select ins_post.id, t.id from ins_post, topics t where t.slug in ('dev', 'ai')
        ), ins_translation as (
          insert into post_translations (post_id, lang, card_title, summary, translated_at)
          select id, 'en', 'Card Title', 'A summary', '2026-01-01T00:00:00.000Z' from ins_post
        )
        select id from ins_post
      `);

    const first = await insertOnce();
    expect(first.rows).toHaveLength(1);
    const postId = first.rows[0]?.id;

    const second = await insertOnce();
    expect(second.rows).toHaveLength(0);

    const topics = await db.execute(
      sql`select topic_id from post_topics where post_id = ${postId}`,
    );
    expect(topics.rows).toHaveLength(2);

    const translations = await db.execute(
      sql`select card_title from post_translations where post_id = ${postId} and lang = 'en'`,
    );
    expect(translations.rows).toHaveLength(1);
  });

  it('markRead: upserting user_reads reports whether the read was new via xmax', async () => {
    const markRead = (readAt: string) =>
      db.execute(sql`
        insert into user_reads (
          user_id, post_id, read_at, card_title, source_name, url, primary_topic_id
        )
        select u.id, 1, ${readAt}, 'Card Title', 'Hacker News', 'https://example.com/a', t.id
        from users u, topics t
        where u.external_id = 'u1' and t.slug = 'dev'
        on conflict (user_id, post_id) do update set read_at = excluded.read_at
        returning (xmax = 0) as was_new
      `);

    const first = await markRead('2026-01-01T00:00:00.000Z');
    expect(first.rows).toEqual([{ was_new: true }]);

    const second = await markRead('2026-01-02T00:00:00.000Z');
    expect(second.rows).toEqual([{ was_new: false }]);

    const reads = await db.execute(sql`
      select read_at from user_reads
      join users on users.id = user_reads.user_id
      where users.external_id = 'u1'
    `);
    expect(reads.rows).toEqual([{ read_at: '2026-01-02T00:00:00.000Z' }]);
  });
});
