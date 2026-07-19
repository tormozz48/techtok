import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';
import { describe, expect, it } from 'vitest';
import { mapEntryToPost } from './rssMapper';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(dirname, '__fixtures__');

async function loadFeed(filename: string) {
  const xml = await readFile(path.join(FIXTURES_DIR, filename), 'utf8');
  return new Parser().parseString(xml);
}

describe('mapEntryToPost — hn.xml (RSS 2.0, no images)', () => {
  it('maps all entries with no imageUrl', async () => {
    const feed = await loadFeed('hn.xml');
    const source = { sourceId: 'hn', name: 'Hacker News', defaultTopic: 'dev' as const };
    const posts = feed.items.map((entry) => mapEntryToPost(entry, source));

    expect(posts).toHaveLength(3);
    for (const post of posts) {
      expect(post?.imageUrl).toBeUndefined();
      expect(post?.status).toBe('discovered');
      expect(post?.transform).toBe('excerpt');
      expect(post?.primaryTopic).toBe('dev');
    }
    expect(posts[0]?.cardTitle).toContain('gestapo');
    expect(posts[0]?.publishedAt).toBe('2026-07-18T17:53:05.000Z');
  });
});

describe('mapEntryToPost — verge.xml (Atom, image embedded in content HTML)', () => {
  it('extracts the first image src and a truncated excerpt', async () => {
    const feed = await loadFeed('verge.xml');
    const source = { sourceId: 'verge', name: 'The Verge', defaultTopic: 'gadgets' as const };
    const posts = feed.items.map((entry) => mapEntryToPost(entry, source));

    expect(posts).toHaveLength(3);
    expect(posts[0]?.imageUrl).toBe(
      'https://platform.theverge.com/wp-content/uploads/sites/2/2026/07/videoframe_212.png?quality=90&strip=all&crop=0,0,100,100',
    );
    expect(posts[0]?.excerpt.length).toBeLessThanOrEqual(280);
    expect(posts[0]?.excerpt).not.toContain('<');
  });
});

describe('mapEntryToPost — sciencedaily.xml (RSS 2.0, EDT pubDate)', () => {
  it('parses the named US timezone into a correct UTC instant', async () => {
    const feed = await loadFeed('sciencedaily.xml');
    const source = {
      sourceId: 'sciencedaily',
      name: 'ScienceDaily',
      defaultTopic: 'science' as const,
    };
    const posts = feed.items.map((entry) => mapEntryToPost(entry, source));

    expect(posts[0]?.publishedAt).toBe('2026-07-17T06:04:57.000Z');
    expect(posts[0]?.imageUrl).toBeUndefined();
  });
});

describe('mapEntryToPost — dedup and edge cases', () => {
  const source = { sourceId: 'x', name: 'X', defaultTopic: 'dev' as const };

  it('produces the same postId for URLs that only differ by tracking params', () => {
    const a = mapEntryToPost(
      { title: 'A', link: 'https://example.com/a?utm_source=digest' },
      source,
    );
    const b = mapEntryToPost({ title: 'A again', link: 'https://example.com/a' }, source);
    expect(a?.postId).toBe(b?.postId);
  });

  it('returns undefined when the entry has no link', () => {
    expect(mapEntryToPost({ title: 'No link' }, source)).toBeUndefined();
  });

  it('returns undefined when the entry has no title', () => {
    expect(mapEntryToPost({ link: 'https://example.com/x' }, source)).toBeUndefined();
  });

  it('falls back to the current time when pubDate is unparseable', () => {
    const post = mapEntryToPost(
      { title: 'Bad date', link: 'https://example.com/x', pubDate: 'not-a-date' },
      source,
    );
    expect(post).toBeDefined();
    expect(Number.isNaN(new Date(post?.publishedAt ?? 'invalid').getTime())).toBe(false);
  });
});
