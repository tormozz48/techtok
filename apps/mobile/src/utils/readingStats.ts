import type { HistoryItem, Topic } from '@techtok/shared';
import { ONE_DAY_MS } from '@/constants/time';

export interface ReadingStats {
  readonly readsThisWeek: number;
  readonly readsThisMonth: number;
  readonly streakDays: number;
  readonly topTopics: ReadonlyArray<{ topic: Topic; count: number }>;
  readonly topSources: ReadonlyArray<{ sourceName: string; count: number }>;
}

const TOP_N = 3;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function topN<K>(counts: Map<K, number>, n: number): [K, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function computeStreak(readDays: ReadonlySet<string>): number {
  if (readDays.size === 0) return 0;

  const newestFirst = [...readDays].sort().reverse();
  let streak = 1;
  const cursor = new Date(`${newestFirst[0]}T00:00:00.000Z`);

  for (let i = 1; i < newestFirst.length; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (dayKey(cursor.toISOString()) !== newestFirst[i]) break;
    streak += 1;
  }

  return streak;
}

export function computeReadingStats(items: HistoryItem[], now: Date = new Date()): ReadingStats {
  const weekAgoMs = now.getTime() - 7 * ONE_DAY_MS;
  const monthAgoMs = now.getTime() - 30 * ONE_DAY_MS;

  let readsThisWeek = 0;
  let readsThisMonth = 0;
  const topicCounts = new Map<Topic, number>();
  const sourceCounts = new Map<string, number>();
  const readDays = new Set<string>();

  for (const item of items) {
    const readAtMs = new Date(item.readAt).getTime();
    if (readAtMs >= weekAgoMs) readsThisWeek += 1;
    if (readAtMs >= monthAgoMs) readsThisMonth += 1;

    if (item.primaryTopic) {
      topicCounts.set(item.primaryTopic, (topicCounts.get(item.primaryTopic) ?? 0) + 1);
    }
    sourceCounts.set(item.sourceName, (sourceCounts.get(item.sourceName) ?? 0) + 1);
    readDays.add(dayKey(item.readAt));
  }

  return {
    readsThisWeek,
    readsThisMonth,
    streakDays: computeStreak(readDays),
    topTopics: topN(topicCounts, TOP_N).map(([topic, count]) => ({ topic, count })),
    topSources: topN(sourceCounts, TOP_N).map(([sourceName, count]) => ({ sourceName, count })),
  };
}
