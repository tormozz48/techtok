import type { Topic } from '@techtok/shared';

/** Tallies how many times each topic appears — used to turn a batch of
 * newly-read posts' topics into the counts usersRepo.addTopicReads expects. */
export function countTopicReads(topics: Topic[]): Partial<Record<Topic, number>> {
  const counts: Partial<Record<Topic, number>> = {};
  for (const topic of topics) {
    counts[topic] = (counts[topic] ?? 0) + 1;
  }
  return counts;
}
