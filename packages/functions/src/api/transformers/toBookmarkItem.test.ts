import type { BookmarkRecord } from '@techtok/core';
import { describe, expect, it } from 'vitest';
import { toBookmarkItem } from './toBookmarkItem';

const record: BookmarkRecord = {
  userId: 'device-1',
  postId: 'abc123',
  bookmarkedAt: '2026-07-18T00:00:00.000Z',
  snapshot: {
    cardTitle: 'A great story',
    sourceName: 'Hacker News',
    url: 'https://example.com/a',
  },
};

describe('toBookmarkItem', () => {
  it('maps a bookmark record to the public bookmark DTO', () => {
    expect(toBookmarkItem(record)).toEqual({
      postId: 'abc123',
      bookmarkedAt: '2026-07-18T00:00:00.000Z',
      cardTitle: 'A great story',
      sourceName: 'Hacker News',
      url: 'https://example.com/a',
      primaryTopic: undefined,
    });
  });

  it('maps primaryTopic through when present on the snapshot', () => {
    const withTopic: BookmarkRecord = {
      ...record,
      snapshot: { ...record.snapshot, primaryTopic: 'dev' },
    };

    expect(toBookmarkItem(withTopic).primaryTopic).toBe('dev');
  });
});
