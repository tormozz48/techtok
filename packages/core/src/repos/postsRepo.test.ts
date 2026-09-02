import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestSqlClient } from '../db/testDb';
import type { NewPost } from '../posts.types';
import { PostsRepo } from './postsRepo';

let db: TestSqlClient;
let repo: PostsRepo;

async function seedSource(sourceId: string, name = sourceId): Promise<void> {
  await db.execute(sql`
    insert into sources (slug, name, rss_url, default_topic_id, weight, enabled)
    select ${sourceId}, ${name}, ${`https://example.com/${sourceId}/rss`}, topics.id, 1, true
    from topics where topics.slug = 'dev'
  `);
}

const samplePost: NewPost = {
  url: 'https://example.com/a',
  canonicalUrl: 'https://example.com/a',
  sourceId: 'hn',
  sourceName: 'Hacker News',
  origTitle: 'Title',
  cardTitle: 'Title',
  summary: 'Summary',
  excerpt: 'Summary',
  primaryTopic: 'dev',
  topics: ['dev'],
  status: 'ready',
  transform: 'excerpt',
  publishedAt: '2026-07-18T00:00:00.000Z',
};

async function createPost(overrides: Partial<NewPost> = {}): Promise<string> {
  const postId = await repo.putIfNew({ ...samplePost, ...overrides });
  if (!postId) throw new Error('putIfNew did not create a post');
  return postId;
}

async function expire(postId: string): Promise<void> {
  await db.execute(
    sql`update posts set expires_at = now() - interval '1 day' where id = ${postId}`,
  );
}

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostsRepo(db);
  await seedSource('hn', 'Hacker News');
});

describe('postsRepo.putIfNew', () => {
  it('inserts the post, its topics, and its English translation', async () => {
    const postId = await createPost();

    const [post] = await repo.getByIds([postId]);
    expect(post).toMatchObject({
      postId,
      sourceId: 'hn',
      sourceName: 'Hacker News',
      cardTitle: 'Title',
      summary: 'Summary',
      topics: ['dev'],
      i18n: {},
      compactLangs: undefined,
    });
    expect(typeof post?.ttl).toBe('number');
  });

  it('inserts every given topic', async () => {
    const postId = await createPost({ topics: ['dev', 'ai'] });

    const [post] = await repo.getByIds([postId]);
    expect(post?.topics.sort()).toEqual(['ai', 'dev']);
  });

  it('returns undefined without throwing when the canonical url already exists', async () => {
    const postId = await createPost();

    await expect(
      repo.putIfNew({ ...samplePost, cardTitle: 'A different title' }),
    ).resolves.toBeUndefined();
    const [post] = await repo.getByIds([postId]);
    expect(post?.cardTitle).toBe('Title');
  });
});

describe('postsRepo.queryByTopic', () => {
  it('returns candidates newest-first, unfiltered by status or duplicateOf', async () => {
    const older = await createPost({
      canonicalUrl: 'https://example.com/older',
      publishedAt: '2026-07-18T00:00:00.000Z',
    });
    const newer = await createPost({
      canonicalUrl: 'https://example.com/newer',
      publishedAt: '2026-07-19T00:00:00.000Z',
      status: 'discovered',
    });

    const items = await repo.queryByTopic('dev', { limit: 10 });

    expect(items.map((i) => i.postId)).toEqual([newer, older]);
    expect(items.find((i) => i.postId === newer)?.status).toBe('discovered');
  });

  it('respects the before cursor', async () => {
    const older = await createPost({
      canonicalUrl: 'https://example.com/older',
      publishedAt: '2026-07-18T00:00:00.000Z',
    });
    await createPost({
      canonicalUrl: 'https://example.com/newer',
      publishedAt: '2026-07-19T00:00:00.000Z',
    });

    const items = await repo.queryByTopic('dev', { before: '2026-07-19T00:00:00.000Z' });

    expect(items.map((i) => i.postId)).toEqual([older]);
  });

  it('reports compactLangs for a post via a candidate query', async () => {
    const postId = await createPost();
    await repo.appendCompactLang(postId, 'ru');
    await repo.appendCompactLang(postId, 'uk');

    const [item] = await repo.queryByTopic('dev');

    expect(item?.compactLangs?.sort()).toEqual(['ru', 'uk']);
  });
});

describe('postsRepo.queryRecent', () => {
  it('returns keys across all topics, newest-first', async () => {
    await seedSource('verge', 'The Verge');
    const older = await createPost({ primaryTopic: 'dev' });
    const newer = await createPost({
      canonicalUrl: 'https://example.com/b',
      sourceId: 'verge',
      primaryTopic: 'gadgets',
      publishedAt: '2026-07-19T00:00:00.000Z',
    });

    const items = await repo.queryRecent({ limit: 10 });

    expect(items.map((i) => i.postId)).toEqual([newer, older]);
  });

  it('returns an empty array when there are no posts', async () => {
    expect(await repo.queryRecent()).toEqual([]);
  });
});

describe('postsRepo.getByIds', () => {
  it('returns an empty array without querying when given no ids', async () => {
    expect(await repo.getByIds([])).toEqual([]);
  });

  it('ignores ids that are not database keys', async () => {
    await createPost();

    expect(await repo.getByIds(['not-an-id'])).toEqual([]);
  });

  it('hydrates i18n from non-English translations only', async () => {
    const postId = await createPost();
    await repo.writeTranslation(postId, 'ru', {
      cardTitle: 'Заголовок',
      summary: 'Содержание',
      translatedAt: '2026-07-19T00:00:00.000Z',
    });

    const [post] = await repo.getByIds([postId]);

    expect(post?.i18n.ru).toEqual({
      cardTitle: 'Заголовок',
      summary: 'Содержание',
      whyItMatters: undefined,
      translatedAt: '2026-07-19T00:00:00.000Z',
    });
    expect(post?.i18n.en).toBeUndefined();
  });

  it('hydrates mirroredFigures in position order', async () => {
    const postId = await createPost();
    await repo.setMirroredFigures(postId, [
      { url: 'https://cdn.example.com/1.jpg' },
      { url: 'https://cdn.example.com/2.jpg', caption: 'second' },
    ]);

    const [post] = await repo.getByIds([postId]);

    expect(post?.mirroredFigures).toEqual([
      { url: 'https://cdn.example.com/1.jpg', caption: undefined },
      { url: 'https://cdn.example.com/2.jpg', caption: 'second' },
    ]);
  });

  it('derives dupCount from posts that point back to this one', async () => {
    const original = await createPost();
    const dup1 = await createPost({ canonicalUrl: 'https://example.com/dup1' });
    const dup2 = await createPost({ canonicalUrl: 'https://example.com/dup2' });
    await repo.setDuplicateOf(dup1, original);
    await repo.setDuplicateOf(dup2, original);

    const [post] = await repo.getByIds([original]);

    expect(post?.dupCount).toBe(2);
  });
});

describe('postsRepo.updateTransform', () => {
  it('updates status/transform/excerpt/s3RawKey', async () => {
    const postId = await createPost();

    await repo.updateTransform(postId, {
      status: 'ready',
      transform: 'excerpt',
      excerpt: 'a new excerpt',
      s3RawKey: 'raw/abc123.html',
    });

    const [post] = await repo.getByIds([postId]);
    expect(post).toMatchObject({ excerpt: 'a new excerpt', s3RawKey: 'raw/abc123.html' });
  });

  it('writes the LLM-derived card fields and replaces topics', async () => {
    const postId = await createPost();

    await repo.updateTransform(postId, {
      status: 'ready',
      transform: 'llm',
      cardTitle: 'A Punchy Hook Title',
      whyItMatters: 'Because it does.',
      primaryTopic: 'ai',
      topics: ['ai', 'dev'],
      lang: 'en',
    });

    const [post] = await repo.getByIds([postId]);
    expect(post).toMatchObject({
      cardTitle: 'A Punchy Hook Title',
      whyItMatters: 'Because it does.',
      primaryTopic: 'ai',
      lang: 'en',
    });
    expect(post?.topics.sort()).toEqual(['ai', 'dev']);
  });

  it('leaves summary/whyItMatters untouched when not provided', async () => {
    const postId = await createPost();

    await repo.updateTransform(postId, { status: 'ready', transform: 'excerpt' });

    const [post] = await repo.getByIds([postId]);
    expect(post?.cardTitle).toBe('Title');
    expect(post?.summary).toBe('Summary');
  });

  it('clears imageUrl when clearImageUrl is set (D28)', async () => {
    const postId = await createPost({ imageUrl: 'https://example.com/stub.jpg' });

    await repo.updateTransform(postId, {
      status: 'ready',
      transform: 'excerpt',
      clearImageUrl: true,
    });

    const [post] = await repo.getByIds([postId]);
    expect(post?.imageUrl).toBeUndefined();
  });
});

describe('postsRepo.updateMirroredImage', () => {
  it('sets mirroredImageUrl without touching status/transform', async () => {
    const postId = await createPost();

    await repo.updateMirroredImage(postId, 'https://cdn.example.com/images/abc123.jpg');

    const [post] = await repo.getByIds([postId]);
    expect(post).toMatchObject({
      mirroredImageUrl: 'https://cdn.example.com/images/abc123.jpg',
      status: 'ready',
      transform: 'excerpt',
    });
  });
});

describe('postsRepo.writeTranslation', () => {
  it('upserts a non-English translation', async () => {
    const postId = await createPost();

    await repo.writeTranslation(postId, 'ru', {
      cardTitle: 'Заголовок',
      summary: 'Краткое содержание.',
      whyItMatters: 'Почему это важно.',
      translatedAt: '2026-07-23T00:00:00.000Z',
    });
    await repo.writeTranslation(postId, 'ru', {
      cardTitle: 'Обновлённый заголовок',
      summary: 'Обновлённое содержание.',
      translatedAt: '2026-07-24T00:00:00.000Z',
    });

    const [post] = await repo.getByIds([postId]);
    expect(post?.i18n.ru).toMatchObject({ cardTitle: 'Обновлённый заголовок' });
  });
});

describe('postsRepo.appendCompactLang', () => {
  it('adds the language, idempotently', async () => {
    const postId = await createPost();

    await repo.appendCompactLang(postId, 'ru');
    await repo.appendCompactLang(postId, 'ru');
    await repo.appendCompactLang(postId, 'uk');

    const [post] = await repo.getByIds([postId]);
    expect(post?.compactLangs?.sort()).toEqual(['ru', 'uk']);
  });
});

describe('postsRepo.setMirroredFigures', () => {
  it('overwrites the full figures list, preserving order', async () => {
    const postId = await createPost();
    await repo.setMirroredFigures(postId, [{ url: 'https://cdn.example.com/old.jpg' }]);

    await repo.setMirroredFigures(postId, [
      { url: 'https://cdn.example.com/1.jpg' },
      { url: 'https://cdn.example.com/2.jpg' },
    ]);

    const [post] = await repo.getByIds([postId]);
    expect(post?.mirroredFigures?.map((f) => f.url)).toEqual([
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
    ]);
  });
});

describe('postsRepo.setDuplicateOf', () => {
  it('sets duplicateOf', async () => {
    const duplicate = await createPost();
    const original = await createPost({ canonicalUrl: 'https://example.com/original' });

    await repo.setDuplicateOf(duplicate, original);

    const [post] = await repo.getByIds([duplicate]);
    expect(post?.duplicateOf).toBe(original);
  });

  it('detaches duplicates instead of deleting them when the original expires', async () => {
    const original = await createPost();
    const duplicate = await createPost({ canonicalUrl: 'https://example.com/dup' });
    await repo.setDuplicateOf(duplicate, original);
    await expire(original);

    await repo.deleteExpired();

    const [post] = await repo.getByIds([duplicate]);
    expect(post?.duplicateOf).toBeUndefined();
  });
});

describe('postsRepo.incrementDupCount', () => {
  it('is a harmless no-op (dupCount is derived at read time)', async () => {
    await expect(repo.incrementDupCount('1')).resolves.toBeUndefined();
  });
});

describe('postsRepo.deleteExpired', () => {
  it('deletes only posts whose expiresAt has passed', async () => {
    const expired = await createPost();
    await expire(expired);
    const fresh = await createPost({ canonicalUrl: 'https://example.com/still-fresh' });

    const deleted = await repo.deleteExpired();

    expect(deleted).toBe(1);
    expect(await repo.getByIds([expired])).toEqual([]);
    expect(await repo.getByIds([fresh])).toHaveLength(1);
  });

  it('cascades to child rows', async () => {
    const postId = await createPost();
    await repo.writeTranslation(postId, 'ru', {
      cardTitle: 'Заголовок',
      summary: 'Содержание',
      translatedAt: '2026-07-19T00:00:00.000Z',
    });
    await expire(postId);

    await repo.deleteExpired();

    const translations = await db.execute(
      sql`select 1 from post_translations where post_id = ${postId}`,
    );
    expect(translations.rows).toHaveLength(0);
  });

  it('returns 0 when nothing is expired', async () => {
    await createPost();

    expect(await repo.deleteExpired()).toBe(0);
  });
});
