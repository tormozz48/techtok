import {
  chargeableCardReads,
  countTopicReads,
  effectiveQuota,
  isPlus,
  selectCardVariant,
} from '@techtok/core';
import { readsRequestSchema } from '@techtok/shared';
import { getPostsRepo, getUserActivityRepo, getUsersRepo } from '../../repos';
import { noContent, parseJsonBody, withAuth } from '../lib/http';

export const handler = withAuth(async (event, auth) => {
  const body = parseJsonBody(event, readsRequestSchema);
  if (!body.ok) return body.response;

  const readAt = new Date().toISOString();

  const activity = getUserActivityRepo();
  const [foundPosts, user] = await Promise.all([
    getPostsRepo().getByIds(body.data.postIds),
    getUsersRepo().touch(auth.userId, { email: auth.email, name: auth.name }),
  ]);
  const lang = user.language ?? 'en';
  const results = await Promise.all(
    foundPosts.map(async (post) => {
      const { wasNew } = await activity.markRead(
        auth.userId,
        post.postId,
        {
          cardTitle: selectCardVariant(post, lang).cardTitle,
          sourceName: post.sourceName,
          url: post.url,
          primaryTopic: post.primaryTopic,
        },
        readAt,
      );
      return { post, wasNew };
    }),
  );

  const newlyRead = results.filter((r) => r.wasNew);
  const topicCounts = countTopicReads(newlyRead.map((r) => r.post.primaryTopic));
  if (Object.keys(topicCounts).length > 0) {
    await getUsersRepo().addTopicReads(auth.userId, topicCounts);
  }
  if (newlyRead.length > 0 && !isPlus(user)) {
    const timezone = user.timezone ?? 'UTC';
    const quota = effectiveQuota(user.quota, timezone);
    const chargeCount = chargeableCardReads(quota, newlyRead.length);
    if (chargeCount > 0) {
      await getUsersRepo().incrementQuota(auth.userId, 'cardReads', timezone, chargeCount);
    }
  }

  return noContent();
});
