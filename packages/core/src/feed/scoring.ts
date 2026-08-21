import type { Topic } from '@techtok/shared';
import { differenceInMilliseconds, parseISO } from 'date-fns';
import type { PostRecord } from '../posts.types';
import { MS_PER_HOUR } from '../util/time';

export const RECENCY_HALF_LIFE_HOURS = 6;

export const DEFAULT_SOURCE_WEIGHT = 1;

export const MIN_AFFINITY_READS = 10;

export const AFFINITY_GAIN = 0.5;

export const MAX_AFFINITY_BOOST = 1.5;

function recencyDecay(publishedAt: string, now: Date = new Date()): number {
  const ageHours = Math.max(0, differenceInMilliseconds(now, parseISO(publishedAt))) / MS_PER_HOUR;
  return 2 ** (-ageHours / RECENCY_HALF_LIFE_HOURS);
}

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

function scorePost(
  post: Pick<PostRecord, 'publishedAt' | 'sourceId' | 'primaryTopic'>,
  sourceWeights: Map<string, number>,
  now: Date = new Date(),
  affinityBoosts?: Map<Topic, number>,
): number {
  const weight = sourceWeights.get(post.sourceId) ?? DEFAULT_SOURCE_WEIGHT;
  const boost = affinityBoosts?.get(post.primaryTopic) ?? 1;
  return recencyDecay(post.publishedAt, now) * weight * boost;
}

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

function interleaveByTopic(sorted: PostRecord[]): PostRecord[] {
  return interleaveByKey(sorted, (post) => post.primaryTopic);
}

function interleaveBySource(sorted: PostRecord[]): PostRecord[] {
  return interleaveByKey(sorted, (post) => post.sourceId);
}

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
