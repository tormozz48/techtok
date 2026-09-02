import type { Topic } from '@techtok/shared';
import { encodeId } from '../db/ids';
import type { ActivityRecord, BookmarkRecord, ReadSnapshot } from '../history.types';

export interface ActivitySelection {
  readonly postId: number;
  readonly ts: string;
  readonly cardTitle: string;
  readonly sourceName: string;
  readonly url: string;
  readonly primaryTopic: Topic | null;
}

export class Activity {
  constructor(
    private readonly userId: string,
    private readonly row: ActivitySelection,
  ) {}

  toReadRecord(): ActivityRecord {
    return {
      userId: this.userId,
      postId: encodeId(this.row.postId),
      readAt: this.row.ts,
      snapshot: this.snapshot,
    };
  }

  toBookmarkRecord(): BookmarkRecord {
    return {
      userId: this.userId,
      postId: encodeId(this.row.postId),
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
