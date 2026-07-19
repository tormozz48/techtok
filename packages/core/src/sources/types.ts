import type { Topic } from '@techtok/shared';

export interface SourceRecord {
  sourceId: string;
  name: string;
  rssUrl: string;
  siteUrl?: string;
  defaultTopic: Topic;
  topics: Topic[];
  weight: number;
  enabled: boolean;
  etag?: string;
  lastModified?: string;
  lastFetchAt?: string;
  lastStatus?: 'ok' | 'not-modified' | 'error';
  failCount: number;
}
