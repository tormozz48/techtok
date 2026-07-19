import type { SourceConfig } from '@techtok/core';

/**
 * Phase 0 hardcoded source list (DESIGN §7.1 walking skeleton). The
 * managed `Sources` table + full preset list arrives in Phase 2.
 */
export const PHASE0_SOURCES: SourceConfig[] = [
  {
    sourceId: 'hn',
    name: 'Hacker News',
    rssUrl: 'https://hnrss.org/frontpage',
    defaultTopic: 'dev',
  },
  {
    sourceId: 'verge',
    name: 'The Verge',
    rssUrl: 'https://www.theverge.com/rss/index.xml',
    defaultTopic: 'gadgets',
  },
  {
    sourceId: 'sciencedaily',
    name: 'ScienceDaily',
    rssUrl: 'https://www.sciencedaily.com/rss/top/technology.xml',
    defaultTopic: 'science',
  },
];
