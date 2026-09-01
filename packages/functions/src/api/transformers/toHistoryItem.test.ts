import type { ActivityRecord } from '@techtok/core';
import { describe, expect, it } from 'vitest';
import { toHistoryItem } from './toHistoryItem';

const record: ActivityRecord = {
  userId: 'device-1',
  postId: 'abc123',
  readAt: '2026-07-18T00:00:00.000Z',
  snapshot: {
    cardTitle: 'A great story',
    sourceName: 'Hacker News',
    url: 'https://example.com/a',
  },
};

describe('toHistoryItem', () => {
  it('maps an activity record to the public history DTO', () => {
    expect(toHistoryItem(record)).toEqual({
      postId: 'abc123',
      readAt: '2026-07-18T00:00:00.000Z',
      cardTitle: 'A great story',
      sourceName: 'Hacker News',
      url: 'https://example.com/a',
      primaryTopic: undefined,
    });
  });

  it('maps primaryTopic through when present on the snapshot', () => {
    const withTopic: ActivityRecord = {
      ...record,
      snapshot: { ...record.snapshot, primaryTopic: 'ai' },
    };

    expect(toHistoryItem(withTopic).primaryTopic).toBe('ai');
  });
});
