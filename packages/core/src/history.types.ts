import type { Topic } from '@techtok/shared';

export interface ReadSnapshot {
  readonly cardTitle: string;
  readonly sourceName: string;
  readonly url: string;
  readonly primaryTopic?: Topic;
}

export interface ActivityRecord {
  readonly userId: string;
  readonly postId: string;
  readonly readAt: string;
  readonly snapshot: ReadSnapshot;
}

export interface BookmarkRecord {
  readonly userId: string;
  readonly postId: string;
  readonly bookmarkedAt: string;
  readonly snapshot: ReadSnapshot;
}
