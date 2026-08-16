import { type Language, TOPICS, type Topic } from '@techtok/shared';
import type { PostRecord } from '../posts.types';
import { rankCandidates, topicAffinityBoosts } from './scoring';

const PER_TOPIC_PAGE_SIZE = 25;
const MAX_CANDIDATES = 60;

export interface BuildFeedDeps {
  readonly queryByTopic: (
    topic: Topic,
    opts: { before?: string; limit: number },
  ) => Promise<PostRecord[]>;
  readonly getReadSet: (postIds: string[]) => Promise<Set<string>>;
  readonly getSourceWeights: () => Promise<Map<string, number>>;
  /** sourceIds with the compact-reader kill switch (D23) off — excluded from
   * the feed since they can never produce a short version (see D45 amendment).
   * Optional so existing callers/tests without this concern default to no exclusions. */
  readonly getCompactDisabledSourceIds?: () => Promise<Set<string>>;
}

export interface BuildFeedParams {
  /** User's selected topics; empty means all topics (DESIGN §5.2 step 1). */
  readonly userTopics: Topic[];
  readonly before?: string;
  readonly limit: number;
  /** Source ids the user muted (Users.mutedSources) — a hard filter, not a
   * downweight (per-user source downweighting isn't possible via the global
   * sourceWeightsCache). */
  readonly mutedSourceIds?: ReadonlySet<string>;
  /** Implicit per-topic read-affinity counters (Users.topicReads) — feeds a
   * bounded ranking boost, see scoring.ts's topicAffinityBoosts. */
  readonly topicReads?: Partial<Record<Topic, number>>;
  /** The language the reader will actually request content in — when set, a
   * post whose eager compact article hasn't landed for this language yet
   * (`compactLangs` missing it) is excluded from the feed, the same
   * accepted-tradeoff class as `duplicateOf`/muted/compact-disabled below.
   * Optional so existing callers/tests without this concern default to no
   * filtering, same precedent as `mutedSourceIds`. */
  readonly lang?: Language;
}

export interface FeedPage {
  readonly items: PostRecord[];
  readonly nextBefore: string | null;
}

/**
 * Implements DESIGN §5.2: per-topic GSI query, merge newest-first, dedup,
 * drop already-read posts, then rank the remainder (recency decay x source
 * weight x a bounded read-affinity boost, topic-interleaved — a phase-4
 * experiment, see scoring.ts).
 *
 * `nextBefore` is deliberately derived from `candidatesByTime` — the
 * publishedAt-sorted, pre-ranking candidate list — never from the ranked
 * `items`. Ranking/interleaving reorders what's *displayed* but must never
 * change the GSI watermark cursor, or pagination would skip or repeat posts.
 *
 * Posts flagged `duplicateOf` (phase-4 cross-source dedup experiment),
 * posts from a muted source, posts from a source with the compact-reader
 * kill switch off (D23 — they can never have a short version), posts not
 * yet `status: 'ready'` (pre-transform `discovered`, or `failed`), and posts
 * whose eager compact article hasn't landed yet for `params.lang` (D36's own
 * documented revisit trigger — confirmed happening in practice: a live dev
 * preflight of the newest 300 posts found ~2% permanently stuck at
 * `compactLangs: []` well past the ingest cadence, not mid-generation, and
 * they skew toward the freshest/highest-ranked slot since recency dominates
 * scoring — exactly the "first card opens the browser instead of the reader"
 * report this filter closes) are filtered out here rather than at the
 * DynamoDB layer — an accepted over-fetch tradeoff (a page with many
 * duplicates, muted-source, compact-disabled, non-ready, or not-yet-compact
 * posts may return fewer than `limit` items) rather than adding a GSI just
 * for this.
 *
 * The `status` filter has the same watermark-cursor tradeoff as
 * `duplicateOf`: within one continuous pagination session, a post that is
 * still `discovered` when its page is fetched stays invisible even after it
 * flips to `ready` moments later (transform typically finishes in under two
 * minutes, well inside the 30-minute ingest cadence). This is accepted, not
 * worked around — the post reappears on any fresh feed load (no `before`),
 * since no read marker was ever written for it.
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
  const items = ranked.slice(0, limit);

  const moreUpstream = perTopicResults.some((posts) => posts.length >= PER_TOPIC_PAGE_SIZE);
  const nextBefore = moreUpstream ? (candidatesByTime.at(-1)?.publishedAt ?? null) : null;

  return { items, nextBefore };
}
