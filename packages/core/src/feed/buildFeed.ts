import { TOPICS, type Topic } from '@techtok/shared';
import type { PostRecord } from '../posts/types';

const PER_TOPIC_PAGE_SIZE = 25;
const MAX_CANDIDATES = 60;

export interface BuildFeedDeps {
  queryByTopic: (topic: Topic, opts: { before?: string; limit: number }) => Promise<PostRecord[]>;
  getReadSet: (postIds: string[]) => Promise<Set<string>>;
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
 * drop already-read posts. `nextBefore` falls back to the last *candidate*
 * (not just the last *returned* item) so a page that's entirely already-read
 * still advances the cursor instead of dead-ending the feed.
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
  const candidates = [...merged.values()]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0))
    .slice(0, MAX_CANDIDATES);

  const readIds = await deps.getReadSet(candidates.map((post) => post.postId));
  const unread = candidates.filter((post) => !readIds.has(post.postId));
  const items = unread.slice(0, limit);

  const moreUpstream = perTopicResults.some((posts) => posts.length >= PER_TOPIC_PAGE_SIZE);
  const nextBefore = moreUpstream
    ? ((items.at(-1) ?? candidates.at(-1))?.publishedAt ?? null)
    : null;

  return { items, nextBefore };
}
