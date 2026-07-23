import { Logger } from '@aws-lambda-powertools/logger';
import { buildFeed, errorMessage, needsTranslation, type PostRecord } from '@techtok/core';
import { feedQuerySchema, feedResponseSchema, type Language } from '@techtok/shared';
import {
  getPostsRepo,
  getSourceWeightsCache,
  getTranslateQueue,
  getUserActivityRepo,
  getUsersRepo,
} from '../repos';
import { extractDeviceLanguage } from './deviceId';
import { jsonResponse, parseQuery, withDeviceId } from './http';
import { toCard } from './toCard';

const logger = new Logger({ serviceName: 'feed' });

/**
 * On-demand translation enqueue (DESIGN §5.2 step 7 / D22): for posts this
 * page is about to serve in a non-EN language without a translation yet,
 * stamp a pending marker and enqueue a translate job. Best-effort — an SQS
 * or DynamoDB hiccup here must never fail the feed response itself, since
 * English is always already being served this same request.
 */
async function enqueueTranslations(posts: PostRecord[], lang: Language): Promise<void> {
  const now = new Date();
  const candidates = posts.filter((post) => needsTranslation(post, lang, now));
  if (candidates.length === 0) return;

  try {
    const nowIso = now.toISOString();
    const postsRepo = getPostsRepo();
    await Promise.all(
      candidates.map((post) => postsRepo.setI18nPending(post.postId, lang, nowIso)),
    );
    await getTranslateQueue().enqueuePending(
      candidates.map((post) => ({ postId: post.postId, lang })),
    );
  } catch (err) {
    logger.warn('translation enqueue failed, posts stay english this cycle', {
      lang,
      postIds: candidates.map((post) => post.postId),
      error: errorMessage(err),
    });
  }
}

export const handler = withDeviceId(async (event, deviceId) => {
  const query = parseQuery(event, feedQuerySchema);
  if (!query.ok) return query.response;
  const { limit, before } = query.data;

  const posts = getPostsRepo();
  const activity = getUserActivityRepo();
  const user = await getUsersRepo().touch(deviceId, extractDeviceLanguage(event));
  const lang = user.language ?? 'en';

  const page = await buildFeed(
    {
      queryByTopic: (topic, opts) => posts.queryByTopic(topic, opts),
      getReadSet: (postIds) => activity.getReadSet(deviceId, postIds),
      getSourceWeights: () => getSourceWeightsCache().getSourceWeights(),
    },
    { userTopics: user.topics, before, limit },
  );

  const bookmarkedIds = await activity.getBookmarkSet(
    deviceId,
    page.items.map((post) => post.postId),
  );

  await enqueueTranslations(page.items, lang);

  const body = feedResponseSchema.parse({
    items: page.items.map((post) => toCard(post, bookmarkedIds.has(post.postId), lang)),
    nextBefore: page.nextBefore,
  });

  return jsonResponse(200, body);
});
