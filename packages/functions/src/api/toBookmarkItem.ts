import type { BookmarkRecord } from '@techtok/core';
import type { BookmarkItem } from '@techtok/shared';

export function toBookmarkItem(record: BookmarkRecord): BookmarkItem {
  return {
    postId: record.postId,
    bookmarkedAt: record.bookmarkedAt,
    cardTitle: record.snapshot.cardTitle,
    sourceName: record.snapshot.sourceName,
    url: record.snapshot.url,
  };
}
