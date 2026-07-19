import type { Topic } from '@techtok/shared';

export interface SourceConfig {
  sourceId: string;
  name: string;
  rssUrl: string;
  defaultTopic: Topic;
}
