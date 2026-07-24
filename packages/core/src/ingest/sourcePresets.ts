import type { SourceRecord } from '../sources.types';

/** Preset rows carry only their identity; the operational fields all start
 * from the same defaults (weight 1, enabled, clean failCount) applied below. */
type SourcePreset = Omit<SourceRecord, 'weight' | 'enabled' | 'failCount'>;

const PRESETS: SourcePreset[] = [
  {
    sourceId: 'hn',
    name: 'Hacker News',
    rssUrl: 'https://hnrss.org/frontpage',
    siteUrl: 'https://news.ycombinator.com',
    defaultTopic: 'dev',
    topics: ['dev'],
  },
  {
    sourceId: 'verge',
    name: 'The Verge',
    rssUrl: 'https://www.theverge.com/rss/index.xml',
    siteUrl: 'https://www.theverge.com',
    defaultTopic: 'gadgets',
    topics: ['gadgets'],
  },
  {
    sourceId: 'arstechnica',
    name: 'Ars Technica',
    rssUrl: 'https://feeds.arstechnica.com/arstechnica/index',
    siteUrl: 'https://arstechnica.com',
    defaultTopic: 'gadgets',
    topics: ['gadgets', 'dev'],
  },
  {
    sourceId: 'techcrunch',
    name: 'TechCrunch',
    rssUrl: 'https://techcrunch.com/feed/',
    siteUrl: 'https://techcrunch.com',
    defaultTopic: 'startups',
    topics: ['startups'],
  },
  {
    sourceId: 'sciencedaily',
    name: 'ScienceDaily',
    rssUrl: 'https://www.sciencedaily.com/rss/top/technology.xml',
    siteUrl: 'https://www.sciencedaily.com',
    defaultTopic: 'science',
    topics: ['science'],
  },
  {
    sourceId: 'physorg',
    name: 'Phys.org',
    rssUrl: 'https://phys.org/rss-feed/',
    siteUrl: 'https://phys.org',
    defaultTopic: 'science',
    topics: ['science'],
  },
  {
    sourceId: 'quanta',
    name: 'Quanta Magazine',
    rssUrl: 'https://www.quantamagazine.org/feed/',
    siteUrl: 'https://www.quantamagazine.org',
    defaultTopic: 'science',
    topics: ['science'],
  },
  {
    sourceId: 'nature',
    name: 'Nature News',
    rssUrl: 'https://www.nature.com/nature.rss',
    siteUrl: 'https://www.nature.com',
    defaultTopic: 'science',
    topics: ['science', 'bio'],
  },
  {
    sourceId: 'arxiv-ai',
    name: 'arXiv cs.AI',
    rssUrl: 'https://rss.arxiv.org/rss/cs.AI',
    siteUrl: 'https://arxiv.org/list/cs.AI/recent',
    defaultTopic: 'ai',
    topics: ['ai'],
  },
  {
    sourceId: 'github-blog',
    name: 'GitHub Blog',
    rssUrl: 'https://github.blog/feed/',
    siteUrl: 'https://github.blog',
    defaultTopic: 'dev',
    topics: ['dev'],
  },
  {
    sourceId: 'huggingface-blog',
    name: 'Hugging Face Blog',
    rssUrl: 'https://huggingface.co/blog/feed.xml',
    siteUrl: 'https://huggingface.co/blog',
    defaultTopic: 'ai',
    topics: ['ai'],
  },
];

/**
 * The full ~11-feed preset list from DESIGN.md §2, seeded into the `Sources`
 * table (Phase 2). Editable afterwards via the table itself — this is only
 * the initial data.
 */
export const FULL_SOURCE_PRESETS: SourceRecord[] = PRESETS.map((preset) => ({
  ...preset,
  weight: 1,
  enabled: true,
  failCount: 0,
}));
