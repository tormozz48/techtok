import type { Topic } from '@techtok/shared';
import { DEFAULT_SIMILARITY_THRESHOLD, isLikelyDuplicateTitle } from './titleSimilarity';

/** Default cross-source dedup window — a story published within ±48h of a
 * candidate, from a different source, with a similar title counts as a match. */
export const DEFAULT_WINDOW_HOURS = 48;

const MS_PER_HOUR = 60 * 60 * 1000;

export interface DuplicateCandidate {
  readonly postId: string;
  readonly sourceId: string;
  readonly origTitle: string;
  readonly primaryTopic: Topic;
  readonly publishedAt: string;
  /** Set when this candidate is itself already marked as a duplicate of
   * something else — lets findDuplicateOf resolve straight to the chain's
   * root instead of marking a new post as a duplicate of a duplicate. */
  readonly duplicateOf?: string;
}

export interface FindDuplicateDeps {
  /** Recent posts in the candidate's topic, any window/limit — findDuplicateOf
   * does its own time-window filtering over whatever this returns. */
  readonly queryRecentByTopic: (topic: Topic) => Promise<DuplicateCandidate[]>;
}

export interface FindDuplicateOpts {
  readonly windowHours?: number;
  readonly threshold?: number;
}

/**
 * Looks for an existing post that's likely the same story from a different
 * source, published within `windowHours` of the candidate. Additive-only
 * (phase 4 experiment): never throws on a bad lookup result, and callers
 * decide what "found a match" means (mark-and-filter, not delete).
 */
export async function findDuplicateOf(
  candidate: DuplicateCandidate,
  deps: FindDuplicateDeps,
  opts: FindDuplicateOpts = {},
): Promise<string | undefined> {
  const windowHours = opts.windowHours ?? DEFAULT_WINDOW_HOURS;
  const threshold = opts.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const windowMs = windowHours * MS_PER_HOUR;
  const candidateTime = new Date(candidate.publishedAt).getTime();

  const recent = await deps.queryRecentByTopic(candidate.primaryTopic);

  for (const post of recent) {
    if (post.postId === candidate.postId) continue;
    if (post.sourceId === candidate.sourceId) continue;
    if (Math.abs(new Date(post.publishedAt).getTime() - candidateTime) > windowMs) continue;
    if (isLikelyDuplicateTitle(candidate.origTitle, post.origTitle, threshold)) {
      // `post` may itself already be a duplicate of an earlier post in the
      // same story cluster — resolve straight to that root so every
      // duplicate in a chain points at the one post that's actually shown.
      return post.duplicateOf ?? post.postId;
    }
  }
  return undefined;
}
