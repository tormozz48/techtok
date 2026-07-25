import type { ActivityRecord } from '@techtok/core';
import type { HistoryItem } from '@techtok/shared';

export function toHistoryItem(record: ActivityRecord): HistoryItem {
  return {
    postId: record.postId,
    readAt: record.readAt,
    cardTitle: record.snapshot.cardTitle,
    sourceName: record.snapshot.sourceName,
    url: record.snapshot.url,
  };
}
