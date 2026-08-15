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

/**
 * The only sources enabled outside `production`. A cost audit (2026-08-15)
 * found `dev` holding a post volume within 5% of production's — and therefore
 * paying ~96% of its eager per-post LLM fan-out (1 card + 3 translations + 4
 * compact articles, D31/D36) — for a stage with no readers. Cadence wasn't the
 * cause: `dev` already polls every 6 hours to production's 60 minutes (D-note
 * in `infra/pipeline.ts`). `arxiv-ai` and `hn` are simply firehoses, and they
 * were 2 of the 4 feeds `dev` had enabled.
 *
 * These two are moderate-volume feeds with *different* `defaultTopic`s, so a
 * dev stage still exercises every pipeline path end-to-end — including the
 * primaryTopic GSI, which a single-source stage would leave with only one
 * partition to read from.
 */
export const NON_PRODUCTION_SOURCE_IDS = ['verge', 'quanta'];

/**
 * Presets for a given stage. Every stage is seeded with all ~11 rows; only
 * `enabled` differs, so a source can still be switched on later by editing the
 * table directly — no deploy, and no divergence in what rows exist.
 */
export function sourcePresetsForStage(stage: string): SourceRecord[] {
  if (stage === 'production') return FULL_SOURCE_PRESETS;

  return FULL_SOURCE_PRESETS.map((source) => ({
    ...source,
    enabled: NON_PRODUCTION_SOURCE_IDS.includes(source.sourceId),
  }));
}
