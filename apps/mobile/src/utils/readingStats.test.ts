import type { HistoryItem, Topic } from '@techtok/shared';
import { describe, expect, it } from 'vitest';
import { computeReadingStats } from './readingStats';

const NOW = new Date('2026-07-26T12:00:00.000Z');

let counter = 0;
function historyItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  counter += 1;
  return {
    postId: `post-${counter}`,
    readAt: NOW.toISOString(),
    cardTitle: `Title ${counter}`,
    sourceName: 'Hacker News',
    url: `https://example.com/${counter}`,
    ...overrides,
  };
}

function daysAgo(n: number, hour = 12): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

describe('computeReadingStats', () => {
  it('returns all-zero stats for no history', () => {
    expect(computeReadingStats([], NOW)).toEqual({
      readsThisWeek: 0,
      readsThisMonth: 0,
      streakDays: 0,
      topTopics: [],
      topSources: [],
    });
  });

  it('counts reads within the last 7 days as readsThisWeek', () => {
    const items = [
      historyItem({ readAt: daysAgo(0) }),
      historyItem({ readAt: daysAgo(6) }),
      historyItem({ readAt: daysAgo(8) }),
    ];

    expect(computeReadingStats(items, NOW).readsThisWeek).toBe(2);
  });

  it('counts reads within the last 30 days as readsThisMonth', () => {
    const items = [
      historyItem({ readAt: daysAgo(0) }),
      historyItem({ readAt: daysAgo(29) }),
      historyItem({ readAt: daysAgo(31) }),
    ];

    expect(computeReadingStats(items, NOW).readsThisMonth).toBe(2);
  });

  it('computes a streak of consecutive read-days ending at the most recent read', () => {
    const items = [
      historyItem({ readAt: daysAgo(0) }),
      historyItem({ readAt: daysAgo(1) }),
      historyItem({ readAt: daysAgo(2) }),
      historyItem({ readAt: daysAgo(4) }),
    ];

    expect(computeReadingStats(items, NOW).streakDays).toBe(3);
  });

  it('anchors the streak to the last active day, not literally "today"', () => {
    const items = [historyItem({ readAt: daysAgo(1) }), historyItem({ readAt: daysAgo(2) })];

    expect(computeReadingStats(items, NOW).streakDays).toBe(2);
  });

  it("doesn't double-count multiple reads on the same day toward the streak", () => {
    const items = [historyItem({ readAt: daysAgo(0, 9) }), historyItem({ readAt: daysAgo(0, 20) })];

    expect(computeReadingStats(items, NOW).streakDays).toBe(1);
  });

  it('ranks topTopics by count, descending, capped at 3', () => {
    const topics: Topic[] = ['ai', 'ai', 'ai', 'dev', 'dev', 'science', 'space', 'bio'];
    const items = topics.map((primaryTopic) => historyItem({ primaryTopic }));

    const { topTopics } = computeReadingStats(items, NOW);

    expect(topTopics).toHaveLength(3);
    expect(topTopics[0]).toEqual({ topic: 'ai', count: 3 });
    expect(topTopics[1]).toEqual({ topic: 'dev', count: 2 });
  });

  it('excludes rows with no primaryTopic from topTopics without erroring', () => {
    const items = [
      historyItem({ primaryTopic: undefined }),
      historyItem({ primaryTopic: undefined }),
      historyItem({ primaryTopic: 'ai' }),
    ];

    expect(computeReadingStats(items, NOW).topTopics).toEqual([{ topic: 'ai', count: 1 }]);
  });

  it('ranks topSources by count, descending, capped at 3', () => {
    const items = [
      historyItem({ sourceName: 'Hacker News' }),
      historyItem({ sourceName: 'Hacker News' }),
      historyItem({ sourceName: 'The Verge' }),
      historyItem({ sourceName: 'TechCrunch' }),
      historyItem({ sourceName: 'Phys.org' }),
    ];

    const { topSources } = computeReadingStats(items, NOW);

    expect(topSources).toHaveLength(3);
    expect(topSources[0]).toEqual({ sourceName: 'Hacker News', count: 2 });
  });
});
