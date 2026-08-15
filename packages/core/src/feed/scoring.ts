import type { Topic } from '@techtok/shared';
import type { PostRecord } from '../posts.types';
import { MS_PER_HOUR } from '../util/time';

/** Hours for a post's recency score to halve. Tunable — this is explicitly a phase-4 experiment. */
export const RECENCY_HALF_LIFE_HOURS = 6;

/** Weight applied to a source with no entry in the weights map (matches the seeded default of 1). */
export const DEFAULT_SOURCE_WEIGHT = 1;

/** Cold-start guard: below this many total reads, topicAffinityBoosts
 * returns no boosts at all — a couple of reads shouldn't lock in a
 * preference. */
export const MIN_AFFINITY_READS = 10;

/** How strongly a topic's read share pulls its boost toward MAX_AFFINITY_BOOST. */
export const AFFINITY_GAIN = 0.5;

/** Boost ceiling. log2(1.5) * RECENCY_HALF_LIFE_HOURS ~= 3.5 hours of
 * recency — a maximally-boosted post can leapfrog at most that much age, so
 * recency keeps dominating for anything meaningfully older. */
export const MAX_AFFINITY_BOOST = 1.5;

/** Exponential recency decay: 1 at age 0, 0.5 at one half-life, 0.25 at two, etc. */
export function recencyDecay(publishedAt: string, now: Date = new Date()): number {
  const ageHours = Math.max(0, now.getTime() - new Date(publishedAt).getTime()) / MS_PER_HOUR;
  return 2 ** (-ageHours / RECENCY_HALF_LIFE_HOURS);
}

/**
 * Bounded per-topic ranking boost from implicit read-affinity (Users.topicReads,
 * see usersRepo.addTopicReads). Boost-only — never below 1 — so a topic the
 * user hasn't read yet is never penalized, only topics they read a lot are
 * lifted. Bounded by MAX_AFFINITY_BOOST so recency + source weight still
 * dominate; interleaveByTopic (unaffected by this) remains the structural
 * guard against a single topic crowding out the rest.
 */
export function topicAffinityBoosts(
  topicReads: Partial<Record<Topic, number>> | undefined,
): Map<Topic, number> {
  const entries = topicReads ? (Object.entries(topicReads) as [Topic, number][]) : [];
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total < MIN_AFFINITY_READS) return new Map();

  return new Map(
    entries.map(([topic, count]) => [
      topic,
      Math.min(1 + AFFINITY_GAIN * (count / total), MAX_AFFINITY_BOOST),
    ]),
  );
}

export function scorePost(
  post: Pick<PostRecord, 'publishedAt' | 'sourceId' | 'primaryTopic'>,
  sourceWeights: Map<string, number>,
  now: Date = new Date(),
  affinityBoosts?: Map<Topic, number>,
): number {
  const weight = sourceWeights.get(post.sourceId) ?? DEFAULT_SOURCE_WEIGHT;
  const boost = affinityBoosts?.get(post.primaryTopic) ?? 1;
  return recencyDecay(post.publishedAt, now) * weight * boost;
}

/** Round-robin `sorted` by `keyOf`, preserving each key's internal order. */
function interleaveByKey(sorted: PostRecord[], keyOf: (post: PostRecord) => string): PostRecord[] {
  const queues = new Map<string, PostRecord[]>();
  const keyOrder: string[] = [];
  for (const post of sorted) {
    const key = keyOf(post);
    let queue = queues.get(key);
    if (!queue) {
      queue = [];
      queues.set(key, queue);
      keyOrder.push(key);
    }
    queue.push(post);
  }

  const result: PostRecord[] = [];
  let remaining = sorted.length;
  while (remaining > 0) {
    for (const key of keyOrder) {
      const queue = queues.get(key);
      const next = queue?.shift();
      if (next) {
        result.push(next);
        remaining--;
      }
    }
  }
  return result;
}

/**
 * Round-robin by `primaryTopic`, preserving each topic's internal (score) order.
 * Keeps a single topic from dominating consecutive slots when several topics
 * are in play, without discarding any candidate.
 */
export function interleaveByTopic(sorted: PostRecord[]): PostRecord[] {
  return interleaveByKey(sorted, (post) => post.primaryTopic);
}

/**
 * Round-robin by `sourceId`, preserving each source's internal (score/topic) order.
 * Keeps a single source from dominating consecutive slots when several sources
 * are in play, without discarding any candidate.
 */
export function interleaveBySource(sorted: PostRecord[]): PostRecord[] {
  return interleaveByKey(sorted, (post) => post.sourceId);
}

/** Scores candidates by recency x source weight x topic affinity, then
 * interleaves by topic and then by source, so neither a single topic nor a
 * single source can crowd out consecutive slots. */
export function rankCandidates(
  candidates: PostRecord[],
  sourceWeights: Map<string, number>,
  now: Date = new Date(),
  affinityBoosts?: Map<Topic, number>,
): PostRecord[] {
  const scored = candidates
    .map((post) => ({ post, score: scorePost(post, sourceWeights, now, affinityBoosts) }))
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
  return interleaveBySource(interleaveByTopic(scored));
}
