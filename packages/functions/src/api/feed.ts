import { buildFeed } from '@techtok/core';
import { feedQuerySchema, feedResponseSchema } from '@techtok/shared';
import { getPostsRepo, getSourceWeightsCache, getUserActivityRepo, getUsersRepo } from '../repos';
import { extractDeviceLanguage } from './deviceId';
import { jsonResponse, parseQuery, withDeviceId } from './http';
import { toCard } from './toCard';

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

  const body = feedResponseSchema.parse({
    items: page.items.map((post) => toCard(post, bookmarkedIds.has(post.postId), lang)),
    nextBefore: page.nextBefore,
  });

  return jsonResponse(200, body);
});
