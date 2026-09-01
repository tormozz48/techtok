import { describe, expect, it } from 'vitest';
import {
  dropDanglingDuplicates,
  isBookmarkRow,
  isReadRow,
  transformActivity,
  transformPost,
  transformSource,
  transformUser,
} from './migrationTransforms';

const VALID_SOURCE_IDS = new Set(['hn']);

describe('transformSource', () => {
  it('maps a well-formed source item', () => {
    const { row, violations } = transformSource({
      sourceId: 'hn',
      name: 'Hacker News',
      rssUrl: 'https://hnrss.org/frontpage',
      defaultTopic: 'dev',
      weight: 1,
      enabled: true,
      failCount: 0,
    });

    expect(violations).toEqual([]);
    expect(row).toMatchObject({ sourceId: 'hn', name: 'Hacker News', defaultTopic: 'dev' });
  });

  it('flags an invalid defaultTopic instead of guessing', () => {
    const { row, violations } = transformSource({
      sourceId: 'hn',
      defaultTopic: 'not-a-real-topic',
    });

    expect(row).toBeNull();
    expect(violations).toEqual(['invalid defaultTopic: not-a-real-topic']);
  });
});

describe('transformPost', () => {
  const validItem = {
    postId: 'abc123',
    url: 'https://example.com/a',
    canonicalUrl: 'https://example.com/a',
    sourceId: 'hn',
    origTitle: 'Title',
    cardTitle: 'Title',
    summary: 'Summary',
    excerpt: 'Summary',
    primaryTopic: 'dev',
    topics: ['dev'],
    status: 'ready',
    transform: 'excerpt',
    publishedAt: '2026-07-18T00:00:00.000Z',
    ingestedAt: '2026-07-18T00:00:05.000Z',
    ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
  };

  it('splits a well-formed post into its five table rows', () => {
    const { row, violations } = transformPost(validItem, VALID_SOURCE_IDS);

    expect(violations).toEqual([]);
    expect(row?.post).toMatchObject({ postId: 'abc123', sourceId: 'hn', primaryTopic: 'dev' });
    expect(row?.translations).toEqual([
      {
        postId: 'abc123',
        lang: 'en',
        cardTitle: 'Title',
        summary: 'Summary',
        whyItMatters: null,
        translatedAt: '2026-07-18T00:00:05.000Z',
      },
    ]);
    expect(row?.topics).toEqual([{ postId: 'abc123', topic: 'dev' }]);
    expect(row?.compacts).toEqual([]);
    expect(row?.figures).toEqual([]);
  });

  it('handles a pre-Phase-8 post with no i18n attribute at all', () => {
    const { row, violations } = transformPost({ ...validItem, i18n: undefined }, VALID_SOURCE_IDS);

    expect(violations).toEqual([]);
    expect(row?.translations).toHaveLength(1);
  });

  it('fans out non-English i18n entries into extra translation rows', () => {
    const { row } = transformPost(
      {
        ...validItem,
        i18n: {
          ru: {
            cardTitle: 'Заголовок',
            summary: 'Содержание',
            translatedAt: '2026-07-19T00:00:00.000Z',
          },
          uk: {
            cardTitle: 'Заголовок',
            summary: 'Зміст',
            translatedAt: '2026-07-19T00:00:01.000Z',
          },
        },
      },
      VALID_SOURCE_IDS,
    );

    expect(row?.translations.map((t) => t.lang).sort()).toEqual(['en', 'ru', 'uk']);
  });

  it('preserves figure order via a position column', () => {
    const { row } = transformPost(
      {
        ...validItem,
        mirroredFigures: [
          { url: 'https://cdn/1.jpg' },
          { url: 'https://cdn/2.jpg', caption: 'two' },
        ],
      },
      VALID_SOURCE_IDS,
    );

    expect(row?.figures).toEqual([
      { postId: 'abc123', position: 0, url: 'https://cdn/1.jpg', caption: null },
      { postId: 'abc123', position: 1, url: 'https://cdn/2.jpg', caption: 'two' },
    ]);
  });

  it('flags an invalid primaryTopic and skips the row entirely', () => {
    const { row, violations } = transformPost(
      { ...validItem, primaryTopic: 'not-a-topic' },
      VALID_SOURCE_IDS,
    );

    expect(row).toBeNull();
    expect(violations).toContain('invalid primaryTopic: not-a-topic');
  });

  it("passes duplicateOf through untouched -- cross-post validity is dropDanglingDuplicates' job, not this function's", () => {
    const { row, violations } = transformPost(
      { ...validItem, duplicateOf: 'other-post-id' },
      VALID_SOURCE_IDS,
    );

    expect(violations).toEqual([]);
    expect(row?.post.duplicateOf).toBe('other-post-id');
  });

  it('falls back to a fresh 90-day expiry when ttl is missing', () => {
    const { row } = transformPost({ ...validItem, ttl: undefined }, VALID_SOURCE_IDS);

    expect(row?.post.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a post whose sourceId does not exist among the migrating sources', () => {
    const { row, violations } = transformPost(
      { ...validItem, sourceId: 'ghost-source' },
      VALID_SOURCE_IDS,
    );

    expect(row).toBeNull();
    expect(violations).toContain('unknown sourceId: ghost-source');
  });
});

describe('dropDanglingDuplicates', () => {
  const baseRow = (postId: string, duplicateOf: string | null) => ({
    post: {
      postId,
      url: 'https://example.com/a',
      canonicalUrl: 'https://example.com/a',
      sourceId: 'hn',
      origTitle: 'Title',
      excerpt: 'Summary',
      imageUrl: null,
      mirroredImageUrl: null,
      primaryTopic: 'dev' as const,
      status: 'ready' as const,
      transform: 'excerpt' as const,
      lang: null,
      s3RawKey: null,
      duplicateOf,
      publishedAt: '2026-07-18T00:00:00.000Z',
      ingestedAt: '2026-07-18T00:00:00.000Z',
      expiresAt: new Date(),
    },
    translations: [],
    topics: [],
    compacts: [],
    figures: [],
  });

  it('keeps a duplicateOf that points at another migrating post', () => {
    const rows = [baseRow('a', null), baseRow('b', 'a')];

    const { rows: fixed, notes } = dropDanglingDuplicates(rows);

    expect(fixed.find((r) => r.post.postId === 'b')?.post.duplicateOf).toBe('a');
    expect(notes).toEqual([]);
  });

  it('drops a duplicateOf pointing at a post that is not among the migrating rows', () => {
    const rows = [baseRow('b', 'never-existed')];

    const { rows: fixed, notes } = dropDanglingDuplicates(rows);

    expect(fixed[0]?.post.duplicateOf).toBeNull();
    expect(notes).toEqual([
      'post b: dropped duplicateOf reference to never-existed, which is not among the migrating posts',
    ]);
  });
});

describe('transformUser', () => {
  it('maps a well-formed user with all optional aspects present', () => {
    const { row, violations } = transformUser(
      {
        userId: 'g:123',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastSeenAt: '2026-08-01T00:00:00.000Z',
        language: 'uk',
        topics: ['ai', 'dev'],
        mutedSources: ['hn'],
        topicReads: { ai: 5, dev: 2 },
        quota: { day: '2026-08-01', cardReads: 3, readerOpens: 1 },
        entitlement: { plan: 'plus', source: 'manual', verifiedAt: '2026-08-01T00:00:00.000Z' },
      },
      VALID_SOURCE_IDS,
    );

    expect(violations).toEqual([]);
    expect(row?.topics).toEqual([
      { userId: 'g:123', topic: 'ai' },
      { userId: 'g:123', topic: 'dev' },
    ]);
    expect(row?.mutedSources).toEqual([{ userId: 'g:123', sourceId: 'hn' }]);
    expect(row?.topicReads.sort((a, b) => a.topic.localeCompare(b.topic))).toEqual([
      { userId: 'g:123', topic: 'ai', readCount: 5 },
      { userId: 'g:123', topic: 'dev', readCount: 2 },
    ]);
    expect(row?.quota).toEqual({
      userId: 'g:123',
      day: '2026-08-01',
      cardReads: 3,
      readerOpens: 1,
    });
    expect(row?.entitlement).toMatchObject({ userId: 'g:123', plan: 'plus', source: 'manual' });
  });

  it('maps a bare user with no optional aspects', () => {
    const { row, violations } = transformUser({ userId: 'g:456' }, VALID_SOURCE_IDS);

    expect(violations).toEqual([]);
    expect(row).toMatchObject({
      user: { userId: 'g:456' },
      topics: [],
      mutedSources: [],
      topicReads: [],
      quota: null,
      entitlement: null,
    });
  });

  it('drops a mutedSources entry referencing an unknown sourceId, keeping the user (real bug: e2e-mutation-test-source)', () => {
    const { row, violations, notes } = transformUser(
      { userId: 'g:456', mutedSources: ['hn', 'e2e-mutation-test-source'] },
      VALID_SOURCE_IDS,
    );

    expect(row).not.toBeNull();
    expect(violations).toEqual([]);
    expect(row?.mutedSources).toEqual([{ userId: 'g:456', sourceId: 'hn' }]);
    expect(notes).toEqual([
      'dropped mutedSources referencing unknown sourceId(s): e2e-mutation-test-source',
    ]);
  });

  it('flags an invalid entitlement.plan', () => {
    const { row, violations } = transformUser(
      {
        userId: 'g:456',
        entitlement: { plan: 'gold', source: 'manual', verifiedAt: '2026-08-01T00:00:00.000Z' },
      },
      VALID_SOURCE_IDS,
    );

    expect(row).toBeNull();
    expect(violations).toContain('invalid entitlement.plan: gold');
  });
});

describe('transformActivity', () => {
  it('maps a read-marker item', () => {
    const { row, violations } = transformActivity({
      userId: 'g:123',
      sk: 'read#abc123',
      postId: 'abc123',
      readAt: '2026-07-18T00:00:00.000Z',
      snapshot: { cardTitle: 'Title', sourceName: 'Hacker News', url: 'https://example.com/a' },
    });

    expect(violations).toEqual([]);
    expect(row).toEqual({
      userId: 'g:123',
      postId: 'abc123',
      at: '2026-07-18T00:00:00.000Z',
      cardTitle: 'Title',
      sourceName: 'Hacker News',
      url: 'https://example.com/a',
      primaryTopic: null,
    });
  });

  it('flags a missing snapshot', () => {
    const { row, violations } = transformActivity({
      userId: 'g:123',
      sk: 'bm#abc123',
      postId: 'abc123',
      bookmarkedAt: '2026-07-18T00:00:00.000Z',
    });

    expect(row).toBeNull();
    expect(violations).toContain('missing one of snapshot.cardTitle/sourceName/url');
  });
});

describe('isReadRow / isBookmarkRow', () => {
  it('distinguishes read markers from bookmarks by sort-key prefix', () => {
    expect(isReadRow({ sk: 'read#abc' })).toBe(true);
    expect(isReadRow({ sk: 'bm#abc' })).toBe(false);
    expect(isBookmarkRow({ sk: 'bm#abc' })).toBe(true);
    expect(isBookmarkRow({ sk: 'read#abc' })).toBe(false);
  });
});
