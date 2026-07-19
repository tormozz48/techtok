import type { BookmarkRecord } from '@techtok/core';
import { describe, expect, it } from 'vitest';
import { toBookmarkItem } from './toBookmarkItem';

const record: BookmarkRecord = {
  userId: 'device-1',
  sk: 'bm#abc123',
  postId: 'abc123',
  bookmarkedAt: '2026-07-18T00:00:00.000Z',
  snapshot: {
    cardTitle: 'A great story',
    sourceName: 'Hacker News',
    url: 'https://example.com/a',
  },
  gsi2sk: '2026-07-18T00:00:00.000Z#abc123',
};

describe('toBookmarkItem', () => {
  it('maps a bookmark record to the public bookmark DTO', () => {
    expect(toBookmarkItem(record)).toEqual({
      postId: 'abc123',
      bookmarkedAt: '2026-07-18T00:00:00.000Z',
      cardTitle: 'A great story',
      sourceName: 'Hacker News',
      url: 'https://example.com/a',
    });
  });
});
