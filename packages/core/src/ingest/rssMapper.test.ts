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
  // Same customFields as ingestSource.ts, so media:content/media:thumbnail
  // round-trip through the parser exactly as they do in production.
  return new Parser({
    customFields: {
      item: [
        ['media:content', 'mediaContent', { keepArray: true }],
        ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ],
    },
  }).parseString(xml);
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

describe('mapEntryToPost — ars.xml (RSS 2.0, media:content + nested media:thumbnail)', () => {
  it('prefers media:content over its own nested media:thumbnail', async () => {
    const feed = await loadFeed('ars.xml');
    const source = {
      sourceId: 'arstechnica',
      name: 'Ars Technica',
      defaultTopic: 'gadgets' as const,
    };
    const posts = feed.items.map((entry) => mapEntryToPost(entry, source));

    expect(posts).toHaveLength(3);
    expect(posts[0]?.imageUrl).toBe(
      'https://cdn.arstechnica.net/wp-content/uploads/2026/07/Boston-Dynamics-robot-standing-stance-1152x648.jpg',
    );
  });

  it('prefers media:content over an <img> also present in content:encoded', async () => {
    const feed = await loadFeed('ars.xml');
    const source = {
      sourceId: 'arstechnica',
      name: 'Ars Technica',
      defaultTopic: 'gadgets' as const,
    };
    const posts = feed.items.map((entry) => mapEntryToPost(entry, source));

    // The Range Rover item's content:encoded also embeds an <img> for
    // RR_GT_SIDE-PROFILE.jpg — media:content must still win.
    expect(posts[2]?.imageUrl).toBe(
      'https://cdn.arstechnica.net/wp-content/uploads/2026/07/RR_GT_FRONT-3-4-1152x648.jpg',
    );
  });
});

describe('mapEntryToPost — techcrunch.xml (RSS 2.0, no media at all)', () => {
  it('leaves imageUrl undefined for every post without crashing', async () => {
    const feed = await loadFeed('techcrunch.xml');
    const source = {
      sourceId: 'techcrunch',
      name: 'TechCrunch',
      defaultTopic: 'startups' as const,
    };
    const posts = feed.items.map((entry) => mapEntryToPost(entry, source));

    expect(posts).toHaveLength(3);
    for (const post of posts) {
      expect(post?.imageUrl).toBeUndefined();
      expect(post?.status).toBe('discovered');
    }
  });
});

describe('mapEntryToPost — physorg.xml (RSS 2.0, media:thumbnail only)', () => {
  it('falls back to media:thumbnail when media:content is absent', async () => {
    const feed = await loadFeed('physorg.xml');
    const source = { sourceId: 'physorg', name: 'Phys.org', defaultTopic: 'science' as const };
    const posts = feed.items.map((entry) => mapEntryToPost(entry, source));

    expect(posts).toHaveLength(3);
    expect(posts[0]?.imageUrl).toBe(
      'https://scx1.b-cdn.net/csz/news/tmb/2021/neural-network-1.jpg',
    );
    expect(posts[1]?.imageUrl).toBe(
      'https://scx1.b-cdn.net/csz/news/tmb/2026/detecting-the-bodys-ma-1.jpg',
    );
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

  it('prefers media:content over media:thumbnail when both are top-level siblings', () => {
    const post = mapEntryToPost(
      {
        title: 'Media group',
        link: 'https://example.com/media-group',
        mediaContent: [{ $: { url: 'https://example.com/content.jpg', medium: 'image' } }],
        mediaThumbnail: [{ $: { url: 'https://example.com/thumb.jpg' } }],
      },
      source,
    );
    expect(post?.imageUrl).toBe('https://example.com/content.jpg');
  });

  it('skips a media:content entry typed as video and falls back to media:thumbnail', () => {
    const post = mapEntryToPost(
      {
        title: 'Video enclosure',
        link: 'https://example.com/video-post',
        mediaContent: [{ $: { url: 'https://example.com/clip.mp4', medium: 'video' } }],
        mediaThumbnail: [{ $: { url: 'https://example.com/thumb.jpg' } }],
      },
      source,
    );
    expect(post?.imageUrl).toBe('https://example.com/thumb.jpg');
  });

  it('extracts an <img> from content:encoded when no media tags or enclosure exist', () => {
    const post = mapEntryToPost(
      {
        title: 'Full content only',
        link: 'https://example.com/full-content',
        content: 'Short description, no markup here.',
        'content:encoded': '<p>Body text</p><img src="https://example.com/inline.jpg">',
      },
      source,
    );
    expect(post?.imageUrl).toBe('https://example.com/inline.jpg');
  });
});
