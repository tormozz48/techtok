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
  /** Compact-reader kill switch (D23) — `undefined`/`true` means enabled;
   * only an explicit `false` disables it for this source's posts. */
  readonly compactEnabled?: boolean;
}
