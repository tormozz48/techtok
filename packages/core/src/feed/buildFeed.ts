import { type Language, TOPICS, type Topic } from '@techtok/shared';
import type { PostCandidate, PostRecord } from '../posts.types';
import { rankCandidates, topicAffinityBoosts } from './scoring';

const PER_TOPIC_PAGE_SIZE = 25;
const MAX_CANDIDATES = 60;

export interface BuildFeedDeps {
  readonly queryByTopic: (
    topic: Topic,
    opts: { before?: string; limit: number },
  ) => Promise<PostCandidate[]>;
  readonly hydrate: (postIds: string[]) => Promise<PostRecord[]>;
  readonly getReadSet: (postIds: string[]) => Promise<Set<string>>;
  readonly getSourceWeights: () => Promise<Map<string, number>>;
  readonly getCompactDisabledSourceIds?: () => Promise<Set<string>>;
}

export interface BuildFeedParams {
  readonly userTopics: Topic[];
  readonly before?: string;
  readonly limit: number;
  readonly mutedSourceIds?: ReadonlySet<string>;
  readonly topicReads?: Partial<Record<Topic, number>>;
  readonly lang?: Language;
}

export interface FeedPage {
  readonly items: PostRecord[];
  readonly nextBefore: string | null;
}

export async function buildFeed(deps: BuildFeedDeps, params: BuildFeedParams): Promise<FeedPage> {
  const { before, limit } = params;
  const topics = params.userTopics.length > 0 ? params.userTopics : TOPICS;

  const perTopicResults = await Promise.all(
    topics.map((topic) => deps.queryByTopic(topic, { before, limit: PER_TOPIC_PAGE_SIZE })),
  );

  const merged = new Map<string, PostCandidate>();
  for (const posts of perTopicResults) {
    for (const post of posts) merged.set(post.postId, post);
  }
  const compactDisabledSourceIds =
    (await deps.getCompactDisabledSourceIds?.()) ?? new Set<string>();
  const candidatesByTime = [...merged.values()]
    .filter(
      (post) =>
        !post.duplicateOf &&
        post.status === 'ready' &&
        !params.mutedSourceIds?.has(post.sourceId) &&
        !compactDisabledSourceIds.has(post.sourceId) &&
        (!params.lang || (post.compactLangs ?? []).includes(params.lang)),
    )
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0))
    .slice(0, MAX_CANDIDATES);

  const readIds = await deps.getReadSet(candidatesByTime.map((post) => post.postId));
  const unread = candidatesByTime.filter((post) => !readIds.has(post.postId));

  const sourceWeights = await deps.getSourceWeights();
  const affinityBoosts = topicAffinityBoosts(params.topicReads);
  const ranked = rankCandidates(unread, sourceWeights, undefined, affinityBoosts);
  const items = await hydrateInRankOrder(deps, ranked.slice(0, limit));

  const moreUpstream = perTopicResults.some((posts) => posts.length >= PER_TOPIC_PAGE_SIZE);
  const nextBefore = moreUpstream ? (candidatesByTime.at(-1)?.publishedAt ?? null) : null;

  return { items, nextBefore };
}

async function hydrateInRankOrder(
  deps: BuildFeedDeps,
  ranked: PostCandidate[],
): Promise<PostRecord[]> {
  if (ranked.length === 0) return [];

  const records = await deps.hydrate(ranked.map((post) => post.postId));
  const byId = new Map(records.map((record) => [record.postId, record]));

  return ranked.flatMap((candidate) => {
    const record = byId.get(candidate.postId);
    return record ? [record] : [];
  });
}
