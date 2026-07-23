import type { Topic } from '@techtok/shared';

export interface SourceRecord {
  readonly sourceId: string;
  readonly name: string;
  readonly rssUrl: string;
  readonly siteUrl?: string;
  readonly defaultTopic: Topic;
  readonly topics: Topic[];
  readonly weight: number;
  readonly enabled: boolean;
  readonly etag?: string;
  readonly lastModified?: string;
  readonly lastFetchAt?: string;
  readonly lastStatus?: 'ok' | 'not-modified' | 'error';
  readonly failCount: number;
  /** Per-source daily LLM transform quota override (D22) — defaults to
   * `DEFAULT_SOURCE_DAILY_QUOTA` in the transform Lambda when unset. */
  readonly dailyQuota?: number;
}
