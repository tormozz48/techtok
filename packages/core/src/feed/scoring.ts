import type { Topic } from '@techtok/shared';
import { differenceInMilliseconds, parseISO } from 'date-fns';
import type { PostCandidate } from '../posts.types';
import { MS_PER_HOUR } from '../util/time';

type RankableFields = Pick<PostCandidate, 'publishedAt' | 'sourceId' | 'primaryTopic'>;

export const RECENCY_HALF_LIFE_HOURS = 6;

export const DEFAULT_SOURCE_WEIGHT = 1;

export const MIN_AFFINITY_READS = 10;

export const AFFINITY_GAIN = 0.5;

export const MAX_AFFINITY_BOOST = 1.5;

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

export function rankCandidates<T extends RankableFields>(
  candidates: T[],
  sourceWeights: Map<string, number>,
  now: Date = new Date(),
  affinityBoosts?: Map<Topic, number>,
): T[] {
  const scored = candidates
    .map((post) => ({ post, score: scorePost(post, sourceWeights, now, affinityBoosts) }))
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
  return interleaveBySource(interleaveByTopic(scored));
}

function recencyDecay(publishedAt: string, now: Date = new Date()): number {
  const ageHours = Math.max(0, differenceInMilliseconds(now, parseISO(publishedAt))) / MS_PER_HOUR;
  return 2 ** (-ageHours / RECENCY_HALF_LIFE_HOURS);
}

function scorePost(
  post: RankableFields,
  sourceWeights: Map<string, number>,
  now: Date = new Date(),
  affinityBoosts?: Map<Topic, number>,
): number {
  const weight = sourceWeights.get(post.sourceId) ?? DEFAULT_SOURCE_WEIGHT;
  const boost = affinityBoosts?.get(post.primaryTopic) ?? 1;
  return recencyDecay(post.publishedAt, now) * weight * boost;
}

function interleaveByKey<T extends RankableFields>(sorted: T[], keyOf: (post: T) => string): T[] {
  const queues = new Map<string, T[]>();
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

  const result: T[] = [];
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

function interleaveByTopic<T extends RankableFields>(sorted: T[]): T[] {
  return interleaveByKey(sorted, (post) => post.primaryTopic);
}

function interleaveBySource<T extends RankableFields>(sorted: T[]): T[] {
  return interleaveByKey(sorted, (post) => post.sourceId);
}
