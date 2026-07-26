import type { Language, Topic } from '@techtok/shared';

export interface UserRecord {
  readonly userId: string;
  readonly topics: Topic[];
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly language?: Language;
  /** Implicit per-topic read affinity signal (feed/scoring.ts consumes this
   * as a bounded ranking boost). Absent until the user's first read. */
  readonly topicReads?: Partial<Record<Topic, number>>;
}
