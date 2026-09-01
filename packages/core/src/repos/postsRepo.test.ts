import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { sources } from '../db/schema';
import { createTestDb, type TestSqlClient } from '../db/testDb';
import type { NewPost } from '../posts.types';
import { PostsRepo } from './postsRepo';

let db: TestSqlClient;
let repo: PostsRepo;

async function seedSource(sourceId: string, name = sourceId): Promise<void> {
  await db.insert(sources).values({
    sourceId,
    name,
    rssUrl: `https://example.com/${sourceId}/rss`,
    defaultTopic: 'dev',
    weight: 1,
    enabled: true,
  });
}

const samplePost: NewPost = {
  postId: 'abc123',
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

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostsRepo(db);
  await seedSource('hn', 'Hacker News');
});

describe('postsRepo.putIfNew', () => {
  it('inserts the post, its topics, and its English translation', async () => {
    const created = await repo.putIfNew(samplePost);

    expect(created).toBe(true);
    const [post] = await repo.getByIds(['abc123']);
    expect(post).toMatchObject({
      postId: 'abc123',
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
    await repo.putIfNew({ ...samplePost, topics: ['dev', 'ai'] });

    const [post] = await repo.getByIds(['abc123']);
    expect(post?.topics.sort()).toEqual(['ai', 'dev']);
  });

  it('returns false without throwing when the post already exists', async () => {
    await repo.putIfNew(samplePost);

    await expect(repo.putIfNew({ ...samplePost, cardTitle: 'A different title' })).resolves.toBe(
      false,
    );
    const [post] = await repo.getByIds(['abc123']);
    expect(post?.cardTitle).toBe('Title');
  });
});

describe('postsRepo.queryByTopic', () => {
  it('returns candidates newest-first, unfiltered by status or duplicateOf', async () => {
    await repo.putIfNew({ ...samplePost, postId: 'a', publishedAt: '2026-07-18T00:00:00.000Z' });
    await repo.putIfNew({
      ...samplePost,
      postId: 'b',
      publishedAt: '2026-07-19T00:00:00.000Z',
      status: 'discovered',
    });

    const items = await repo.queryByTopic('dev', { limit: 10 });

    expect(items.map((i) => i.postId)).toEqual(['b', 'a']);
    expect(items.find((i) => i.postId === 'b')?.status).toBe('discovered');
  });

  it('respects the before cursor', async () => {
    await repo.putIfNew({ ...samplePost, postId: 'a', publishedAt: '2026-07-18T00:00:00.000Z' });
    await repo.putIfNew({ ...samplePost, postId: 'b', publishedAt: '2026-07-19T00:00:00.000Z' });

    const items = await repo.queryByTopic('dev', { before: '2026-07-19T00:00:00.000Z' });

    expect(items.map((i) => i.postId)).toEqual(['a']);
  });

  it('reports compactLangs for a post via a candidate query', async () => {
    await repo.putIfNew(samplePost);
    await repo.appendCompactLang('abc123', 'ru');
    await repo.appendCompactLang('abc123', 'uk');

    const [item] = await repo.queryByTopic('dev');

    expect(item?.compactLangs?.sort()).toEqual(['ru', 'uk']);
  });
});

describe('postsRepo.queryRecent', () => {
  it('returns keys across all topics, newest-first', async () => {
    await seedSource('verge', 'The Verge');
    await repo.putIfNew({ ...samplePost, postId: 'a', primaryTopic: 'dev' });
    await repo.putIfNew({
      ...samplePost,
      postId: 'b',
      sourceId: 'verge',
      primaryTopic: 'gadgets',
      publishedAt: '2026-07-19T00:00:00.000Z',
    });

    const items = await repo.queryRecent({ limit: 10 });

    expect(items.map((i) => i.postId)).toEqual(['b', 'a']);
  });

  it('returns an empty array when there are no posts', async () => {
    expect(await repo.queryRecent()).toEqual([]);
  });
});

describe('postsRepo.getByIds', () => {
  it('returns an empty array without querying when given no ids', async () => {
    expect(await repo.getByIds([])).toEqual([]);
  });

  it('hydrates i18n from non-English translations only', async () => {
    await repo.putIfNew(samplePost);
    await repo.writeTranslation('abc123', 'ru', {
      cardTitle: 'Заголовок',
      summary: 'Содержание',
      translatedAt: '2026-07-19T00:00:00.000Z',
    });

    const [post] = await repo.getByIds(['abc123']);

    expect(post?.i18n.ru).toEqual({
      cardTitle: 'Заголовок',
      summary: 'Содержание',
      whyItMatters: undefined,
      translatedAt: '2026-07-19T00:00:00.000Z',
    });
    expect(post?.i18n.en).toBeUndefined();
  });

  it('hydrates mirroredFigures in position order', async () => {
    await repo.putIfNew(samplePost);
    await repo.setMirroredFigures('abc123', [
      { url: 'https://cdn.example.com/1.jpg' },
      { url: 'https://cdn.example.com/2.jpg', caption: 'second' },
    ]);

    const [post] = await repo.getByIds(['abc123']);

    expect(post?.mirroredFigures).toEqual([
      { url: 'https://cdn.example.com/1.jpg', caption: undefined },
      { url: 'https://cdn.example.com/2.jpg', caption: 'second' },
    ]);
  });

  it('derives dupCount from posts that point back to this one', async () => {
    await repo.putIfNew(samplePost);
    await repo.putIfNew({ ...samplePost, postId: 'dup1' });
    await repo.putIfNew({ ...samplePost, postId: 'dup2' });
    await repo.setDuplicateOf('dup1', 'abc123');
    await repo.setDuplicateOf('dup2', 'abc123');

    const [post] = await repo.getByIds(['abc123']);

    expect(post?.dupCount).toBe(2);
  });
});

describe('postsRepo.updateTransform', () => {
  it('updates status/transform/excerpt/s3RawKey', async () => {
    await repo.putIfNew(samplePost);

    await repo.updateTransform('abc123', {
      status: 'ready',
      transform: 'excerpt',
      excerpt: 'a new excerpt',
      s3RawKey: 'raw/abc123.html',
    });

    const [post] = await repo.getByIds(['abc123']);
    expect(post).toMatchObject({ excerpt: 'a new excerpt', s3RawKey: 'raw/abc123.html' });
  });

  it('writes the LLM-derived card fields and replaces topics', async () => {
    await repo.putIfNew(samplePost);

    await repo.updateTransform('abc123', {
      status: 'ready',
      transform: 'llm',
      cardTitle: 'A Punchy Hook Title',
      whyItMatters: 'Because it does.',
      primaryTopic: 'ai',
      topics: ['ai', 'dev'],
      lang: 'en',
    });

    const [post] = await repo.getByIds(['abc123']);
    expect(post).toMatchObject({
      cardTitle: 'A Punchy Hook Title',
      whyItMatters: 'Because it does.',
      primaryTopic: 'ai',
      lang: 'en',
    });
    expect(post?.topics.sort()).toEqual(['ai', 'dev']);
  });

  it('leaves summary/whyItMatters untouched when not provided', async () => {
    await repo.putIfNew(samplePost);

    await repo.updateTransform('abc123', { status: 'ready', transform: 'excerpt' });

    const [post] = await repo.getByIds(['abc123']);
    expect(post?.cardTitle).toBe('Title');
    expect(post?.summary).toBe('Summary');
  });

  it('clears imageUrl when clearImageUrl is set (D28)', async () => {
    await repo.putIfNew({ ...samplePost, imageUrl: 'https://example.com/stub.jpg' });

    await repo.updateTransform('abc123', {
      status: 'ready',
      transform: 'excerpt',
      clearImageUrl: true,
    });

    const [post] = await repo.getByIds(['abc123']);
    expect(post?.imageUrl).toBeUndefined();
  });
});

describe('postsRepo.updateMirroredImage', () => {
  it('sets mirroredImageUrl without touching status/transform', async () => {
    await repo.putIfNew(samplePost);

    await repo.updateMirroredImage('abc123', 'https://cdn.example.com/images/abc123.jpg');

    const [post] = await repo.getByIds(['abc123']);
    expect(post).toMatchObject({
      mirroredImageUrl: 'https://cdn.example.com/images/abc123.jpg',
      status: 'ready',
      transform: 'excerpt',
    });
  });
});

describe('postsRepo.writeTranslation', () => {
  it('upserts a non-English translation', async () => {
    await repo.putIfNew(samplePost);

    await repo.writeTranslation('abc123', 'ru', {
      cardTitle: 'Заголовок',
      summary: 'Краткое содержание.',
      whyItMatters: 'Почему это важно.',
      translatedAt: '2026-07-23T00:00:00.000Z',
    });
    await repo.writeTranslation('abc123', 'ru', {
      cardTitle: 'Обновлённый заголовок',
      summary: 'Обновлённое содержание.',
      translatedAt: '2026-07-24T00:00:00.000Z',
    });

    const [post] = await repo.getByIds(['abc123']);
    expect(post?.i18n.ru).toMatchObject({ cardTitle: 'Обновлённый заголовок' });
  });
});

describe('postsRepo.appendCompactLang', () => {
  it('adds the language, idempotently', async () => {
    await repo.putIfNew(samplePost);

    await repo.appendCompactLang('abc123', 'ru');
    await repo.appendCompactLang('abc123', 'ru');
    await repo.appendCompactLang('abc123', 'uk');

    const [post] = await repo.getByIds(['abc123']);
    expect(post?.compactLangs?.sort()).toEqual(['ru', 'uk']);
  });
});

describe('postsRepo.setMirroredFigures', () => {
  it('overwrites the full figures list, preserving order', async () => {
    await repo.putIfNew(samplePost);
    await repo.setMirroredFigures('abc123', [{ url: 'https://cdn.example.com/old.jpg' }]);

    await repo.setMirroredFigures('abc123', [
      { url: 'https://cdn.example.com/1.jpg' },
      { url: 'https://cdn.example.com/2.jpg' },
    ]);

    const [post] = await repo.getByIds(['abc123']);
    expect(post?.mirroredFigures?.map((f) => f.url)).toEqual([
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
    ]);
  });
});

describe('postsRepo.setDuplicateOf', () => {
  it('sets duplicateOf', async () => {
    await repo.putIfNew(samplePost);
    await repo.putIfNew({ ...samplePost, postId: 'original' });

    await repo.setDuplicateOf('abc123', 'original');

    const [post] = await repo.getByIds(['abc123']);
    expect(post?.duplicateOf).toBe('original');
  });
});

describe('postsRepo.incrementDupCount', () => {
  it('is a harmless no-op (dupCount is derived at read time)', async () => {
    await expect(repo.incrementDupCount('abc123')).resolves.toBeUndefined();
  });
});

describe('postsRepo.deleteExpired', () => {
  it('deletes only posts whose expiresAt has passed', async () => {
    await repo.putIfNew(samplePost);
    await db.execute(
      sql`update posts set expires_at = now() - interval '1 day' where post_id = 'abc123'`,
    );
    await repo.putIfNew({ ...samplePost, postId: 'still-fresh' });

    const deleted = await repo.deleteExpired();

    expect(deleted).toBe(1);
    expect(await repo.getByIds(['abc123'])).toEqual([]);
    expect(await repo.getByIds(['still-fresh'])).toHaveLength(1);
  });

  it('cascades to child rows', async () => {
    await repo.putIfNew(samplePost);
    await repo.writeTranslation('abc123', 'ru', {
      cardTitle: 'Заголовок',
      summary: 'Содержание',
      translatedAt: '2026-07-19T00:00:00.000Z',
    });
    await db.execute(
      sql`update posts set expires_at = now() - interval '1 day' where post_id = 'abc123'`,
    );

    await repo.deleteExpired();

    const translations = await db.execute(
      sql`select 1 from post_translations where post_id = 'abc123'`,
    );
    expect(translations.rows).toHaveLength(0);
  });

  it('returns 0 when nothing is expired', async () => {
    await repo.putIfNew(samplePost);

    expect(await repo.deleteExpired()).toBe(0);
  });
});
