import type { PostRecord } from '../posts/types';

/** Hours for a post's recency score to halve. Tunable — this is explicitly a phase-4 experiment. */
export const RECENCY_HALF_LIFE_HOURS = 6;

/** Weight applied to a source with no entry in the weights map (matches the seeded default of 1). */
export const DEFAULT_SOURCE_WEIGHT = 1;

const MS_PER_HOUR = 60 * 60 * 1000;

/** Exponential recency decay: 1 at age 0, 0.5 at one half-life, 0.25 at two, etc. */
export function recencyDecay(publishedAt: string, now: Date = new Date()): number {
  const ageHours = Math.max(0, now.getTime() - new Date(publishedAt).getTime()) / MS_PER_HOUR;
  return 2 ** (-ageHours / RECENCY_HALF_LIFE_HOURS);
}

export function scorePost(
  post: Pick<PostRecord, 'publishedAt' | 'sourceId'>,
  sourceWeights: Map<string, number>,
  now: Date = new Date(),
): number {
  const weight = sourceWeights.get(post.sourceId) ?? DEFAULT_SOURCE_WEIGHT;
  return recencyDecay(post.publishedAt, now) * weight;
}

/**
 * Round-robin by `primaryTopic`, preserving each topic's internal (score) order.
 * Keeps a single topic from dominating consecutive slots when several topics
 * are in play, without discarding any candidate.
 */
export function interleaveByTopic(sorted: PostRecord[]): PostRecord[] {
  const queues = new Map<string, PostRecord[]>();
  const topicOrder: string[] = [];
  for (const post of sorted) {
    let queue = queues.get(post.primaryTopic);
    if (!queue) {
      queue = [];
      queues.set(post.primaryTopic, queue);
      topicOrder.push(post.primaryTopic);
    }
    queue.push(post);
  }

  const result: PostRecord[] = [];
  let remaining = sorted.length;
  while (remaining > 0) {
    for (const topic of topicOrder) {
      const queue = queues.get(topic);
      const next = queue?.shift();
      if (next) {
        result.push(next);
        remaining--;
      }
    }
  }
  return result;
}

/** Scores candidates by recency x source weight, then interleaves by topic. */
export function rankCandidates(
  candidates: PostRecord[],
  sourceWeights: Map<string, number>,
  now: Date = new Date(),
): PostRecord[] {
  const scored = candidates
    .map((post) => ({ post, score: scorePost(post, sourceWeights, now) }))
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
  return interleaveByTopic(scored);
}
