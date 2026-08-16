import {
  buildFeed,
  effectiveQuota,
  FREE_CARD_READS_PER_DAY,
  isPlus,
  nextLocalMidnightUtc,
} from '@techtok/core';
import { feedQuerySchema, feedResponseSchema } from '@techtok/shared';
import {
  getPostsRepo,
  getSourceWeightsCache,
  getUserActivityRepo,
  getUsersRepo,
} from '../../repos';
import { extractDeviceLanguage, extractDeviceTimezone } from '../lib/auth';
import { jsonResponse, parseQuery, withAuth } from '../lib/http';
import { toCard } from '../transformers/toCard';

export const handler = withAuth(async (event, auth) => {
  const query = parseQuery(event, feedQuerySchema);
  if (!query.ok) return query.response;
  const { limit, before } = query.data;

  const posts = getPostsRepo();
  const activity = getUserActivityRepo();
  const user = await getUsersRepo().touch(auth.userId, {
    deviceLanguage: extractDeviceLanguage(event),
    timezone: extractDeviceTimezone(event),
    email: auth.email,
    name: auth.name,
  });
  const lang = user.language ?? 'en';
  const timezone = user.timezone ?? 'UTC';

  // D69's quota gate (DESIGN §5.2 step 8): checked here, incremented on the
  // read path (reads.ts) instead — so serving a page and D61's read-ahead
  // prefetch never themselves consume quota. Plus users skip this entirely.
  if (!isPlus(user)) {
    const quota = effectiveQuota(user.quota, timezone);
    if (quota.cardReads >= FREE_CARD_READS_PER_DAY) {
      return jsonResponse(
        200,
        feedResponseSchema.parse({
          items: [],
          nextBefore: null,
          quotaExhausted: true,
          resetsAt: nextLocalMidnightUtc(timezone).toISOString(),
          language: lang,
        }),
      );
    }
  }

  const page = await buildFeed(
    {
      queryByTopic: (topic, opts) => posts.queryByTopic(topic, opts),
      getReadSet: (postIds) => activity.getReadSet(auth.userId, postIds),
      getSourceWeights: () => getSourceWeightsCache().getSourceWeights(),
      getCompactDisabledSourceIds: () => getSourceWeightsCache().getCompactDisabledSourceIds(),
    },
    {
      userTopics: user.topics,
      before,
      limit,
      topicReads: user.topicReads,
      mutedSourceIds: new Set(user.mutedSources ?? []),
      lang,
    },
  );

  const bookmarkedIds = await activity.getBookmarkSet(
    auth.userId,
    page.items.map((post) => post.postId),
  );

  const body = feedResponseSchema.parse({
    items: page.items.map((post) => toCard(post, bookmarkedIds.has(post.postId), lang)),
    nextBefore: page.nextBefore,
    language: lang,
  });

  return jsonResponse(200, body);
});
