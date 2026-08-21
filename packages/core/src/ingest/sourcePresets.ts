import type { SourceRecord } from '../sources.types';

type SourcePreset = Omit<SourceRecord, 'weight' | 'enabled' | 'failCount'>;

const PRESETS: SourcePreset[] = [
  {
    sourceId: 'hn',
    name: 'Hacker News',
    rssUrl: 'https://hnrss.org/frontpage',
    siteUrl: 'https://news.ycombinator.com',
    defaultTopic: 'dev',
  },
  {
    sourceId: 'verge',
    name: 'The Verge',
    rssUrl: 'https://www.theverge.com/rss/index.xml',
    siteUrl: 'https://www.theverge.com',
    defaultTopic: 'gadgets',
  },
  {
    sourceId: 'arstechnica',
    name: 'Ars Technica',
    rssUrl: 'https://feeds.arstechnica.com/arstechnica/index',
    siteUrl: 'https://arstechnica.com',
    defaultTopic: 'gadgets',
  },
  {
    sourceId: 'techcrunch',
    name: 'TechCrunch',
    rssUrl: 'https://techcrunch.com/feed/',
    siteUrl: 'https://techcrunch.com',
    defaultTopic: 'startups',
  },
  {
    sourceId: 'sciencedaily',
    name: 'ScienceDaily',
    rssUrl: 'https://www.sciencedaily.com/rss/top/technology.xml',
    siteUrl: 'https://www.sciencedaily.com',
    defaultTopic: 'science',
  },
  {
    sourceId: 'physorg',
    name: 'Phys.org',
    rssUrl: 'https://phys.org/rss-feed/',
    siteUrl: 'https://phys.org',
    defaultTopic: 'science',
  },
  {
    sourceId: 'quanta',
    name: 'Quanta Magazine',
    rssUrl: 'https://www.quantamagazine.org/feed/',
    siteUrl: 'https://www.quantamagazine.org',
    defaultTopic: 'science',
  },
  {
    sourceId: 'nature',
    name: 'Nature News',
    rssUrl: 'https://www.nature.com/nature.rss',
    siteUrl: 'https://www.nature.com',
    defaultTopic: 'science',
  },
  {
    sourceId: 'arxiv-ai',
    name: 'arXiv cs.AI',
    rssUrl: 'https://rss.arxiv.org/rss/cs.AI',
    siteUrl: 'https://arxiv.org/list/cs.AI/recent',
    defaultTopic: 'ai',
  },
  {
    sourceId: 'github-blog',
    name: 'GitHub Blog',
    rssUrl: 'https://github.blog/feed/',
    siteUrl: 'https://github.blog',
    defaultTopic: 'dev',
  },
  {
    sourceId: 'huggingface-blog',
    name: 'Hugging Face Blog',
    rssUrl: 'https://huggingface.co/blog/feed.xml',
    siteUrl: 'https://huggingface.co/blog',
    defaultTopic: 'ai',
  },
];

export const FULL_SOURCE_PRESETS: SourceRecord[] = PRESETS.map((preset) => ({
  ...preset,
  weight: 1,
  enabled: true,
  failCount: 0,
}));

export const NON_PRODUCTION_SOURCE_IDS = ['verge', 'quanta'];

export function sourcePresetsForStage(stage: string): SourceRecord[] {
  if (stage === 'production') return FULL_SOURCE_PRESETS;

  return FULL_SOURCE_PRESETS.map((source) => ({
    ...source,
    enabled: NON_PRODUCTION_SOURCE_IDS.includes(source.sourceId),
  }));
}
