import type { Topic } from '@techtok/shared';
import { differenceInMilliseconds, parseISO } from 'date-fns';
import { MS_PER_HOUR } from '../util/time';
import { DEFAULT_SIMILARITY_THRESHOLD, isLikelyDuplicateTitle } from './titleSimilarity';

export const DEFAULT_WINDOW_HOURS = 48;

export interface DuplicateCandidate {
  readonly postId: string;
  readonly sourceId: string;
  readonly origTitle: string;
  readonly primaryTopic: Topic;
  readonly publishedAt: string;
  readonly duplicateOf?: string;
}

export interface FindDuplicateDeps {
  readonly queryRecentByTopic: (topic: Topic) => Promise<DuplicateCandidate[]>;
}

export interface FindDuplicateOpts {
  readonly windowHours?: number;
  readonly threshold?: number;
}

export async function findDuplicateOf(
  candidate: DuplicateCandidate,
  deps: FindDuplicateDeps,
  opts: FindDuplicateOpts = {},
): Promise<string | undefined> {
  const windowHours = opts.windowHours ?? DEFAULT_WINDOW_HOURS;
  const threshold = opts.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const windowMs = windowHours * MS_PER_HOUR;
  const candidateTime = parseISO(candidate.publishedAt);

  const recent = await deps.queryRecentByTopic(candidate.primaryTopic);

  for (const post of recent) {
    if (post.postId === candidate.postId) continue;
    if (post.sourceId === candidate.sourceId) continue;
    if (Math.abs(differenceInMilliseconds(parseISO(post.publishedAt), candidateTime)) > windowMs)
      continue;
    if (isLikelyDuplicateTitle(candidate.origTitle, post.origTitle, threshold)) {
      return post.duplicateOf ?? post.postId;
    }
  }
  return undefined;
}
