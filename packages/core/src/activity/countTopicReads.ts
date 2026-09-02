import type { Topic } from '@techtok/shared';

export function countTopicReads(topics: Topic[]): Partial<Record<Topic, number>> {
  const counts: Partial<Record<Topic, number>> = {};
  for (const topic of topics) {
    counts[topic] = (counts[topic] ?? 0) + 1;
  }
  return counts;
}
