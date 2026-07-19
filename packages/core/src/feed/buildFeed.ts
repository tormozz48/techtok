import { TOPICS, type Topic } from '@techtok/shared';
import type { PostRecord } from '../posts/types';
import { rankCandidates } from './scoring';

const PER_TOPIC_PAGE_SIZE = 25;
const MAX_CANDIDATES = 60;

export interface BuildFeedDeps {
  queryByTopic: (topic: Topic, opts: { before?: string; limit: number }) => Promise<PostRecord[]>;
  getReadSet: (postIds: string[]) => Promise<Set<string>>;
  getSourceWeights: () => Promise<Map<string, number>>;
}

export interface BuildFeedParams {
  /** User's selected topics; empty means all topics (DESIGN §5.2 step 1). */
  userTopics: Topic[];
  before?: string;
  limit: number;
}

export interface FeedPage {
  items: PostRecord[];
  nextBefore: string | null;
}

/**
 * Implements DESIGN §5.2: per-topic GSI query, merge newest-first, dedup,
 * drop already-read posts, then rank the remainder (recency decay x source
 * weight, topic-interleaved — a phase-4 experiment, see scoring.ts).
 *
 * `nextBefore` is deliberately derived from `candidatesByTime` — the
 * publishedAt-sorted, pre-ranking candidate list — never from the ranked
 * `items`. Ranking/interleaving reorders what's *displayed* but must never
 * change the GSI watermark cursor, or pagination would skip or repeat posts.
 */
export async function buildFeed(deps: BuildFeedDeps, params: BuildFeedParams): Promise<FeedPage> {
  const { before, limit } = params;
  const topics = params.userTopics.length > 0 ? params.userTopics : TOPICS;

  const perTopicResults = await Promise.all(
    topics.map((topic) => deps.queryByTopic(topic, { before, limit: PER_TOPIC_PAGE_SIZE })),
  );

  const merged = new Map<string, PostRecord>();
  for (const posts of perTopicResults) {
    for (const post of posts) merged.set(post.postId, post);
  }
  const candidatesByTime = [...merged.values()]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0))
    .slice(0, MAX_CANDIDATES);

  const readIds = await deps.getReadSet(candidatesByTime.map((post) => post.postId));
  const unread = candidatesByTime.filter((post) => !readIds.has(post.postId));

  const sourceWeights = await deps.getSourceWeights();
  const ranked = rankCandidates(unread, sourceWeights);
  const items = ranked.slice(0, limit);

  const moreUpstream = perTopicResults.some((posts) => posts.length >= PER_TOPIC_PAGE_SIZE);
  const nextBefore = moreUpstream ? (candidatesByTime.at(-1)?.publishedAt ?? null) : null;

  return { items, nextBefore };
}
