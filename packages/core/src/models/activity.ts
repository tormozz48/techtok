import type { Topic } from '@techtok/shared';
import type { ActivityRecord, BookmarkRecord, ReadSnapshot } from '../history.types';

export interface ActivityRow {
  readonly userId: string;
  readonly postId: string;
  readonly ts: string;
  readonly cardTitle: string;
  readonly sourceName: string;
  readonly url: string;
  readonly primaryTopic: Topic | null;
}

export class Activity {
  constructor(private readonly row: ActivityRow) {}

  toReadRecord(): ActivityRecord {
    return {
      userId: this.row.userId,
      postId: this.row.postId,
      readAt: this.row.ts,
      snapshot: this.snapshot,
    };
  }

  toBookmarkRecord(): BookmarkRecord {
    return {
      userId: this.row.userId,
      postId: this.row.postId,
      bookmarkedAt: this.row.ts,
      snapshot: this.snapshot,
    };
  }

  private get snapshot(): ReadSnapshot {
    const { row } = this;
    return {
      cardTitle: row.cardTitle,
      sourceName: row.sourceName,
      url: row.url,
      primaryTopic: row.primaryTopic ?? undefined,
    };
  }
}
